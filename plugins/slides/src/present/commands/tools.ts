/** Pointer tools: drawing on the current slide, and a laser dot. While one is on, a click no longer turns the slide. */
import { drawIcon, laserIcon } from '../control-icons.js'
import type { DeckCommandSpec } from './command.js'

export const drawCommand = {
  id: 'draw',
  icon: drawIcon,
  keys: ['d'],
  label: (labels) => labels.draw,
  run: ({ controller }) => controller.dispatch({ type: 'toggle-tool', tool: 'draw' }),
} as const satisfies DeckCommandSpec<'draw'>

export const laserCommand = {
  id: 'laser',
  icon: laserIcon,
  keys: ['l'],
  label: (labels) => labels.laser,
  run: ({ controller }) => controller.dispatch({ type: 'toggle-tool', tool: 'laser' }),
} as const satisfies DeckCommandSpec<'laser'>

export const clearDrawingCommand = {
  id: 'clear-drawing',
  keys: ['x'],
  label: (labels) => labels.clearDrawing,
  run: ({ clearDrawing }) => clearDrawing(),
} as const satisfies DeckCommandSpec<'clear-drawing'>
