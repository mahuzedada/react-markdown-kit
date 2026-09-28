/**
 * Focus while presenting. Entering takes the focus so the keys work at
 * once; leaving gives fullscreen back, scrolls to the slide and keeps the
 * focus in the deck (the Exit button that held it is gone from the DOM).
 * Moving off a slide that held the focus makes that slide inert, and the
 * browser drops the focus onto the body; the deck takes it back.
 */
import { useEffect, useRef, type RefObject } from 'react'
import { exitFullscreen } from '../fullscreen.js'

/** True while the focus is inside the deck and on a slide that can hold it (not an inert one). */
function holdsFocus(element: HTMLElement): boolean {
  const active = document.activeElement
  return active !== null && element.contains(active) && active.closest('[inert]') === null
}

export function useDeckFocus(ref: RefObject<HTMLElement | null>, live: boolean, index: number): void {
  const position = useRef(index)
  position.current = index

  useEffect(() => {
    const element = ref.current
    if (!live || element === null) return
    element.focus({ preventScroll: true })
    return () => {
      exitFullscreen(element)
      if (element.isConnected && !holdsFocus(element)) element.focus({ preventScroll: true })
      const slide = element.querySelector<HTMLElement>(
        `[data-rmk-slide="${position.current + 1}"]:not([data-rmk-slide-print-step]):not([data-rmk-slide-preview])`,
      )
      if (slide !== null && typeof slide.scrollIntoView === 'function') slide.scrollIntoView({ block: 'nearest' })
    }
  }, [ref, live])

  useEffect(() => {
    const element = ref.current
    if (live && element !== null && !holdsFocus(element)) element.focus({ preventScroll: true })
  }, [ref, live, index])
}
