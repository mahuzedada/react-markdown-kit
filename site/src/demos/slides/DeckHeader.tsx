import type { ReactNode } from 'react'

export interface DeckHeaderProps {
  readonly sourceOpen: boolean
  readonly onToggleSource: () => void
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
  return <header className="document-bar print:hidden">
    <span className="document-note">{props.count} slides</span>
    <div className="document-actions" role="group" aria-label="Deck actions">
      <button disabled={props.count === 0} onClick={props.onPresent}>Present</button>
      <button aria-pressed={props.sourceOpen} onClick={props.onToggleSource}>Source</button>
      <button onClick={props.onShare}>Copy link</button>
      <details className="document-more">
        <summary>More</summary>
        <div>
          <button disabled={props.count === 0} onClick={props.onStream}>{props.streaming ? 'Restart stream' : 'Stream deck'}</button>
          <button onClick={props.onPresenter}>Presenter window</button>
          <button onClick={() => window.print()}>Print</button>
          <button disabled={props.exporting || props.count === 0} onClick={props.onExport}>{props.exporting ? 'Exporting…' : 'Export PowerPoint'}</button>
          <button disabled={!props.canReset} onClick={props.onReset}>Reset guide</button>
        </div>
      </details>
    </div>
    {props.status && <output className="document-notice" aria-live="polite">{props.status} {props.canUndo && <button onClick={props.onUndo}>Undo</button>}</output>}
  </header>
}
