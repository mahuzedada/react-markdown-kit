/**
 * The deck's controller (the one from the options, or its own) and the
 * state it holds. The rendered bounds are reported on every change of the
 * sections, before any other effect of the deck runs, so an opening
 * `enter` already knows the slides.
 */
import { useEffect, useState } from 'react'
import { createDeckController, type DeckController } from '../state/controller.js'
import type { DeckShape, DeckState } from '../state/deck-state.js'
import { useDeck } from '../state/use-deck.js'

export function useDeckController(given: DeckController | undefined, shape: DeckShape): [DeckController, DeckState] {
  const [controller] = useState(() => given ?? createDeckController())
  useEffect(() => {
    controller.setShape(shape)
  }, [controller, shape])
  return [controller, useDeck(controller)]
}
