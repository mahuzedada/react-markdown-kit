import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Markdown, { compileMarkdown, defineMarkdownPreset, documentToMarkdown, gfm } from '@react-markdown-kit/renderer'
import { variables } from '@react-markdown-kit/variables'
import { ActivityScope } from '@zuilib/primitives/activity'
import Badge from '@zuilib/primitives/badge'
import Button from '@zuilib/primitives/button'
import NativeSelect from '@zuilib/primitives/native-select'
import Tabs from '@zuilib/primitives/tabs'
import Text from '@zuilib/primitives/text'
import { cn } from '@zuilib/primitives/lib/cn'
import { DocsLink, PaneSwitch, StatusStrip } from '../../components/DemoStrip'
import { useCopy } from '../../lib/use-copy'
import { useShareLink } from '../../lib/use-share-link'
import { DATASETS, LOCALES, SOURCE } from './samples'

import '@react-markdown-kit/variables/styles.css'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

/** Everything a shared link carries: the document, the data as typed and the locale. */
interface DemoState {
  readonly source: string
  readonly data: string
  readonly locale: string
}

const INITIAL: DemoState = {
  source: SOURCE,
  data: JSON.stringify(DATASETS[0]?.data ?? {}, null, 2),
  locale: DATASETS[0]?.locale ?? 'en-US',
}
const INITIAL_SHARED = JSON.stringify(INITIAL)

/** A link made by an older version of the page, or by hand, may carry only Markdown. */
function readShared(text: string): DemoState {
  try {
    const value = JSON.parse(text) as Partial<DemoState>
    if (typeof value.source === 'string' && typeof value.data === 'string' && typeof value.locale === 'string') {
      return { source: value.source, data: value.data, locale: value.locale }
    }
  } catch {
    // Not JSON: the whole hash is the document.
  }
  return { ...INITIAL, source: text }
}

type DataParse = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly message: string }

function parseData(text: string): DataParse {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Invalid JSON' }
  }
}

const PLACEHOLDER = /\{\{[^{}]*\}\}/g

type OutputTab = 'rendered' | 'markdown' | 'diagnostics'
type MobilePane = 'source' | 'output'
const PANES: readonly (readonly [MobilePane, string])[] = [
  ['source', 'Source and data'],
  ['output', 'Output'],
]

/*
 * Demo chrome, the same as the renderer playground: hairlines, one accent,
 * tabular numbers. Below 900px the panes stack and a switch in the status
 * strip picks one, starting on the output.
 */
const PANE_HEAD = 'flex min-h-[2.35rem] items-center justify-between gap-2 border-b border-border px-[0.8rem] py-[0.3rem]'
const PANE = 'flex min-h-0 min-w-0 flex-col max-[900px]:data-[mobile-hidden]:hidden'
const FILL = 'flex min-h-0 flex-1 flex-col'
const EDITOR =
  'm-0 box-border min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-[0.9rem] font-mono text-[0.8rem] leading-[1.6] text-foreground outline-none [tab-size:2] focus:shadow-[inset_3px_0_0_var(--primary)]'
const CODE_VIEW =
  'm-0 flex-1 overflow-auto bg-transparent p-[0.9rem] font-mono text-[0.76rem] leading-[1.55] whitespace-pre-wrap text-foreground [word-break:break-word]'

/**
 * The variables demo: a document with placeholders and the data it is
 * resolved against on the left, the resolved document on the right. The
 * resolution is `variables()` running inside `compileMarkdown`, the same call
 * a server would make. Switching the data set changes the output and never
 * the source. The whole state also lives in the URL hash, so "Copy link"
 * hands over exactly what is on screen.
 */
export default function VariablesDemo(): ReactNode {
  const [state, setState] = useState<DemoState>(INITIAL)
  const [tab, setTab] = useState<OutputTab>('rendered')
  const [mobilePane, setMobilePane] = useState<MobilePane>('output')
  const [markdown, setMarkdown] = useState<string | undefined>(undefined)
  const { copied, blocked, copy } = useCopy()

  const deferred = useDeferredValue(state)
  const data = useMemo(() => parseData(deferred.data), [deferred.data])
  // Half-typed JSON resolves against the last data that parsed, so one
  // missing comma doesn't turn every placeholder into an error.
  const lastValid = useRef<unknown>(DATASETS[0]?.data ?? {})
  if (data.ok) lastValid.current = data.value
  const resolveWith = data.ok ? data.value : lastValid.current

  const result = useMemo(() => {
    const document = compileMarkdown(deferred.source, {
      preset,
      extensions: [variables({ data: resolveWith, locale: deferred.locale })],
    })
    const diagnostics = document.diagnostics
    return { ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'), document, diagnostics }
  }, [deferred.source, deferred.locale, resolveWith])

  // Serializing loads the Markdown writer on demand, so it runs after render.
  useEffect(() => {
    let cancelled = false
    setMarkdown(undefined)
    documentToMarkdown(result.document, { preset }).then(
      (text) => {
        if (!cancelled) setMarkdown(text)
      },
      () => {
        if (!cancelled) setMarkdown('The Markdown writer failed to load. Reload the page to try again.')
      },
    )
    return () => {
      cancelled = true
    }
  }, [result.document])

  const shared = useMemo(() => JSON.stringify(state), [state])
  const restore = useCallback((text: string) => setState(readShared(text)), [])
  const { link, unreadable } = useShareLink({ source: shared, setSource: restore, pristine: shared === INITIAL_SHARED })

  const patch = useCallback((changes: Partial<DemoState>) => setState((current) => ({ ...current, ...changes })), [])

  const activeDataset = DATASETS.findIndex(
    (dataset) => dataset.locale === state.locale && JSON.stringify(dataset.data, null, 2) === state.data,
  )
  const placeholders = state.source.match(PLACEHOLDER)?.length ?? 0
  const tabs: readonly [OutputTab, string][] = [
    ['rendered', 'Rendered'],
    ['markdown', 'Markdown'],
    ['diagnostics', `Diagnostics (${result.diagnostics.length})`],
  ]

  return (
    <ActivityScope feature="variables-workbench">
      <div className="flex h-[var(--rmk-demo-height,100dvh)] flex-col overflow-hidden border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-[0.8rem] py-2" role="group" aria-label="Sample data">
          <Text as="span" size="sm" weight="medium" muted className="mr-1">
            Data
          </Text>
          {DATASETS.map((dataset, index) => (
            <Button
              key={dataset.label}
              variant={index === activeDataset ? 'solid' : 'outline'}
              size="sm"
              track="dataset"
              aria-pressed={index === activeDataset}
              onClick={() => patch({ data: JSON.stringify(dataset.data, null, 2), locale: dataset.locale })}
            >
              {dataset.label}
            </Button>
          ))}
          <span className="ml-auto flex items-center gap-1.5">
            {shared === INITIAL_SHARED ? null : (
              <Button variant="ghost" size="sm" track="reset" onClick={() => setState(INITIAL)}>
                Reset
              </Button>
            )}
            <NativeSelect
              size="sm"
              track="locale"
              aria-label="Locale"
              value={state.locale}
              onChange={(event) => patch({ locale: event.target.value })}
            >
              {(LOCALES.includes(state.locale) ? LOCALES : [...LOCALES, state.locale]).map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              tone="primary"
              size="sm"
              track="copy-link"
              disabled={link === undefined}
              title="Copies a link with the document, the data and the locale in the URL hash. Nothing is uploaded."
              onClick={() => link !== undefined && void copy('link', link)}
            >
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </Button>
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] max-[900px]:grid-cols-1">
          <section
            className={cn(PANE, 'border-r border-border max-[900px]:border-r-0')}
            data-mobile-hidden={mobilePane !== 'source' ? '' : undefined}
          >
            <div className={PANE_HEAD}>
              <Text as="span" size="sm" weight="medium" muted>
                Authored source
              </Text>
              <Badge variant="subtle" tone="success" size="sm">
                same for every data set
              </Badge>
            </div>
            <textarea
              className={cn(EDITOR, 'basis-3/5')}
              value={state.source}
              spellCheck={false}
              aria-label="Markdown source with placeholders"
              data-zui-tag="source"
              onChange={(event) => patch({ source: event.target.value })}
            />
            <div className={cn(PANE_HEAD, 'border-t')}>
              <Text as="span" size="sm" weight="medium" muted>
                Data passed to <code>variables()</code>
              </Text>
              {data.ok ? null : (
                <Badge variant="subtle" tone="danger" size="sm">
                  not valid JSON
                </Badge>
              )}
            </div>
            <textarea
              className={cn(EDITOR, 'basis-2/5')}
              value={state.data}
              spellCheck={false}
              aria-label="Data as JSON"
              aria-invalid={!data.ok}
              data-zui-tag="data"
              data-zui-private=""
              onChange={(event) => patch({ data: event.target.value })}
            />
            <Text as="div" size="sm" className="m-0 border-t border-border px-[0.9rem] py-[0.6rem]">
              {unreadable
                ? 'This browser couldn’t read the link, so you’re seeing the sample instead. The shared link is still in the address bar, and editing will replace it.'
                : !data.ok
                  ? `The data isn’t valid JSON (${data.message}), so the output uses the last data that was.`
                  : blocked === 'link'
                    ? 'This browser blocked the clipboard. The link is in the address bar once you edit.'
                    : 'Edit either side. Placeholders in code stay literal, and a value is always text.'}
            </Text>
          </section>

          <section className={PANE} data-mobile-hidden={mobilePane !== 'output' ? '' : undefined}>
            <Tabs
              className={FILL}
              variant="pills"
              size="sm"
              track="output"
              selectedIndex={tabs.findIndex(([name]) => name === tab)}
              onSelectedIndexChange={(index) => setTab(tabs[index]?.[0] ?? 'rendered')}
            >
              <div className={PANE_HEAD}>
                <Tabs.List>
                  {tabs.map(([name, label]) => (
                    <Tabs.Tab key={name}>{label}</Tabs.Tab>
                  ))}
                </Tabs.List>
                {tab === 'markdown' && result.ok && markdown !== undefined ? (
                  <Button variant="ghost" size="sm" track="copy-markdown" onClick={() => void copy('markdown', markdown)}>
                    {copied === 'markdown' ? 'Copied' : 'Copy'}
                  </Button>
                ) : (
                  <Badge variant="subtle" tone={result.ok ? 'warning' : 'danger'} size="sm">
                    {result.ok ? 'changes with the data' : 'not rendered'}
                  </Badge>
                )}
              </div>
              <Tabs.Panels className={cn(FILL, 'mt-0')}>
                <Tabs.Panel className="flex-1 overflow-auto px-[1.1rem] py-4" data-zui-private="">
                  {result.ok ? (
                    <div className="rmk-document">
                      <Markdown preset={preset} document={result.document} />
                    </div>
                  ) : (
                    <>
                      <Text size="sm">
                        Resolution failed, so nothing is rendered (the <code>fallback</code> option would show here):
                      </Text>
                      <Diagnostics diagnostics={result.diagnostics} />
                    </>
                  )}
                </Tabs.Panel>
                <Tabs.Panel className={FILL} data-zui-private="">
                  <pre className={CODE_VIEW}>
                    {result.ok ? (markdown ?? '') : 'Resolution failed, so there is no Markdown to serialize.'}
                  </pre>
                </Tabs.Panel>
                <Tabs.Panel className="flex-1 overflow-auto px-[1.1rem] py-4">
                  {result.diagnostics.length === 0 ? (
                    <Text size="sm">No diagnostics. Every placeholder resolved.</Text>
                  ) : (
                    <Diagnostics diagnostics={result.diagnostics} />
                  )}
                </Tabs.Panel>
              </Tabs.Panels>
            </Tabs>
          </section>
        </div>

        <StatusStrip>
          <PaneSwitch panes={PANES} value={mobilePane} onChange={setMobilePane} />
          <span>
            placeholders <b>{placeholders}</b>
          </span>
          <span>
            locale <b>{state.locale}</b>
          </span>
          <span>
            errors <b>{result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length}</b>
          </span>
          <span>
            warnings <b>{result.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length}</b>
          </span>
          <span className="ml-auto max-[900px]:ml-0">resolved in this browser, nothing is uploaded</span>
          <DocsLink />
        </StatusStrip>
      </div>
    </ActivityScope>
  )
}

function Diagnostics({ diagnostics }: { readonly diagnostics: ReturnType<typeof compileMarkdown>['diagnostics'] }): ReactNode {
  return (
    <ul className="m-0 mt-2 pl-[1.1rem] text-sm">
      {diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.code}-${index}`} className="mb-2">
          <Badge variant="subtle" tone={diagnostic.severity === 'error' ? 'danger' : 'warning'} size="sm">
            {diagnostic.severity}
          </Badge>{' '}
          <code>{diagnostic.code}</code> {diagnostic.path === undefined ? null : <code>{diagnostic.path}</code>}{' '}
          {diagnostic.message}
        </li>
      ))}
    </ul>
  )
}
