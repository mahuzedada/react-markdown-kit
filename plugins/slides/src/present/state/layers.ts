/** Overlays (overview, help, blackout) and pointer tools (draw, laser): one of each at a time, only while presenting. */
import type { DeckReducer } from './deck-state.js'
import { without } from './modes.js'
import { at } from './position.js'

export const toggleOverlay: DeckReducer<'toggle-overlay'> = (state, action) => {
  if (state.mode === 'stack') return state
  return state.overlay === action.overlay ? without(state, 'overlay') : { ...state, overlay: action.overlay }
}

export const choose: DeckReducer<'choose'> = (state, action, shape) => without(at(state, shape, action.index, 0), 'overlay')

export const toggleTool: DeckReducer<'toggle-tool'> = (state, action) => {
  if (state.mode === 'stack') return state
  return state.tool === action.tool ? without(state, 'tool') : { ...state, tool: action.tool }
}
