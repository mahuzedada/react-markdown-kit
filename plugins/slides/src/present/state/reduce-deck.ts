/**
 * Every deck transition, as a registry of one reducer per action type. A
 * pure function so every transition is testable without React. A new action
 * is a new reducer module registered here.
 */
import type { DeckAction, DeckActionType, DeckReducer, DeckShape, DeckState } from './deck-state.js'
import { choose, toggleOverlay, toggleTool } from './layers.js'
import { enter, exit, togglePresenter } from './modes.js'
import { clampToShape, first, goto, last, next, previous } from './navigation.js'

const REDUCERS: { readonly [Type in DeckActionType]: DeckReducer<Type> } = {
  enter,
  exit,
  'toggle-presenter': togglePresenter,
  next,
  previous,
  first,
  last,
  goto,
  clamp: clampToShape,
  'toggle-overlay': toggleOverlay,
  choose,
  'toggle-tool': toggleTool,
}

export function reduceDeck(state: DeckState, action: DeckAction, shape: DeckShape): DeckState {
  const reducer = REDUCERS[action.type] as DeckReducer<typeof action.type>
  return reducer(state, action as never, shape)
}
