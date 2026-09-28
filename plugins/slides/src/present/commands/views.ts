/** Entering, leaving and changing what the audience sees. */
import { fullscreenSupported, toggleFullscreen } from '../fullscreen.js'
import { exitIcon, fullscreenIcon, helpIcon, overviewIcon, presenterIcon } from '../control-icons.js'
import type { DeckCommandSpec } from './command.js'

export const presentCommand = {
  id: 'present',
  keys: [],
  label: (labels) => labels.present,
  run: ({ controller }) => controller.dispatch({ type: 'enter', mode: 'present' }),
} as const satisfies DeckCommandSpec<'present'>

export const exitCommand = {
  id: 'exit',
  icon: exitIcon,
  keys: ['Escape'],
  label: (labels) => labels.exit,
  run: ({ controller }) => controller.dispatch({ type: 'exit' }),
} as const satisfies DeckCommandSpec<'exit'>

export const presenterCommand = {
  id: 'presenter',
  icon: presenterIcon,
  keys: ['p'],
  label: (labels) => labels.presenter,
  run: ({ controller }) => controller.dispatch({ type: 'toggle-presenter' }),
} as const satisfies DeckCommandSpec<'presenter'>

export const fullscreenCommand = {
  id: 'fullscreen',
  icon: fullscreenIcon,
  keys: ['f'],
  label: (labels) => labels.fullscreen,
  run: ({ element }) => {
    if (element !== null) toggleFullscreen(element)
  },
  available: ({ element }) => fullscreenSupported(element),
} as const satisfies DeckCommandSpec<'fullscreen'>

export const overviewCommand = {
  id: 'overview',
  icon: overviewIcon,
  keys: ['o'],
  label: (labels) => labels.overview,
  run: ({ controller }) => controller.dispatch({ type: 'toggle-overlay', overlay: 'overview' }),
} as const satisfies DeckCommandSpec<'overview'>

export const helpCommand = {
  id: 'help',
  icon: helpIcon,
  keys: ['?', 'h'],
  label: (labels) => labels.help,
  run: ({ controller }) => controller.dispatch({ type: 'toggle-overlay', overlay: 'help' }),
} as const satisfies DeckCommandSpec<'help'>

export const blackoutCommand = {
  id: 'blackout',
  keys: ['b', '.'],
  label: (labels) => labels.blackout,
  run: ({ controller }) => controller.dispatch({ type: 'toggle-overlay', overlay: 'blackout' }),
} as const satisfies DeckCommandSpec<'blackout'>

export const cloneCommand = {
  id: 'clone',
  keys: ['c'],
  label: (labels) => labels.clone,
  run: ({ clone }) => clone?.(),
  available: ({ clone }) => clone !== undefined,
} as const satisfies DeckCommandSpec<'clone'>
