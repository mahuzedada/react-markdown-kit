/** Moving through the deck: one step (a fragment, else a slide), to either end, to a place, or back into bounds. */
import type { DeckReducer } from './deck-state.js'
import { without } from './modes.js'
import { at, fragmentsOf } from './position.js'

export const next: DeckReducer<'next'> = (state, _action, shape) => {
  if (state.fragment < fragmentsOf(shape, state.index)) return at(state, shape, state.index, state.fragment + 1)
  return state.index < shape.count - 1 ? at(state, shape, state.index + 1, 0) : state
}

export const previous: DeckReducer<'previous'> = (state, _action, shape) => {
  if (state.fragment > 0) return at(state, shape, state.index, state.fragment - 1)
  return state.index > 0 ? at(state, shape, state.index - 1, fragmentsOf(shape, state.index - 1)) : state
}

export const first: DeckReducer<'first'> = (state, _action, shape) => at(state, shape, 0, 0)

export const last: DeckReducer<'last'> = (state, _action, shape) => at(state, shape, shape.count - 1, fragmentsOf(shape, shape.count - 1))

export const goto: DeckReducer<'goto'> = (state, action, shape) => at(state, shape, action.index, action.fragment ?? 0)

/** A deck with no slides has nothing to present: a clamp that finds it empty leaves present mode. */
export const clampToShape: DeckReducer<'clamp'> = (state, _action, shape) => {
  const clamped = at(state, shape, state.index, state.fragment)
  return shape.count === 0 && clamped.mode !== 'stack' ? { ...without(without(clamped, 'overlay'), 'tool'), mode: 'stack' } : clamped
}
