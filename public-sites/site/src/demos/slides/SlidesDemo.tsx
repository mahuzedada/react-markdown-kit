import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Markdown, compileMarkdown, defineMarkdownPreset, gfm, type MarkdownPreset } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { ActivityScope } from '@zuilib/primitives/activity'
import { cn } from '@zuilib/primitives/lib/cn'
import Badge from '@zuilib/primitives/badge'
import Button from '@zuilib/primitives/button'
import Heading from '@zuilib/primitives/heading'
import Text from '@zuilib/primitives/text'
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

import '@react-markdown-kit/renderer/styles.css'
import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/slides/styles.css'

/** Every window of this demo on one BroadcastChannel: the presenter drives the audience. */
const SYNC_CHANNEL = 'rmk-slides-demo'
const PRESENTER_WINDOW = 'rmk-slides-presenter'
const URL_DEBOUNCE_MS = 400
const STATUS_MS = 3500

/*
 * Chrome for the workbench: the header and the two panes. The editor, the
 * deck and present mode are styled by the kit's own stylesheets. Kit rules
 * are unlayered and beat Tailwind's layered utilities, so a class that
 * overrides a property the kit sets carries `!`.
 *
 * Print is the deck alone: one slide per 16in x 9in page (the `rmk-slides`
 * page in shared/theme.css), nothing else. Only the width is set, so the
 * plugin's aspect-ratio gives the height: a 16:9 slide fills the page, a 4:3
 * slide is 12in wide, centred, and still 9in tall.
 */
const SHELL =
  'flex h-[var(--rmk-demo-height,100dvh)] flex-col overflow-hidden border-b border-border bg-card print:h-auto print:overflow-visible print:border-0 print:bg-transparent print:[page:rmk-slides]'
const PANE = 'flex min-h-0 min-w-0 flex-col'
const PANE_HEAD = 'flex items-center justify-between gap-2 border-b border-border px-3 py-2 print:hidden'
const INLINE_CODE = '[&_code]:font-mono [&_code]:text-[0.9em]'

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
    notice: 'This browser couldn’t read the deck in the link (compressed links need the streams API), so you’re seeing the last deck you edited.',
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

  if (initial === undefined) return <div className={SHELL} aria-busy="true" />
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
      setStatus('Couldn’t copy the link. The deck is in the address bar, and you can add &view=present to open it in present mode.')
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
    setStatus('Presenter window is open. Press Present here, or open the share link on the projector, and the two windows will stay on the same slide.')
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
    <ActivityScope feature="slides-workbench">
      <div className={SHELL}>
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5 print:hidden">
          <Heading as="h2" size="md" truncate className="m-0 mr-1 max-w-md min-w-0 leading-snug">
            {meta.title === '' ? 'Untitled deck' : meta.title}
          </Heading>
          <Badge variant="subtle" tone="success" size="sm" className="whitespace-nowrap">
            {meta.count} {meta.count === 1 ? 'slide' : 'slides'}
          </Badge>
          <Badge variant="subtle" tone={worst === 'ok' || worst === 'info' ? 'success' : 'warning'} size="sm" className="whitespace-nowrap">
            {problems.length === 0 ? 'no problems' : `${problems.length} ${problems.length === 1 ? 'note' : 'notes'} from the parser`}
          </Badge>
          <div className="ml-auto flex flex-wrap gap-1.5" role="group" aria-label="Deck actions">
            <Button variant="outline" size="sm" track="share" onClick={() => void share()}>
              Share
            </Button>
            <Button variant="outline" size="sm" track="presenter-window" onClick={() => void openPresenter()}>
              Presenter window
            </Button>
            <Button variant="outline" size="sm" track="print" onClick={() => window.print()}>
              Print
            </Button>
            <Button variant="ghost" size="sm" track="reset" onClick={reset}>
              Reset
            </Button>
          </div>
          <output className="min-h-0 basis-full text-sm text-foreground empty:hidden" aria-live="polite">
            {status}
          </output>
        </header>

        {notice === undefined ? null : (
          <Text size="sm" tone="warning" className="m-0 border-b border-border bg-warning/10 px-4 py-2 print:hidden">
            {notice}
          </Text>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] print:block">
          <div className={cn(PANE, 'print:hidden')}>
            <div className={PANE_HEAD}>
              <Text as="span" size="sm" weight="medium">
                Markdown
              </Text>
              <Badge variant="subtle" tone="success" size="sm" className="whitespace-nowrap">
                rich editor, writes the file back
              </Badge>
            </div>
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col overflow-auto',
                // The editor fills its pane. Its toolbar is the demo's own render prop (toolbar.tsx).
                '[&>.rmk-editor]:min-h-0 [&>.rmk-editor]:flex-1 [&>.rmk-editor]:rounded-none! [&>.rmk-editor]:border-0!',
                '[&_.rmk-editor_.rmk-content]:min-h-0! [&_.rmk-editor_.rmk-content]:flex-1 [&_.rmk-editor_.rmk-content]:overflow-auto [&_.rmk-editor_.rmk-content]:px-[1.1rem] [&_.rmk-editor_.rmk-content]:py-[0.85rem]',
                '[&_.rmk-editor_.rmk-toolbar]:sticky [&_.rmk-editor_.rmk-toolbar]:top-0 [&_.rmk-editor_.rmk-toolbar]:z-1',
              )}
            >
              <MarkdownEditor preset={preset} value={source} onChange={setSource} toolbar={renderToolbar} aria-label="Deck source" />
            </div>
            <Text size="sm" muted className={cn('m-0 border-t border-border px-[0.9rem] py-2', INLINE_CODE)}>
              Type <code>---</code>, <code>--</code> or <code>???</code> on a line and press Enter, or use the Slides buttons. Switch to
              Markdown source to see the file.
            </Text>
          </div>

          <div className={cn(PANE, 'border-l border-border max-[900px]:border-t max-[900px]:border-l-0 print:border-0')}>
            <div className={PANE_HEAD}>
              <Text as="span" size="sm" weight="medium">
                Deck
              </Text>
              <Badge variant="subtle" tone="success" size="sm" className="whitespace-nowrap">
                static sections until you press Present
              </Badge>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-muted p-4 print:overflow-visible print:bg-transparent print:p-0" ref={deckRef}>
              <div
                className={cn(
                  'rmk-document mx-auto max-w-5xl print:m-0 print:max-w-none',
                  "print:[&_[data-rmk-slide]]:mx-auto print:[&_[data-rmk-slide]]:w-[16in] print:[&_[data-rmk-deck-aspect='4:3']_[data-rmk-slide]]:w-[12in]",
                )}
              >
                <Markdown preset={preset} document={document} />
              </div>
            </div>
            {problems.length === 0 ? null : (
              <ul
                className={cn(
                  'm-0 list-none border-t border-border bg-warning/10 px-[0.9rem] py-1.5 text-sm text-warning-text print:hidden [&>li+li]:mt-1',
                  INLINE_CODE,
                )}
                aria-label="Parser notes"
              >
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
    </ActivityScope>
  )
}
