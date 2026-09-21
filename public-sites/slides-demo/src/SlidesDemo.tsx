import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Markdown, compileMarkdown, defineMarkdownPreset, gfm, type MarkdownPreset } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { slides } from '@react-markdown-kit/slides/editor'
import { SAMPLE_DECK } from './sample-deck'
import { renderToolbar } from './toolbar'
import {
  clearStoredSource,
  decodeSource,
  encodeSource,
  linkFor,
  readSourceParam,
  readStoredSource,
  readView,
  storeSource,
  writeSourceParam,
  type DemoView,
} from './url-state'
import styles from './SlidesDemo.module.css'

import '@react-markdown-kit/renderer/styles.css'
import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/slides/styles.css'

/** Every window of this demo on one BroadcastChannel: the presenter drives the audience. */
const SYNC_CHANNEL = 'rmk-slides-demo'
const PRESENTER_WINDOW = 'rmk-slides-presenter'
const URL_DEBOUNCE_MS = 400
const STATUS_MS = 3500

/**
 * One preset for both panes. The `/editor` entry's `slides()` carries the
 * authoring nodes, the present-mode article and the static handler, so the
 * editor and the renderer read the same object. `?view=present` and
 * `?view=presenter` open straight into that mode with deep links on.
 */
function createPreset(view: DemoView): MarkdownPreset {
  const presenting = view !== 'edit'
  return defineMarkdownPreset({
    extensions: [
      gfm(),
      slides({
        sync: SYNC_CHANNEL,
        hashRouting: presenting,
        initialMode: view === 'edit' ? 'stack' : view,
      }),
    ],
  })
}

interface InitialSource {
  readonly source: string
  readonly notice?: string
}

/** `?d=` first, then what this browser saved last time, then the sample. */
async function loadInitialSource(): Promise<InitialSource> {
  const param = readSourceParam(location.search)
  const stored = readStoredSource()
  if (param === null) return { source: stored ?? SAMPLE_DECK }
  const decoded = await decodeSource(param)
  if (decoded !== undefined) return { source: decoded }
  return {
    source: stored ?? SAMPLE_DECK,
    notice: 'The deck in this link could not be read here (a compressed link needs a browser with the streams API), so this is the last deck you edited.',
  }
}

/**
 * The slides workbench: a rich Markdown editor on the left, the deck it
 * describes on the right, and a header with the deck's title, its problems
 * and the actions that leave the page (a share link, the presenter window,
 * print). The source lives in React state and is mirrored to `?d=` and to
 * `localStorage`, so a reload, a bookmark or a pasted link all restore it.
 */
export default function SlidesDemo(): ReactNode {
  const [view] = useState(() => readView(location.search))
  const [preset] = useState(() => createPreset(view))
  const [initial, setInitial] = useState<InitialSource | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void loadInitialSource().then((loaded) => {
      if (!cancelled) setInitial(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (initial === undefined) return <div className={styles.shell} aria-busy="true" />
  return <Workbench preset={preset} initial={initial} />
}

interface WorkbenchProps {
  readonly preset: MarkdownPreset
  readonly initial: InitialSource
}

interface DeckMeta {
  readonly title: string
  readonly count: number
}

function Workbench({ preset, initial }: WorkbenchProps): ReactNode {
  const [source, setSource] = useState(initial.source)
  const [notice, setNotice] = useState(initial.notice)
  const [status, setStatus] = useState('')
  const [encoded, setEncoded] = useState<string | undefined>(undefined)
  const [meta, setMeta] = useState<DeckMeta>({ title: '', count: 0 })
  const deckRef = useRef<HTMLDivElement>(null)

  // Compiled once per change: the deck renders from it and the header reads its diagnostics.
  const document = useMemo(() => compileMarkdown(source, { preset }), [source, preset])
  const problems = document.diagnostics

  // Persist: storage at once, the address bar after a pause (encoding is async).
  useEffect(() => {
    storeSource(source)
    setEncoded(undefined)
    let cancelled = false
    const timer = setTimeout(() => {
      void encodeSource(source).then((value) => {
        if (cancelled) return
        setEncoded(value)
        writeSourceParam(value)
      })
    }, URL_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [source])

  // The header shows what the renderer decided: the deck's title and slide count.
  useEffect(() => {
    const article = deckRef.current?.querySelector('[data-rmk-deck]')
    setMeta({
      title: article?.getAttribute('data-rmk-deck-title') ?? '',
      count: Number(article?.getAttribute('data-rmk-deck-slides') ?? '0'),
    })
  }, [document])

  // A short confirmation in the header, cleared on its own.
  useEffect(() => {
    if (status === '') return
    const timer = setTimeout(() => setStatus(''), STATUS_MS)
    return () => clearTimeout(timer)
  }, [status])

  const encodedNow = useCallback(async (): Promise<string> => encoded ?? encodeSource(source), [encoded, source])

  const share = useCallback(async (): Promise<void> => {
    const link = linkFor(await encodedNow(), 'present')
    try {
      await navigator.clipboard.writeText(link)
      setStatus('Link copied. It opens this deck in present mode.')
    } catch {
      setStatus('Could not copy. The address bar holds this deck; add &view=present to open it presenting.')
    }
  }, [encodedNow])

  const openPresenter = useCallback(async (): Promise<void> => {
    // Open first, navigate after encoding: a window opened after an await is popup-blocked.
    const popup = window.open('', PRESENTER_WINDOW)
    if (popup === null) {
      setStatus('The browser blocked the presenter window.')
      return
    }
    popup.location.href = linkFor(await encodedNow(), 'presenter')
    setStatus('Presenter window open. Press Present here, or open the share link on the projector; the windows move together.')
  }, [encodedNow])

  const reset = useCallback((): void => {
    clearStoredSource()
    setSource(SAMPLE_DECK)
    setNotice(undefined)
    setStatus('Sample deck restored.')
  }, [])

  const worst = problems.some((problem) => problem.severity === 'error')
    ? 'error'
    : problems.some((problem) => problem.severity === 'warning')
      ? 'warning'
      : problems.length > 0
        ? 'info'
        : 'ok'

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Deck</span>
          <h2 className={styles.title}>{meta.title === '' ? 'Untitled deck' : meta.title}</h2>
        </div>
        <span className={styles.badgeOk}>
          {meta.count} {meta.count === 1 ? 'slide' : 'slides'}
        </span>
        <span className={worst === 'ok' || worst === 'info' ? styles.badgeOk : styles.badgeWarn}>
          {problems.length === 0 ? 'no problems' : `${problems.length} ${problems.length === 1 ? 'note' : 'notes'} from the parser`}
        </span>
        <div className={styles.actions} role="group" aria-label="Deck actions">
          <button type="button" className={styles.action} onClick={() => void share()}>
            Share
          </button>
          <button type="button" className={styles.action} onClick={() => void openPresenter()}>
            Presenter window
          </button>
          <button type="button" className={styles.action} onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className={styles.actionQuiet} onClick={reset}>
            Reset
          </button>
        </div>
        <output className={styles.status} aria-live="polite">
          {status}
        </output>
      </header>

      {notice === undefined ? null : <p className={styles.notice}>{notice}</p>}

      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.colHead}>
            <span>Markdown</span>
            <span className={styles.badgeOk}>rich editor, writes the file back</span>
          </div>
          <div className={styles.editorWrap}>
            <MarkdownEditor preset={preset} value={source} onChange={setSource} toolbar={renderToolbar} aria-label="Deck source" />
          </div>
          <div className={styles.hint}>
            Type <code>---</code>, <code>--</code> or <code>???</code> on a line and press Enter, or use the Slides buttons. Switch to
            Markdown source to see the file.
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.colHead}>
            <span>Deck</span>
            <span className={styles.badgeOk}>static sections; Present makes them a show</span>
          </div>
          <div className={styles.deckWrap} ref={deckRef}>
            <div className="rmk-document">
              <Markdown preset={preset} document={document} />
            </div>
          </div>
          {problems.length === 0 ? null : (
            <ul className={styles.problems} aria-label="Parser notes">
              {problems.slice(0, 3).map((problem, index) => (
                <li key={`${problem.code}-${index}`}>
                  <code>{problem.code}</code> {problem.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
