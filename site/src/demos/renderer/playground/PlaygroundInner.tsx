import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown, { compileMarkdown } from '@react-markdown-kit/renderer'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import Checkbox from '@zuilib/primitives/checkbox'
import { cn } from '@zuilib/primitives/lib/cn'
import Tabs from '@zuilib/primitives/tabs'
import Text from '@zuilib/primitives/text'
import { CODE, PROPS } from './config'
import { SHOWCASE_CLASS_NAME } from './showcase'
import { formatBytes, formatMs, prettyHtml, timeMedian, treeJson, wordCount } from './measure'
import { DEFAULT_STATE, type OutputTab, type PlaygroundState } from './state'
import { DocsLink, PaneSwitch, StatusStrip } from '../../../components/DemoStrip'
import { useCopy } from '../../../lib/use-copy'
import { useShareLink } from '../../../lib/use-share-link'

import './showcase.css'

const TABS: readonly [OutputTab, string][] = [
  ['rendered', 'Rendered'],
  ['html', 'HTML'],
  ['tree', 'Tree'],
  ['code', 'Code'],
]

const TREE_LIMIT = 20_000
type MobilePane = 'source' | 'output'
const PANES: readonly (readonly [MobilePane, string])[] = [
  ['source', 'Source'],
  ['output', 'Output'],
]

/** A dropped file is read as text only when it looks like text. */
const TEXT_FILE = /\.(md|markdown|mdx|txt)$/i

/*
 * Playground chrome: hairlines, one accent, tabular numbers. The rendered
 * Markdown is styled by the showcase components and their stylesheet. Below
 * 900px the two panes stack and a switch in the status strip picks one,
 * starting on the output.
 */
const PANE_HEAD =
  'flex min-h-[2.35rem] items-center justify-between gap-2 border-b border-border px-[0.8rem] py-[0.3rem]'
const PANE = 'flex min-h-0 min-w-0 flex-col max-[900px]:data-[mobile-hidden]:hidden'
const FILL = 'flex min-h-0 flex-1 flex-col'
const ACTIONS = 'flex items-center gap-1'
const SOURCE_VIEW =
  'm-0 flex-1 overflow-auto bg-transparent p-[0.9rem] font-mono text-[0.76rem] leading-[1.55] whitespace-pre text-foreground [tab-size:2]'

interface Timings {
  readonly parse: number
  readonly renderFromSource: number
  readonly renderFromDocument: number
}

/**
 * The renderer demo: Markdown on the left, a live `<Markdown>` on the right,
 * with the HTML it produces, the document it parsed and the code that made it
 * one tab away. One document, one configuration; the reader edits the text.
 * The document also lives in the URL hash (src/lib/use-share-link.ts), so "Copy link"
 * hands someone else the exact document on screen.
 */
export default function PlaygroundInner(): ReactNode {
  const [state, setState] = useState<PlaygroundState>(DEFAULT_STATE)
  const [mobilePane, setMobilePane] = useState<MobilePane>('output')
  const [keepPositions, setKeepPositions] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [timings, setTimings] = useState<Timings | undefined>(undefined)
  const { copied, blocked, copy } = useCopy()

  const source = useDeferredValue(state.source)
  const document = useMemo(() => compileMarkdown(source, { preset: PROPS.preset }), [source])
  // One parse feeds the live output, the tree and the HTML; the HTML is only built while its tab is open.
  const element = useMemo(() => <Markdown {...PROPS} document={document} />, [document])
  const html = useMemo(() => (state.tab === 'html' ? renderToStaticMarkup(element) : ''), [element, state.tab])

  // Timings run once typing pauses, in the reader's browser, medians of a few runs.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const runs = source.length > 30_000 ? 3 : 5
      const parse = timeMedian(() => compileMarkdown(source, { preset: PROPS.preset }), runs)
      const renderFromSource = timeMedian(() => renderToStaticMarkup(<Markdown {...PROPS}>{source}</Markdown>), runs)
      const renderFromDocument = timeMedian(() => renderToStaticMarkup(<Markdown {...PROPS} document={document} />), runs)
      setTimings({ parse, renderFromSource, renderFromDocument })
    }, 600)
    return () => window.clearTimeout(handle)
  }, [source, document])

  const patch = useCallback((changes: Partial<PlaygroundState>) => {
    setState((current) => ({ ...current, ...changes }))
  }, [])

  const setSource = useCallback((next: string) => {
    setState((current) => ({ ...current, source: next }))
  }, [])

  const { link, unreadable } = useShareLink({
    source: state.source,
    setSource,
    pristine: state.source === DEFAULT_STATE.source,
  })

  const onDrop = (event: DragEvent<HTMLTextAreaElement>): void => {
    event.preventDefault()
    setDropping(false)
    const file = event.dataTransfer.files[0]
    if (file === undefined || !(file.type.startsWith('text/') || TEXT_FILE.test(file.name))) return
    void file.text().then((text) => patch({ source: text }))
  }

  const note = unreadable
    ? 'This browser couldn’t read the link, so you’re seeing the sample instead. The shared link is still in the address bar, and editing will replace it.'
    : blocked === undefined
      ? 'Type, paste or drop a .md file here. Copy link puts the whole document in the URL (nothing is uploaded).'
      : 'This browser blocked the clipboard. The link is in the address bar once you edit the document.'

  const onSourceChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    patch({ source: event.target.value })
  }

  const treeText = useMemo(
    () => (source.length > TREE_LIMIT ? undefined : treeJson(document.tree, keepPositions)),
    [document, keepPositions, source.length],
  )

  const tabIndex = TABS.findIndex(([tab]) => tab === state.tab)

  return (
    <ActivityScope feature="playground">
      <div className="flex h-[var(--rmk-demo-height,100dvh)] flex-col overflow-hidden border-b border-border bg-card">
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] max-[900px]:grid-cols-1">
          <section className={cn(PANE, 'border-r border-border max-[900px]:border-r-0')} data-mobile-hidden={mobilePane !== 'source' ? '' : undefined}>
            <div className={PANE_HEAD}>
              <Text as="span" size="sm" weight="medium" muted>Markdown</Text>
              <span className={ACTIONS}>
                {state.source === DEFAULT_STATE.source ? null : (
                  <Button variant="ghost" size="sm" track="reset" onClick={() => setSource(DEFAULT_STATE.source)}>
                    Reset
                  </Button>
                )}
                <Button variant="ghost" size="sm" track="copy-markdown" onClick={() => void copy('markdown', state.source)}>
                  {copied === 'markdown' ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="outline"
                  tone="primary"
                  size="sm"
                  track="copy-link"
                  disabled={link === undefined}
                  title="Copies a link with this document in the URL hash. Nothing is uploaded."
                  onClick={() => link !== undefined && void copy('link', link)}
                >
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </Button>
              </span>
            </div>
            <textarea
              className={cn(
                'm-0 box-border min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-[0.9rem] font-mono text-[0.8rem] leading-[1.6] text-foreground [tab-size:2] focus:shadow-[inset_3px_0_0_var(--primary)]',
                dropping ? 'outline-2 -outline-offset-8 outline-primary outline-dashed' : 'outline-none',
              )}
              value={state.source}
              spellCheck={false}
              aria-label="Markdown source"
              data-zui-tag="source"
              onChange={onSourceChange}
              onDragOver={(event) => {
                event.preventDefault()
                setDropping(true)
              }}
              onDragLeave={() => setDropping(false)}
              onDrop={onDrop}
            />
            <Text as="div" size="sm" className="m-0 border-t border-border px-[0.9rem] py-[0.6rem]">
              {note}
            </Text>
          </section>

          <section className={PANE} data-mobile-hidden={mobilePane !== 'output' ? '' : undefined}>
            <Tabs
              className={FILL}
              variant="pills"
              size="sm"
              track="output"
              selectedIndex={tabIndex}
              onSelectedIndexChange={(index) => patch({ tab: TABS[index]?.[0] ?? 'rendered' })}
            >
              <div className={PANE_HEAD}>
                <Tabs.List>
                  {TABS.map(([tab, label]) => (
                    <Tabs.Tab key={tab}>{label}</Tabs.Tab>
                  ))}
                </Tabs.List>
                {state.tab === 'code' && (
                  <Button variant="ghost" size="sm" track="copy-code" onClick={() => void copy('code', CODE)}>
                    {copied === 'code' ? 'Copied' : 'Copy'}
                  </Button>
                )}
                {state.tab === 'html' && (
                  <Button variant="ghost" size="sm" track="copy-html" onClick={() => void copy('html', html)}>
                    {copied === 'html' ? 'Copied' : 'Copy'}
                  </Button>
                )}
                {state.tab === 'tree' && treeText !== undefined && (
                  <Checkbox size="sm" track="tree-positions" label="positions" checked={keepPositions} onCheckedChange={setKeepPositions} />
                )}
              </div>

              <Tabs.Panels className={cn(FILL, 'mt-0')}>
                <Tabs.Panel className={cn('w-full min-w-0 flex-1 overflow-auto px-[1.1rem] py-4 text-[0.94rem]', SHOWCASE_CLASS_NAME)} data-zui-private="">
                  {element}
                </Tabs.Panel>
                <Tabs.Panel className={FILL}>
                  <pre className={cn(SOURCE_VIEW, 'whitespace-pre-wrap [word-break:break-word]')}>{prettyHtml(html)}</pre>
                </Tabs.Panel>
                <Tabs.Panel className={FILL}>
                  <pre className={SOURCE_VIEW}>
                    {treeText ?? `The tree is shown for documents under ${formatBytes(TREE_LIMIT)}. This one is ${formatBytes(source.length)}.`}
                  </pre>
                </Tabs.Panel>
                <Tabs.Panel className={FILL}>
                  <pre className={SOURCE_VIEW}>{CODE}</pre>
                </Tabs.Panel>
              </Tabs.Panels>
            </Tabs>
          </section>
        </div>

        <StatusStrip>
          <PaneSwitch panes={PANES} value={mobilePane} onChange={setMobilePane} />
          <span>
            <b>{formatBytes(state.source.length)}</b> · {wordCount(state.source)} words
          </span>
          <span>
            parse <b>{timings === undefined ? '…' : formatMs(timings.parse)}</b>
          </span>
          <span>
            render from source <b>{timings === undefined ? '…' : formatMs(timings.renderFromSource)}</b>
          </span>
          <span>
            from compiled document <b>{timings === undefined ? '…' : formatMs(timings.renderFromDocument)}</b>
          </span>
          <span>
            diagnostics <b>{document.diagnostics.length}</b>
          </span>
          <span className="ml-auto max-[900px]:ml-0">medians, measured in this browser</span>
          <DocsLink />
        </StatusStrip>
      </div>
    </ActivityScope>
  )
}
