/**
 * Keys and pointer, only while presenting and only on the deck element.
 * Clicks and swipes turn slides unless an overlay or a pointer tool has the
 * pointer; in the overview a click picks the slide under it.
 */
import { useEffect, useRef, type RefObject } from 'react'
import type { DeckCommand } from '../commands/registry.js'
import { attachKeyboard } from '../keyboard.js'
import { attachPointer } from '../pointer.js'
import type { DeckController } from '../state/controller.js'
import type { DeckState } from '../state/deck-state.js'

export interface DeckInput {
  readonly run: (command: DeckCommand) => boolean
  readonly setTyped: (typed: string) => void
}

export function useDeckInput(ref: RefObject<HTMLElement | null>, controller: DeckController, state: DeckState, input: DeckInput): void {
  const live = state.mode !== 'stack'
  const latest = useRef(input)
  latest.current = input

  useEffect(() => {
    const element = ref.current
    if (!live || element === null) return
    return attachKeyboard(element, {
      onCommand: (command) => latest.current.run(command),
      onGoto: (slide) => controller.dispatch({ type: 'goto', index: slide - 1 }),
      onTyping: (typed) => latest.current.setTyped(typed),
    })
  }, [ref, live, controller])

  const pointerFree = state.overlay === undefined && state.tool === undefined
  useEffect(() => {
    const element = ref.current
    if (!live || !pointerFree || element === null) return
    return attachPointer(element, { next: () => controller.dispatch({ type: 'next' }), previous: () => controller.dispatch({ type: 'previous' }) })
  }, [ref, live, pointerFree, controller])

  const overview = live && state.overlay === 'overview'
  useEffect(() => {
    const element = ref.current
    if (!overview || element === null) return
    const onClick = (event: MouseEvent): void => {
      const tile = event.target instanceof Element ? event.target.closest('[data-rmk-slide]') : null
      if (tile === null || !element.contains(tile)) return
      controller.dispatch({ type: 'choose', index: Number(tile.getAttribute('data-rmk-slide')) - 1 })
    }
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [ref, overview, controller])
}
