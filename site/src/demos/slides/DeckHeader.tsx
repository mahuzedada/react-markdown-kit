import type { ReactNode } from 'react'
import Badge from '@zuilib/primitives/badge'
import Button from '@zuilib/primitives/button'
import Heading from '@zuilib/primitives/heading'

export interface DeckHeaderProps {
  readonly title: string
  readonly count: number
  readonly problems: number
  /** The worst parser note: warnings turn the badge amber. */
  readonly warning: boolean
  readonly status: string
  readonly canUndo: boolean
  readonly canReset: boolean
  readonly streaming: boolean
  readonly exporting: boolean
  readonly onPresent: () => void
  readonly onStream: () => void
  readonly onShare: () => void
  readonly onPresenter: () => void
  readonly onExport: () => void
  readonly onReset: () => void
  readonly onUndo: () => void
}

/**
 * The workbench header: the deck's title as the renderer read it, its
 * slide count and parser notes, and the actions. Present and Stream drive
 * the deck on this page; the rest leave it (a link, a window, a file).
 */
export default function DeckHeader(props: DeckHeaderProps): ReactNode {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5 print:hidden">
      <Heading as="h2" size="md" truncate className="m-0 mr-1 max-w-md min-w-0 leading-snug">
        {props.title === '' ? 'Untitled deck' : props.title}
      </Heading>
      <Badge variant="subtle" tone="success" size="sm" className="whitespace-nowrap">
        {props.count} {props.count === 1 ? 'slide' : 'slides'}
      </Badge>
      <Badge variant="subtle" tone={props.warning ? 'warning' : 'success'} size="sm" className="whitespace-nowrap">
        {props.problems === 0 ? 'no problems' : `${props.problems} ${props.problems === 1 ? 'note' : 'notes'} from the parser`}
      </Badge>
      <div className="ml-auto flex flex-wrap gap-1.5" role="group" aria-label="Deck actions">
        <Button size="sm" track="present" disabled={props.count === 0} onClick={props.onPresent}>
          Present
        </Button>
        <Button variant="outline" size="sm" track="stream" disabled={props.count === 0} onClick={props.onStream}>
          {props.streaming ? 'Restart stream' : 'Stream it'}
        </Button>
        <Button variant="outline" size="sm" track="share" onClick={props.onShare}>
          Share
        </Button>
        <Button variant="outline" size="sm" track="presenter-window" onClick={props.onPresenter}>
          Presenter window
        </Button>
        <Button variant="outline" size="sm" track="print" onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="outline" size="sm" track="export-pptx" disabled={props.exporting || props.count === 0} onClick={props.onExport}>
          {props.exporting ? 'Exporting…' : 'Export .pptx'}
        </Button>
        <Button variant="ghost" size="sm" track="reset" disabled={!props.canReset} onClick={props.onReset}>
          Reset
        </Button>
      </div>
      <output className="flex min-h-0 basis-full items-center gap-2 text-sm text-foreground empty:hidden" aria-live="polite">
        {props.status}
        {props.status !== '' && props.canUndo ? (
          <Button variant="link" size="sm" track="undo-reset" className="h-auto p-0" onClick={props.onUndo}>
            Undo
          </Button>
        ) : null}
      </output>
    </header>
  )
}
