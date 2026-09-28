/** The presenter's own controls: the timer and the notes' size. Only on offer in the presenter view, where they show. */
import type { CommandContext, DeckCommandSpec } from './command.js'

const inPresenter = ({ state }: CommandContext): boolean => state.mode === 'presenter'

export const resetTimerCommand = {
  id: 'reset-timer',
  keys: ['t'],
  label: (labels) => labels.resetTimer,
  run: ({ resetTimer }) => resetTimer(),
  available: inPresenter,
} as const satisfies DeckCommandSpec<'reset-timer'>

export const notesLargerCommand = {
  id: 'notes-larger',
  keys: ['+', '='],
  label: (labels) => labels.notesLarger,
  run: ({ scaleNotes }) => scaleNotes(1),
  available: inPresenter,
} as const satisfies DeckCommandSpec<'notes-larger'>

export const notesSmallerCommand = {
  id: 'notes-smaller',
  keys: ['-'],
  label: (labels) => labels.notesSmaller,
  run: ({ scaleNotes }) => scaleNotes(-1),
  available: inPresenter,
} as const satisfies DeckCommandSpec<'notes-smaller'>
