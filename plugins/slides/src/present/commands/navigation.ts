/** Moving through the deck. Space and Shift+Space are handled by the keyboard module, which knows about modifiers. */
import { nextIcon, previousIcon } from '../control-icons.js'
import type { DeckCommandSpec } from './command.js'

export const nextCommand = {
  id: 'next',
  icon: nextIcon,
  keys: ['ArrowRight', 'ArrowDown', 'PageDown', 'j'],
  label: (labels) => labels.next,
  run: ({ controller }) => controller.dispatch({ type: 'next' }),
} as const satisfies DeckCommandSpec<'next'>

export const previousCommand = {
  id: 'previous',
  icon: previousIcon,
  keys: ['ArrowLeft', 'ArrowUp', 'PageUp', 'k'],
  label: (labels) => labels.previous,
  run: ({ controller }) => controller.dispatch({ type: 'previous' }),
} as const satisfies DeckCommandSpec<'previous'>

export const firstCommand = {
  id: 'first',
  keys: ['Home'],
  label: (labels) => labels.first,
  run: ({ controller }) => controller.dispatch({ type: 'first' }),
} as const satisfies DeckCommandSpec<'first'>

export const lastCommand = {
  id: 'last',
  keys: ['End'],
  label: (labels) => labels.last,
  run: ({ controller }) => controller.dispatch({ type: 'last' }),
} as const satisfies DeckCommandSpec<'last'>
