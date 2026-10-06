import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { compileMarkdown } from '@react-markdown-kit/renderer'
import { SlideCanvas, slideSpans, type DeckController } from '@react-markdown-kit/slides/canvas'
import MarkdownDocument from '../../components/document/MarkdownDocument'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import Text from '@zuilib/primitives/text'
import DeckActions from './DeckActions'
import DeckPane from './DeckPane'
import { downloadPptx } from './export-pptx'
import { loadInitialSource, type InitialSource } from './initial-source'
import { openPresenterWindow, shareDeck } from './link-actions'
import { createDeckSetup, type DeckSetup } from './preset'
import { SAMPLE_DECK } from './sample-deck'
import SourcePane from './SourcePane'
import SourceDivider from './SourceDivider'
import { readingSource } from './reading-source'
import { readView } from './url-state'
import { useDeckSource } from './use-deck-source'
import { useStreamReplay } from './use-stream-replay'

import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/mermaid/styles.css'
import '@react-markdown-kit/slides/styles.css'

const SHELL = 'document-workbench document-slides'
/**
 * The slides workbench: the deck as a slide editor filling the first
 * viewport (the current slide on a canvas, every slide in a strip, text
 * edited on the slide), its Markdown beside it on request, and the deck
 * read as a document below. The source lives in React state and is
 * mirrored to `?d=` and to `localStorage`, so a reload, a bookmark or a
 * pasted link all restore it.
 */
export default function SlidesDemo(): ReactNode {
  const [setup] = useState(() => createDeckSetup(readView(location.search)))
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

  if (initial === undefined) return <div className={`${SHELL} h-[var(--rmk-demo-height,100dvh)]`} aria-busy="true" />
  return <Workbench setup={setup} initial={initial} />
}

interface DeckMeta {
  readonly title: string
  readonly count: number
}

/** The slide the canvas shows, kept in step with the deck when a presentation ends elsewhere. */
function useCurrentSlide(controller: DeckController): [number, (index: number) => void] {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    let mode = controller.getState().mode
    return controller.subscribe(() => {
      const state = controller.getState()
      if (mode !== 'stack' && state.mode === 'stack') setIndex(state.index)
      mode = state.mode
    })
  }, [controller])
  return [index, setIndex]
}

function Workbench({ setup, initial }: { readonly setup: DeckSetup; readonly initial: InitialSource }): ReactNode {
  const { preset, controller } = setup
  const deck = useDeckSource(initial)
  const stream = useStreamReplay(deck.source, controller)
  const [meta, setMeta] = useState<DeckMeta>({ title: '', count: 0 })
  const [showSource, setShowSource] = useState(false)
  const [sourceWidth, setSourceWidth] = useState(32)
  const [revealKey, setRevealKey] = useState(0)
  const [blockSpan, setBlockSpan] = useState<{ start: number; end: number } | undefined>(undefined)
  const [exporting, setExporting] = useState(false)
  const [index, setIndex] = useCurrentSlide(controller)
  const deckRef = useRef<HTMLDivElement>(null)

  // Compiled once per change: the presentation renders from it and the source pane marks the current slide with it.
  const shown = stream.shown ?? deck.source
  const document = useMemo(() => compileMarkdown(shown, { preset }), [shown, preset])
  const spans = useMemo(() => slideSpans(document.tree, shown), [document, shown])

  // The deck's title and slide count as the renderer decided them, for the export.
  useLayoutEffect(() => {
    const article = deckRef.current?.querySelector('[data-rmk-deck]')
    setMeta({
      title: article?.getAttribute('data-rmk-deck-title') ?? '',
      count: Number(article?.getAttribute('data-rmk-deck-slides') ?? '0'),
    })
  }, [document])

  const exportPptx = (): void => {
    setExporting(true)
    downloadPptx(deck.source, preset, meta.title)
      .then(() => deck.setStatus('Exported. Fragments and code steps are shown whole in the file.'))
      .catch(() => deck.setStatus('Couldn’t export this deck. A picture on another site may not allow downloads.'))
      .finally(() => setExporting(false))
  }

  const actions = (
    <DeckActions
      sourceOpen={showSource}
      onToggleSource={() => setShowSource(!showSource)}
      count={meta.count}
      canReset={deck.source !== SAMPLE_DECK}
      streaming={stream.shown !== undefined}
      exporting={exporting}
      onStream={stream.start}
      onShare={() => void shareDeck(deck.encodedNow(), deck.setStatus)}
      onPresenter={() => void openPresenterWindow(deck.encodedNow, deck.setStatus)}
      onExport={exportPptx}
      onReset={deck.reset}
    />
  )

  return (
    <ActivityScope feature="slides-workbench">
      <main className={SHELL} data-panel={showSource ? 'source' : 'closed'}>
        <div className="flex h-[var(--rmk-demo-height,100dvh)] flex-col border-b border-border print:hidden">
          {deck.notice === undefined ? null : (
            <Text size="sm" tone="warning" className="m-0 border-b border-border bg-warning/10 px-4 py-2 print:hidden">
              {deck.notice}
            </Text>
          )}
          {deck.restoredNotice ? (
            <Text size="sm" className="m-0 flex flex-wrap items-center gap-x-2 border-b border-border bg-muted px-4 py-2 print:hidden">
              This is the deck you edited last time in this browser.
              <Button variant="link" size="sm" track="open-sample" className="h-auto p-0" onClick={deck.reset}>
                Open the sample deck
              </Button>
            </Text>
          ) : null}

          <div
            style={{ '--source-width': `${sourceWidth}%` } as CSSProperties}
            className={`grid min-h-0 flex-1 ${
              showSource ? 'grid-cols-1 md:grid-cols-[minmax(260px,var(--source-width))_4px_minmax(0,1fr)]' : 'grid-cols-1'
            }`}
          >
            {showSource && (
              <SourcePane
                value={deck.source}
                onChange={deck.edit}
                className="flex min-h-0 min-w-0 flex-col border-border bg-background max-md:border-b md:border-r"
                head="document-source-header"
                hidden={false}
                highlight={blockSpan ?? spans[index]}
                highlightKey={blockSpan?.start ?? index}
                revealKey={revealKey}
                onClose={() => setShowSource(false)}
                onSelectionChange={(offset) => {
                  const selected = spans.findIndex((span, at) => offset >= span.start && offset < (spans[at + 1]?.start ?? shown.length + 1))
                  if (selected !== -1) setIndex(selected)
                }}
              />
            )}
            {showSource && <SourceDivider value={sourceWidth} onChange={setSourceWidth} />}
            <div className={showSource ? 'min-h-0 min-w-0 max-md:hidden' : 'min-h-0 min-w-0'}>
              <SlideCanvas
                value={shown}
                {...(stream.shown === undefined ? { onChange: deck.edit } : {})}
                preset={preset}
                index={index}
                onIndexChange={setIndex}
                onBlockSelect={setBlockSpan}
                onRevealSource={() => { setShowSource(true); setRevealKey((key) => key + 1) }}
                onPresent={(at) =>
                  controller.dispatch({
                    type: 'enter',
                    mode: 'present',
                    index: at,
                  })
                }
                actions={actions}
                className="min-w-0"
              >
                {deck.status === '' ? null : (
                  <output
                    aria-live="polite"
                    className="absolute top-3 left-1/2 z-[4] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-md"
                  >
                    {deck.status}
                    {deck.canUndo && (
                      <Button variant="link" size="sm" track="undo-reset" className="h-auto p-0 text-xs" onClick={deck.undoReset}>
                        Undo
                      </Button>
                    )}
                  </output>
                )}
              </SlideCanvas>
            </div>
          </div>
        </div>

        <article className="document-reading">
          <MarkdownDocument source={readingSource(shown)} />
        </article>
        <div className="document-presentation">
          <DeckPane
            preset={preset}
            document={document}
            deckRef={deckRef}
            className="document-deck"
            head="hidden"
            hidden={false}
            streaming={stream.shown !== undefined}
          />
        </div>
      </main>
    </ActivityScope>
  )
}
