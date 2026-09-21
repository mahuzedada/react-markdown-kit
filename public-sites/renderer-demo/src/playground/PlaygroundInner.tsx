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
import { buildProps } from './buildProps'
import { SHOWCASE_CLASS_NAME } from './showcase'
import { formatBytes, formatMs, prettyHtml, timeMedian, treeJson, wordCount } from './measure'
import { DEFAULT_STATE, type OutputTab, type PlaygroundState } from './state'
import { useShareLink } from './useShareLink'
import styles from './Playground.module.css'

import '@react-markdown-kit/renderer/styles.css'
import '@react-markdown-kit/mermaid/styles.css'
import './utility-demo.css'
import './showcase.css'

const TABS: readonly [OutputTab, string][] = [
  ['rendered', 'Rendered'],
  ['html', 'HTML'],
  ['tree', 'Tree'],
  ['code', 'Code'],
]

const TREE_LIMIT = 20_000
type MobilePane = 'source' | 'output'

interface Timings {
  readonly parse: number
  readonly renderFromSource: number
  readonly renderFromDocument: number
}

/**
 * The renderer demo: Markdown on the left, a live `<Markdown>` on the right,
 * with the HTML it produces, the document it parsed and the code that made it
 * one tab away. One document, one configuration; the reader edits the text.
 * The document also lives in the URL hash (./useShareLink.ts), so "Copy link"
 * hands someone else the exact document on screen.
 */
export default function PlaygroundInner(): ReactNode {
  const [state, setState] = useState<PlaygroundState>(DEFAULT_STATE)
  const [mobilePane, setMobilePane] = useState<MobilePane>('source')
  const [keepPositions, setKeepPositions] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [copied, setCopied] = useState<string | undefined>(undefined)
  const [timings, setTimings] = useState<Timings | undefined>(undefined)

  const source = useDeferredValue(state.source)
  const built = useMemo(() => buildProps(state), [state])

  const wrapperClassName =
    state.styling === 'kit'
      ? 'rmk-document'
      : state.styling === 'utility'
        ? 'pg-utility'
        : state.styling === 'showcase'
          ? SHOWCASE_CLASS_NAME
          : ''

  const element = useMemo(() => <Markdown {...built.props}>{source}</Markdown>, [built, source])
  const html = useMemo(() => renderToStaticMarkup(element), [element])
  const document = useMemo(
    () => compileMarkdown(source, built.props.preset === undefined ? {} : { preset: built.props.preset }),
    [source, built.props.preset],
  )

  // Timings run after paint, in the reader's browser, medians of a few runs.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const runs = source.length > 30_000 ? 3 : 7
      const options = built.props.preset === undefined ? {} : { preset: built.props.preset }
      const parse = timeMedian(() => compileMarkdown(source, options), runs)
      const renderFromSource = timeMedian(
        () => renderToStaticMarkup(<Markdown {...built.props}>{source}</Markdown>),
        runs,
      )
      const renderFromDocument = timeMedian(
        () => renderToStaticMarkup(<Markdown {...built.props} document={document} />),
        runs,
      )
      setTimings({ parse, renderFromSource, renderFromDocument })
    }, 250)
    return () => window.clearTimeout(handle)
  }, [source, built, document])

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

  const copy = useCallback((label: string, text: string) => {
    const done = (): void => {
      setCopied(label)
      window.setTimeout(() => setCopied((current) => (current === label ? undefined : current)), 1400)
    }
    if (typeof navigator.clipboard?.writeText !== 'function') return
    navigator.clipboard.writeText(text).then(done, () => undefined)
  }, [])

  const onDrop = (event: DragEvent<HTMLTextAreaElement>): void => {
    event.preventDefault()
    setDropping(false)
    const file = event.dataTransfer.files[0]
    if (file === undefined) return
    void file.text().then((text) => patch({ source: text }))
  }

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
      <div className={styles.shell}>
        <div className={styles.work}>
          <section className={styles.sourcePane} data-mobile-hidden={mobilePane !== 'source' ? '' : undefined}>
            <div className={styles.paneHead}>
              <span>Markdown</span>
              <span className={styles.actions}>
                <Button variant="ghost" size="sm" track="copy-markdown" onClick={() => copy('markdown', state.source)}>
                  {copied === 'markdown' ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  track="copy-link"
                  disabled={link === undefined}
                  title="Put this document in the address bar and copy the link"
                  onClick={() => link !== undefined && copy('link', link)}
                >
                  {copied === 'link' ? 'Link copied' : 'Copy link'}
                </Button>
              </span>
            </div>
            <textarea
              className={`${styles.textarea} ${dropping ? styles.dropping : ''}`}
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
            <div className={styles.note}>
              {unreadable
                ? 'This link could not be read in this browser, so the sample is shown. The address bar still holds the shared link; editing replaces it.'
                : 'Type, paste, or drop a .md file here. Copy link puts the whole document in the URL; nothing is uploaded.'}
            </div>
          </section>

          <section className={styles.outPane} data-mobile-hidden={mobilePane !== 'output' ? '' : undefined}>
            <Tabs
              className={cn(styles.outTabs)}
              variant="pills"
              size="sm"
              track="output"
              selectedIndex={tabIndex}
              onSelectedIndexChange={(index) => patch({ tab: TABS[index]?.[0] ?? 'rendered' })}
            >
              <div className={styles.paneHead}>
                <Tabs.List>
                  {TABS.map(([tab, label]) => (
                    <Tabs.Tab key={tab}>{label}</Tabs.Tab>
                  ))}
                </Tabs.List>
                {state.tab === 'code' && (
                  <Button variant="ghost" size="sm" track="copy-code" onClick={() => copy('code', built.code)}>
                    {copied === 'code' ? 'Copied' : 'Copy'}
                  </Button>
                )}
                {state.tab === 'html' && (
                  <Button variant="ghost" size="sm" track="copy-html" onClick={() => copy('html', html)}>
                    {copied === 'html' ? 'Copied' : 'Copy'}
                  </Button>
                )}
                {state.tab === 'tree' && treeText !== undefined && (
                  <Checkbox size="sm" track="tree-positions" label="positions" checked={keepPositions} onCheckedChange={setKeepPositions} />
                )}
              </div>

              <Tabs.Panels className={cn(styles.panels)}>
                <Tabs.Panel className={cn(styles.output, wrapperClassName)} style={built.wrapperStyle} data-zui-private="">
                  {element}
                </Tabs.Panel>
                <Tabs.Panel className={cn(styles.panel)}>
                  <pre className={styles.htmlView}>{prettyHtml(html)}</pre>
                </Tabs.Panel>
                <Tabs.Panel className={cn(styles.panel)}>
                  <pre className={styles.treeView}>
                    {treeText ?? `The tree is shown for documents under ${formatBytes(TREE_LIMIT)}. This one is ${formatBytes(source.length)}.`}
                  </pre>
                </Tabs.Panel>
                <Tabs.Panel className={cn(styles.panel)}>
                  <pre className={styles.codeView}>{built.code}</pre>
                </Tabs.Panel>
              </Tabs.Panels>
            </Tabs>
          </section>
        </div>

        <div className={styles.status}>
          <div className={`${styles.actions} ${styles.mobileSwitch}`} role="group" aria-label="Pane">
            {(['source', 'output'] as const).map((pane) => (
              <Button
                key={pane}
                variant={pane === mobilePane ? 'solid' : 'outline'}
                size="sm"
                track={`pane-${pane}`}
                aria-pressed={pane === mobilePane}
                onClick={() => setMobilePane(pane)}
              >
                {pane === 'source' ? 'Source' : 'Output'}
              </Button>
            ))}
          </div>
          <span className={styles.stat}>
            <b>{formatBytes(state.source.length)}</b> · {wordCount(state.source)} words
          </span>
          <span className={styles.stat}>
            parse <b>{timings === undefined ? '…' : formatMs(timings.parse)}</b>
          </span>
          <span className={styles.stat}>
            render from source <b>{timings === undefined ? '…' : formatMs(timings.renderFromSource)}</b>
          </span>
          <span className={styles.stat}>
            from compiled document <b>{timings === undefined ? '…' : formatMs(timings.renderFromDocument)}</b>
          </span>
          <span className={styles.stat}>
            diagnostics <b>{document.diagnostics.length}</b>
          </span>
          <span className={`${styles.stat} ${styles.method}`}>medians, measured in this browser</span>
        </div>
      </div>
    </ActivityScope>
  )
}
