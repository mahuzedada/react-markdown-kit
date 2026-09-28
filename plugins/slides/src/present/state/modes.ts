/**
 * Entering and leaving present mode. `exit` peels one layer at a time, the
 * way Escape does: an overlay first, then a pointer tool, then the mode.
 */
import type { DeckReducer, DeckState } from './deck-state.js'
import { at } from './position.js'

export const enter: DeckReducer<'enter'> = (state, action, shape) => {
  if (shape.count === 0) return state
  const moved = action.index === undefined ? at(state, shape, state.index, state.fragment) : at(state, shape, action.index, action.fragment ?? 0)
  return moved.mode === action.mode ? moved : { ...moved, mode: action.mode }
}

export const exit: DeckReducer<'exit'> = (state) => {
  if (state.overlay !== undefined) return without(state, 'overlay')
  if (state.tool !== undefined) return without(state, 'tool')
  return state.mode === 'stack' ? state : { ...state, mode: 'stack' }
}

export const togglePresenter: DeckReducer<'toggle-presenter'> = (state) =>
  state.mode === 'stack' ? state : { ...state, mode: state.mode === 'presenter' ? 'present' : 'presenter' }

export function without(state: DeckState, key: 'overlay' | 'tool'): DeckState {
  const { [key]: _removed, ...rest } = state
  return rest
}
