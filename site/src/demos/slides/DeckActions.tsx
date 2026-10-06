import type { ReactNode } from 'react'
import { CanvasMenu } from '@react-markdown-kit/slides/canvas'

export interface DeckActionsProps {
  readonly sourceOpen: boolean
  readonly onToggleSource: () => void
  readonly count: number
  readonly canReset: boolean
  readonly streaming: boolean
  readonly exporting: boolean
  readonly onStream: () => void
  readonly onShare: () => void
  readonly onPresenter: () => void
  readonly onExport: () => void
  readonly onReset: () => void
}

function Icon({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

/**
 * The page's own actions, first in the canvas's top-right bar: the deck's
 * Markdown beside the canvas, a link to it, the PowerPoint file and the
 * rest in a menu. Present is the canvas's own button.
 */
export default function DeckActions(props: DeckActionsProps): ReactNode {
  return (
    <>
      <button type="button" aria-pressed={props.sourceOpen} title="Markdown source" onClick={props.onToggleSource}>
        <Icon><path d="M9 8l-4 4 4 4M15 8l4 4-4 4" /></Icon>
        Source
      </button>
      <button type="button" aria-label="Copy link" title="Copy link" onClick={props.onShare}>
        <Icon><path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1" /></Icon>
      </button>
      <button type="button" aria-label="Export PowerPoint" title={props.exporting ? 'Exporting…' : 'Export PowerPoint'} disabled={props.exporting || props.count === 0} onClick={props.onExport}>
        <Icon><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Icon>
      </button>
      <CanvasMenu
        label="More"
        button={<Icon><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Icon>}
        items={[
          { label: props.streaming ? 'Restart stream' : 'Stream deck', onSelect: props.onStream, disabled: props.count === 0 },
          { label: 'Presenter window', onSelect: props.onPresenter },
          { label: 'Print', onSelect: () => window.print() },
          { label: 'Reset guide', onSelect: props.onReset, disabled: !props.canReset },
        ]}
      />
    </>
  )
}
