/**
 * Moving within the bounds. Every no-op returns the same state object so
 * React bails out of the re-render (the sync channel relies on that: a
 * message that says where the deck already is must not echo).
 */
import type { DeckShape, DeckState } from './deck-state.js'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function fragmentsOf(shape: DeckShape, index: number): number {
  return shape.fragments[index] ?? 0
}

/** The state at slide `index`, fragment `fragment`, both clamped; the same object when nothing moves. */
export function at(state: DeckState, shape: DeckShape, index: number, fragment: number): DeckState {
  const nextIndex = clamp(index, 0, shape.count - 1)
  const nextFragment = clamp(fragment, 0, fragmentsOf(shape, nextIndex))
  if (nextIndex === state.index && nextFragment === state.fragment) return state
  const direction = nextIndex === state.index ? state.direction : nextIndex > state.index ? 'forward' : 'backward'
  return { ...state, index: nextIndex, fragment: nextFragment, direction }
}

/** True at the very end of the deck: last slide, every fragment shown. */
export function atEnd(state: DeckState, shape: DeckShape): boolean {
  return state.index >= shape.count - 1 && state.fragment >= fragmentsOf(shape, state.index)
}

export function atStart(state: DeckState): boolean {
  return state.index === 0 && state.fragment === 0
}
