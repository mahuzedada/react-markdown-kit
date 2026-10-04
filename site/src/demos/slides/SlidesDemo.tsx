import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { compileMarkdown } from '@react-markdown-kit/renderer'
import MarkdownDocument from '../../components/document/MarkdownDocument'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import Text from '@zuilib/primitives/text'
import DeckHeader from './DeckHeader'
import DeckPane from './DeckPane'
import { downloadPptx } from './export-pptx'
import { loadInitialSource, type InitialSource } from './initial-source'
import { openPresenterWindow, shareDeck } from './link-actions'
import { createDeckSetup, type DeckSetup } from './preset'
import { SAMPLE_DECK } from './sample-deck'
import SourcePane from './SourcePane'
import { readingSource } from './reading-source'
import { readView } from './url-state'
import { useDeckSource } from './use-deck-source'
import { useStreamReplay } from './use-stream-replay'

import '@react-markdown-kit/mermaid/styles.css'
import '@react-markdown-kit/slides/styles.css'

const SHELL = 'document-workbench document-slides'
/**
 * The slides workbench: the deck's Markdown as plain text on the left, the
 * deck it describes on the right, and a header with the deck's title, its
 * problems and the actions. The source lives in React state and is
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

  if (initial === undefined) return <div className={SHELL} aria-busy="true" />
  return <Workbench setup={setup} initial={initial} />
}

interface DeckMeta {
  readonly title: string
  readonly count: number
}

function Workbench({ setup, initial }: { readonly setup: DeckSetup; readonly initial: InitialSource }): ReactNode {
  const { preset, controller } = setup
  const deck = useDeckSource(initial)
  const stream = useStreamReplay(deck.source, controller)
  const [meta, setMeta] = useState<DeckMeta>({ title: '', count: 0 })
  const [showSource, setShowSource] = useState(false)
  const [exporting, setExporting] = useState(false)
  const deckRef = useRef<HTMLDivElement>(null)

  // Compiled once per change: the deck renders from it and the header reads its diagnostics.
  const shown = stream.shown ?? deck.source
  const document = useMemo(() => compileMarkdown(shown, { preset }), [shown, preset])
  const problems = document.diagnostics

  // The header shows what the renderer decided: the deck's title and slide count, before the first paint.
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

  return (
    <ActivityScope feature="slides-workbench">
      <main className={SHELL} data-panel={showSource ? 'source' : 'closed'}>
        <DeckHeader
          title={meta.title}
          sourceOpen={showSource}
          onToggleSource={() => setShowSource(!showSource)}
          count={meta.count}
          problems={problems.length}
          warning={problems.some((problem) => problem.severity !== 'info')}
          status={deck.status}
          canUndo={deck.canUndo}
          canReset={deck.source !== SAMPLE_DECK}
          streaming={stream.shown !== undefined}
          exporting={exporting}
          onPresent={() => controller.enter('present')}
          onStream={stream.start}
          onShare={() => void shareDeck(deck.encodedNow(), deck.setStatus)}
          onPresenter={() => void openPresenterWindow(deck.encodedNow, deck.setStatus)}
          onExport={exportPptx}
          onReset={deck.reset}
          onUndo={deck.undoReset}
        />

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

        <div className="document-layout">
          {showSource && <SourcePane value={deck.source} onChange={deck.edit} className="document-source print:hidden" head="document-source-header" hidden={false} />}
          <article className="document-reading"><MarkdownDocument source={readingSource(shown)} /></article>
        </div>
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
