/** Subscribes a component to a deck controller: it re-renders whenever the deck moves. */
import { useSyncExternalStore } from 'react'
import type { DeckController } from './controller.js'
import { INITIAL_DECK_STATE, type DeckState } from './deck-state.js'

export function useDeck(controller: DeckController): DeckState {
  return useSyncExternalStore(controller.subscribe, controller.getState, () => INITIAL_DECK_STATE)
}
