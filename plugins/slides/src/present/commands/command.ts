/**
 * The contract every deck command implements. A command is what a key, a
 * control button or the help list refers to: it names its default keys,
 * its label, what it does, and when it is on offer. Registering a spec in
 * `registry.ts` wires it to the keyboard, the help overlay and any control
 * bar that lists its id.
 */
import type { ReactElement } from 'react'
import type { SlidesLabels } from '../labels.js'
import type { DeckController } from '../state/controller.js'
import type { DeckState } from '../state/deck-state.js'

export interface CommandContext {
  readonly controller: DeckController
  readonly state: DeckState
  /** The deck's <article>; null before it mounts. */
  readonly element: HTMLElement | null
  readonly resetTimer: () => void
  readonly clearDrawing: () => void
  readonly scaleNotes: (step: 1 | -1) => void
  /** Opens a synced window; undefined when the deck has no sync channel. */
  readonly clone: (() => void) | undefined
}

export interface DeckCommandSpec<Id extends string = string> {
  readonly id: Id
  /** `KeyboardEvent.key` values; empty for a command with no key. */
  readonly keys: readonly string[]
  readonly label: (labels: SlidesLabels) => string
  /** What a control bar button for it shows; the label stays its accessible name. */
  readonly icon?: ReactElement
  readonly run: (context: CommandContext) => void
  /** False ignores the key and hides the command. Default: always on offer. */
  readonly available?: (context: CommandContext) => boolean
}
