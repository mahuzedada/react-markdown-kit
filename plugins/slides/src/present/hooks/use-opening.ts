/**
 * Mount and deep links. On mount, a deep link (`hashRouting`) or
 * `initialMode` opens the deck; from then on the hash follows the deck
 * while it presents.
 */
import { useEffect, useRef } from 'react'
import { currentHash, positionFromHash, writeSlideHash } from '../hash.js'
import type { ResolvedPresentOptions } from '../options.js'
import type { DeckController } from '../state/controller.js'
import type { DeckState } from '../state/deck-state.js'

export function useOpening(options: ResolvedPresentOptions, controller: DeckController, names: readonly (string | undefined)[]): void {
  const namesRef = useRef(names)
  namesRef.current = names
  const { hashRouting, initialMode } = options
  useEffect(() => {
    const linked = hashRouting ? positionFromHash(currentHash(), namesRef.current) : undefined
    const opening = initialMode === 'stack' ? undefined : initialMode
    if (linked !== undefined) controller.dispatch({ type: 'enter', mode: opening ?? 'present', index: linked.index, fragment: linked.fragment })
    else if (opening !== undefined) controller.dispatch({ type: 'enter', mode: opening })
  }, [controller, hashRouting, initialMode])
}

export function useHashWriting(hashRouting: boolean, state: DeckState): void {
  const live = state.mode !== 'stack'
  useEffect(() => {
    if (hashRouting && live) writeSlideHash(state.index, state.fragment)
  }, [hashRouting, live, state.index, state.fragment])
}
