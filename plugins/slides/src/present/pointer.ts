/**
 * Pointer input in present mode: a click or tap on the right half of the deck
 * goes forward, on the left half back, and a horizontal swipe longer than
 * 40 px does the same. Clicks on controls, links and form fields are left
 * alone. A swipe swallows the click the browser may fire after it (a mouse
 * drag does, a touch pan does not), and the next pointer down forgets it, so
 * a tap after a swipe is never lost. `attachIdle` reports when the pointer
 * has been still for a while, which is how the controls bar fades.
 *
 * Pointer events are used when the browser has them, touch events otherwise;
 * neither is required for the click halves.
 */
export interface PointerHandlers {
  next(): void
  previous(): void
}

export const SWIPE_THRESHOLD = 40

const INTERACTIVE = 'a, button, input, textarea, select, summary, [data-rmk-deck-controls], [data-rmk-deck-presenter]'

interface Point {
  readonly x: number
  readonly y: number
}

function pointOf(event: PointerEvent | TouchEvent): Point | undefined {
  if ('clientX' in event) return { x: event.clientX, y: event.clientY }
  const touch = event.changedTouches[0]
  return touch === undefined ? undefined : { x: touch.clientX, y: touch.clientY }
}

export function attachPointer(element: HTMLElement, handlers: PointerHandlers): () => void {
  let start: Point | undefined
  let swiped = false

  const onDown = (event: PointerEvent | TouchEvent): void => {
    swiped = false
    start = pointOf(event)
  }
  const onUp = (event: PointerEvent | TouchEvent): void => {
    const end = pointOf(event)
    if (start === undefined || end === undefined) return
    const dx = end.x - start.x
    const dy = end.y - start.y
    start = undefined
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return
    swiped = true
    if (dx < 0) handlers.next()
    else handlers.previous()
  }
  const onClick = (event: MouseEvent): void => {
    if (swiped) {
      swiped = false
      return
    }
    if (event.defaultPrevented || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest(INTERACTIVE) !== null) return
    const bounds = element.getBoundingClientRect()
    if (event.clientX - bounds.left >= bounds.width / 2) handlers.next()
    else handlers.previous()
  }

  const pointer = typeof PointerEvent === 'function'
  const down = pointer ? 'pointerdown' : 'touchstart'
  const up = pointer ? 'pointerup' : 'touchend'
  element.addEventListener(down, onDown as EventListener, { passive: true })
  element.addEventListener(up, onUp as EventListener, { passive: true })
  element.addEventListener('click', onClick)
  return () => {
    element.removeEventListener(down, onDown as EventListener)
    element.removeEventListener(up, onUp as EventListener)
    element.removeEventListener('click', onClick)
  }
}

export const IDLE_MS = 2500

/** Calls `onIdle(true)` after `ms` without pointer or key activity, `onIdle(false)` on the next activity. */
export function attachIdle(element: HTMLElement, ms: number, onIdle: (idle: boolean) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let idle = false
  const arm = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      idle = true
      onIdle(true)
    }, ms)
  }
  const wake = (): void => {
    if (idle) {
      idle = false
      onIdle(false)
    }
    arm()
  }
  const events = ['pointermove', 'pointerdown', 'keydown'] as const
  for (const type of events) element.addEventListener(type, wake, { passive: true })
  arm()
  return () => {
    if (timer !== undefined) clearTimeout(timer)
    for (const type of events) element.removeEventListener(type, wake)
  }
}
