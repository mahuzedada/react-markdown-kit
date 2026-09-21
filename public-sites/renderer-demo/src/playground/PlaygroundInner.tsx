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
import { buildProps } from './buildProps'
import { SHOWCASE_CLASS_NAME } from './showcase'
import { formatBytes, formatMs, prettyHtml, timeMedian, treeJson, wordCount } from './measure'
import { DEFAULT_STATE, type OutputTab, type PlaygroundState } from './state'
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

  const copy = useCallback((label: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      window.setTimeout(() => setCopied(undefined), 1400)
    })
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

  return (
    <div className={styles.shell}>
      <div className={styles.work}>
        <section className={styles.sourcePane} data-mobile-hidden={mobilePane !== 'source' ? '' : undefined}>
          <div className={styles.paneHead}>
            <span>Markdown</span>
            <span>
              <button type="button" className={styles.tab} onClick={() => copy('markdown', state.source)}>
                {copied === 'markdown' ? 'Copied' : 'Copy'}
              </button>
            </span>
          </div>
          <textarea
            className={`${styles.textarea} ${dropping ? styles.dropping : ''}`}
            value={state.source}
            spellCheck={false}
            aria-label="Markdown source"
            onChange={onSourceChange}
            onDragOver={(event) => {
              event.preventDefault()
              setDropping(true)
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={onDrop}
          />
          <div className={styles.note}>Type, paste, or drop a .md file here.</div>
        </section>

        <section className={styles.outPane} data-mobile-hidden={mobilePane !== 'output' ? '' : undefined}>
          <div className={styles.paneHead}>
            <div className={styles.tabs} role="tablist">
              {TABS.map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={tab === state.tab}
                  className={tab === state.tab ? styles.tabOn : styles.tab}
                  onClick={() => patch({ tab })}
                >
                  {label}
                </button>
              ))}
            </div>
            {state.tab === 'code' && (
              <button type="button" className={styles.tab} onClick={() => copy('code', built.code)}>
                {copied === 'code' ? 'Copied' : 'Copy'}
              </button>
            )}
            {state.tab === 'html' && (
              <button type="button" className={styles.tab} onClick={() => copy('html', html)}>
                {copied === 'html' ? 'Copied' : 'Copy'}
              </button>
            )}
            {state.tab === 'tree' && treeText !== undefined && (
              <label className={styles.check} style={{ padding: 0, textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" checked={keepPositions} onChange={(event) => setKeepPositions(event.target.checked)} />
                <span>positions</span>
              </label>
            )}
          </div>

          {state.tab === 'rendered' && (
            <div className={`${styles.output} ${wrapperClassName}`} style={built.wrapperStyle}>
              {element}
            </div>
          )}

          {state.tab === 'html' && <pre className={styles.htmlView}>{prettyHtml(html)}</pre>}

          {state.tab === 'tree' && (
            <pre className={styles.treeView}>
              {treeText ?? `The tree is shown for documents under ${formatBytes(TREE_LIMIT)}. This one is ${formatBytes(source.length)}.`}
            </pre>
          )}

          {state.tab === 'code' && <pre className={styles.codeView}>{built.code}</pre>}
        </section>
      </div>

      <div className={styles.status}>
        <div className={`${styles.segment} ${styles.mobileSwitch}`}>
          {(['source', 'output'] as const).map((pane) => (
            <button key={pane} type="button" className={pane === mobilePane ? styles.on : ''} onClick={() => setMobilePane(pane)}>
              {pane}
            </button>
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
  )
}
