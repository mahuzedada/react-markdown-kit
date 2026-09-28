/**
 * The component each overlay draws over the deck. The overview and the
 * black screen are the stylesheet's alone (the article's
 * `data-rmk-deck-overlay`), so only the help list has one; a new overlay
 * with a view is a new entry here.
 */
import type { ComponentType } from 'react'
import type { CommandContext } from '../commands/command.js'
import type { SlidesLabels } from '../labels.js'
import type { DeckOverlay } from '../state/deck-state.js'
import { HelpOverlay } from './help-overlay.js'

export interface OverlayViewProps {
  readonly labels: SlidesLabels
  readonly context: CommandContext
  /** Gives the focus back to the deck when the overlay closes. */
  readonly onClose: () => void
}

export const OVERLAY_VIEWS: Readonly<Partial<Record<DeckOverlay, ComponentType<OverlayViewProps>>>> = {
  help: HelpOverlay,
}
