/** The controls fade after a still pointer, in plain present mode only. */
import { useEffect, useState, type RefObject } from 'react'
import { IDLE_MS, attachIdle } from '../pointer.js'
import type { DeckMode } from '../state/deck-state.js'

export function useIdle(ref: RefObject<HTMLElement | null>, mode: DeckMode): boolean {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (mode !== 'present' || element === null) {
      setIdle(false)
      return
    }
    return attachIdle(element, IDLE_MS, setIdle)
  }, [ref, mode])
  return idle
}
