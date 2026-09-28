/**
 * Reacting to the deck from the outside in: the consumer's `onSlideChange`
 * on a change of slide only, and `follow`, which moves a presenting deck
 * that sat on its last slide to the newest one when more are appended (a
 * deck streaming in from a model: the slide being written is the one to
 * show, even when a chunk brings several).
 */
import { useEffect, useRef } from 'react'
import type { DeckController } from '../state/controller.js'
import type { DeckState } from '../state/deck-state.js'

export function useSlideChange(onSlideChange: ((index: number) => void) | undefined, index: number): void {
  const reported = useRef(index)
  useEffect(() => {
    if (reported.current === index) return
    reported.current = index
    onSlideChange?.(index)
  }, [index, onSlideChange])
}

export function useFollow(follow: boolean, controller: DeckController, state: DeckState, count: number): void {
  const previousCount = useRef(count)
  useEffect(() => {
    const before = previousCount.current
    previousCount.current = count
    if (!follow || state.mode === 'stack' || count <= before || state.index < before - 1) return
    controller.dispatch({ type: 'goto', index: count - 1 })
  }, [follow, controller, count, state.mode, state.index])
}
