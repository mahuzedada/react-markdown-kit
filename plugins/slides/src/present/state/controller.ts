/**
 * The deck's state as an external store. The deck creates one for itself,
 * or uses the one passed as the `controller` option, which is how an app
 * drives a deck and reads where it is from outside the Markdown: its own
 * buttons, a remote, a test. `useDeck(controller)` subscribes a component.
 *
 * The rendered deck reports its bounds with `setShape`; until a deck has
 * mounted the controller knows no slides and refuses to present.
 */
import type { DeckAction, DeckMode, DeckShape, DeckState } from './deck-state.js'
import { INITIAL_DECK_STATE } from './deck-state.js'
import { reduceDeck } from './reduce-deck.js'

export interface DeckController {
  getState(): DeckState
  getShape(): DeckShape
  subscribe(listener: () => void): () => void
  dispatch(action: DeckAction): void
  next(): void
  previous(): void
  goto(index: number, fragment?: number): void
  enter(mode?: Exclude<DeckMode, 'stack'>): void
  exit(): void
  /** Called by the deck when its sections change. */
  setShape(shape: DeckShape): void
}

const NO_SLIDES: DeckShape = { count: 0, fragments: [] }

export function createDeckController(): DeckController {
  let state = INITIAL_DECK_STATE
  let shape = NO_SLIDES
  const listeners = new Set<() => void>()

  const dispatch = (action: DeckAction): void => {
    const nextState = reduceDeck(state, action, shape)
    if (nextState === state) return
    state = nextState
    for (const listener of [...listeners]) listener()
  }

  return {
    getState: () => state,
    getShape: () => shape,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispatch,
    next: () => dispatch({ type: 'next' }),
    previous: () => dispatch({ type: 'previous' }),
    goto: (index, fragment) => dispatch({ type: 'goto', index, ...(fragment === undefined ? {} : { fragment }) }),
    enter: (mode = 'present') => dispatch({ type: 'enter', mode }),
    exit: () => dispatch({ type: 'exit' }),
    setShape: (next) => {
      shape = next
      dispatch({ type: 'clamp' })
    },
  }
}
