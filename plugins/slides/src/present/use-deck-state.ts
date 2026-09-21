/**
 * Where the deck is: which mode, which slide, how many fragments of it are
 * shown. A pure reducer so every transition is testable without React, and
 * every no-op transition returns the same object so React bails out of the
 * re-render (the sync channel relies on that: a message that says where the
 * deck already is must not echo).
 *
 * The bounds (slide count, fragments per slide) come from the rendered
 * sections and are passed with the reducer rather than stored, so a deck
 * whose Markdown changes under it stays consistent without a state reset.
 * A deck with no slides has nothing to present: `enter` is refused and a
 * `clamp` that finds the deck empty leaves present mode.
 */
import { useCallback, useReducer, type Dispatch } from 'react'

export type DeckMode = 'stack' | 'present' | 'presenter'

export interface DeckState {
  readonly mode: DeckMode
  /** Zero-based slide index */
  readonly index: number
  /** Fragments of the current slide already revealed */
  readonly fragment: number
}

export interface DeckShape {
  readonly count: number
  /** Fragment count per slide, same order as the sections */
  readonly fragments: readonly number[]
}

export type DeckAction =
  | { readonly type: 'enter'; readonly mode: 'present' | 'presenter'; readonly index?: number }
  | { readonly type: 'exit' }
  | { readonly type: 'toggle-presenter' }
  | { readonly type: 'next' }
  | { readonly type: 'previous' }
  | { readonly type: 'first' }
  | { readonly type: 'last' }
  | { readonly type: 'goto'; readonly index: number; readonly fragment?: number }
  /** Re-clamps after the sections changed */
  | { readonly type: 'clamp' }

export const INITIAL_DECK_STATE: DeckState = { mode: 'stack', index: 0, fragment: 0 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function fragmentsOf(shape: DeckShape, index: number): number {
  return shape.fragments[index] ?? 0
}

function at(state: DeckState, shape: DeckShape, index: number, fragment: number): DeckState {
  const nextIndex = clamp(index, 0, shape.count - 1)
  const nextFragment = clamp(fragment, 0, fragmentsOf(shape, nextIndex))
  return nextIndex === state.index && nextFragment === state.fragment ? state : { ...state, index: nextIndex, fragment: nextFragment }
}

export function reduceDeck(state: DeckState, action: DeckAction, shape: DeckShape): DeckState {
  switch (action.type) {
    case 'enter': {
      if (shape.count === 0) return state
      const moved = action.index === undefined ? at(state, shape, state.index, state.fragment) : at(state, shape, action.index, 0)
      return moved.mode === action.mode ? moved : { ...moved, mode: action.mode }
    }
    case 'exit':
      return state.mode === 'stack' ? state : { ...state, mode: 'stack' }
    case 'toggle-presenter':
      return state.mode === 'stack' ? state : { ...state, mode: state.mode === 'presenter' ? 'present' : 'presenter' }
    case 'next':
      return state.fragment < fragmentsOf(shape, state.index)
        ? at(state, shape, state.index, state.fragment + 1)
        : state.index < shape.count - 1
          ? at(state, shape, state.index + 1, 0)
          : state
    case 'previous':
      return state.fragment > 0
        ? at(state, shape, state.index, state.fragment - 1)
        : state.index > 0
          ? at(state, shape, state.index - 1, fragmentsOf(shape, state.index - 1))
          : state
    case 'first':
      return at(state, shape, 0, 0)
    case 'last':
      return at(state, shape, shape.count - 1, fragmentsOf(shape, shape.count - 1))
    case 'goto':
      return at(state, shape, action.index, action.fragment ?? 0)
    case 'clamp': {
      const clamped = at(state, shape, state.index, state.fragment)
      return shape.count === 0 && clamped.mode !== 'stack' ? { ...clamped, mode: 'stack' } : clamped
    }
  }
}

/** True at the very end of the deck: last slide, every fragment shown. */
export function atEnd(state: DeckState, shape: DeckShape): boolean {
  return state.index >= shape.count - 1 && state.fragment >= fragmentsOf(shape, state.index)
}

export function atStart(state: DeckState): boolean {
  return state.index === 0 && state.fragment === 0
}

export function useDeckState(shape: DeckShape): [DeckState, Dispatch<DeckAction>] {
  const reducer = useCallback((state: DeckState, action: DeckAction) => reduceDeck(state, action, shape), [shape])
  return useReducer(reducer, INITIAL_DECK_STATE)
}
