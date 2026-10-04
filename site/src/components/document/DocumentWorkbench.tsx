import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Markdown, { compileMarkdown } from '@react-markdown-kit/renderer'
import { variables } from '@react-markdown-kit/variables'
import { renderToStaticMarkup } from 'react-dom/server'
import { useCopy } from '../../lib/use-copy'
import { useShareLink } from '../../lib/use-share-link'
import { DATASETS, LOCALES } from '../../demos/variables/samples'
import { documentPreset } from './MarkdownDocument'

type Kind = 'renderer' | 'streaming' | 'variables'
type Panel = 'source' | 'data' | null
type SourceView = 'markdown' | 'html' | 'tree'
const initialData = JSON.stringify(DATASETS[0].data, null, 2)

/** Read the documentation first; open its source or data only when needed. */
export default function DocumentWorkbench({ kind, initialSource }: {
  readonly kind: Kind
  readonly initialSource: string
}): ReactNode {
  const [source, setSource] = useState(initialSource)
  const [data, setData] = useState(initialData)
  const [locale, setLocale] = useState('en-US')
  const [panel, setPanel] = useState<Panel>(null)
  const [view, setView] = useState<SourceView>('markdown')
  const [shown, setShown] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(35)
  const { copy, copied, blocked } = useCopy()
  const pristine = source === initialSource && data === initialData && locale === 'en-US'
  const shared = kind === 'variables' ? JSON.stringify({ source, data, locale }) : source
  const restore = useCallback((text: string) => {
    if (kind === 'variables') {
      try {
        const saved = JSON.parse(text) as { source?: unknown; data?: unknown; locale?: unknown }
        if (typeof saved.source === 'string' && typeof saved.data === 'string' && typeof saved.locale === 'string') {
          setSource(saved.source)
          setData(saved.data)
          setLocale(saved.locale)
          return
        }
      } catch { /* Older share links contain plain Markdown. */ }
    }
    setSource(text)
    setShown(null)
    setPlaying(false)
  }, [kind])
  const { link, unreadable } = useShareLink({ source: shared, setSource: restore, pristine })
  const chunks = useMemo(() => source.match(/\S+\s*|\s+/g) ?? [], [source])
  const content = kind === 'streaming' && shown !== null ? chunks.slice(0, shown).join('') : source

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setShown(current => Math.min((current ?? 0) + 3, chunks.length)), speed)
    return () => clearInterval(timer)
  }, [playing, speed, chunks.length])
  useEffect(() => {
    if (shown !== null && shown >= chunks.length) setPlaying(false)
  }, [shown, chunks.length])

  const resolved = useMemo(() => {
    try {
      const values: unknown = kind === 'variables' ? JSON.parse(data) : undefined
      const document = compileMarkdown(content, {
        preset: documentPreset,
        extensions: kind === 'variables' ? [variables({ data: values, locale })] : [],
      })
      return { document, error: null }
    } catch (error) {
      return { document: null, error: error instanceof Error ? error.message : 'Check the JSON data.' }
    }
  }, [content, data, locale, kind])
  const errors = resolved.document?.diagnostics.filter(item => item.severity === 'error') ?? []
  const document = resolved.document
  const exampleIndex = DATASETS.findIndex(example => JSON.stringify(example.data, null, 2) === data && example.locale === locale)
  const inspect = useMemo(() => {
    if (!document || view === 'markdown') return source
    if (view === 'tree') return JSON.stringify(document.tree, null, 2)
    return renderToStaticMarkup(<Markdown preset={documentPreset} document={document} />)
  }, [document, source, view])
  const reset = (): void => {
    setSource(initialSource)
    setData(initialData)
    setLocale('en-US')
    setShown(null)
    setPlaying(false)
  }
  const edit = (value: string): void => {
    setSource(value)
    setShown(null)
    setPlaying(false)
  }

  return (
    <main className="document-workbench" data-panel={panel ?? 'closed'}>
      <div className="document-bar">
        <div className="document-actions" role="group" aria-label="Document controls">
          {kind === 'streaming' && <>
            <button onClick={() => { setShown(0); setPlaying(true); setPanel(null) }}>Replay</button>
            {shown !== null && shown < chunks.length && <button onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Resume'}</button>}
            <select aria-label="Playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
              <option value={90}>Slow</option><option value={35}>Normal</option><option value={12}>Fast</option>
            </select>
          </>}
          {kind === 'variables' && <button aria-pressed={panel === 'data'} onClick={() => setPanel(panel === 'data' ? null : 'data')}>Data</button>}
          <button aria-pressed={panel === 'source'} onClick={() => setPanel(panel === 'source' ? null : 'source')}>Source</button>
          {!pristine && <button onClick={reset}>Reset</button>}
          <button disabled={!link} onClick={() => link && void copy('link', link)}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
        </div>
      </div>
      {(unreadable || blocked === 'link') && <p className="document-notice" role="status">{unreadable ? 'This link could not be read. The original link is still in the address bar.' : 'Clipboard access was blocked. You can copy this document’s link from the address bar.'}</p>}
      <div className="document-layout">
        {panel && <aside className="document-source" aria-label={panel === 'data' ? 'Document data' : 'Document source'}>
          <div className="document-source-header">
            {panel === 'source' ? (
              <select aria-label="Source view" value={view} onChange={event => setView(event.target.value as SourceView)}>
                <option value="markdown">Markdown</option>
                {kind === 'renderer' && <><option value="html">HTML</option><option value="tree">Syntax tree</option></>}
              </select>
            ) : <>
              <select aria-label="Example data" value={exampleIndex} onChange={event => {
                const example = DATASETS[Number(event.target.value)]
                setData(JSON.stringify(example.data, null, 2))
                setLocale(example.locale)
              }}><option value={-1} disabled>Custom data</option>{DATASETS.map((example, index) => <option value={index} key={example.label}>{example.label}</option>)}</select>
              <select aria-label="Locale" value={locale} onChange={event => setLocale(event.target.value)}>{LOCALES.map(value => <option key={value}>{value}</option>)}</select>
            </>}
            <button aria-label="Close panel" onClick={() => setPanel(null)}>×</button>
          </div>
          <textarea
            aria-label={panel === 'data' ? 'Data as JSON' : view === 'markdown' ? 'Markdown source' : view === 'html' ? 'Generated HTML' : 'Syntax tree'}
            value={panel === 'data' ? data : inspect}
            readOnly={panel === 'source' && view !== 'markdown'}
            aria-invalid={panel === 'data' && !!resolved.error}
            onChange={event => panel === 'data' ? setData(event.target.value) : edit(event.target.value)}
            spellCheck={false}
          />
        </aside>}
        <article className="document-reading" aria-label="Rendered document" aria-busy={playing}>
          {resolved.error || errors.length ? <div className="document-error" role="status">
            <h1>Check the document data</h1>
            <p>{resolved.error ?? 'Some placeholders could not be resolved.'}</p>
            {errors.map((error, index) => <p key={index}>{error.path ? `${error.path}: ` : ''}{error.message}</p>)}
            <button onClick={() => setPanel('data')}>Edit data</button>
          </div> : document && <div className="rmk-document document-prose" data-prose=""><Markdown preset={documentPreset} document={document} /></div>}
          {kind === 'streaming' && shown !== null && <p className="document-note" role="status">{playing ? 'Streaming' : shown >= chunks.length ? 'Complete' : 'Paused'} · {shown} / {chunks.length} chunks</p>}
        </article>
      </div>
    </main>
  )
}
