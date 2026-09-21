/**
 * The Fullscreen API, feature-detected. `f` and the button toggle it on the
 * deck element; leaving fullscreen (Escape, the browser's own control) keeps
 * present mode, and leaving present mode leaves fullscreen.
 */
export function fullscreenSupported(element: Element | null): boolean {
  return element !== null && typeof element.requestFullscreen === 'function'
}

export function isFullscreen(element: Element): boolean {
  return typeof document !== 'undefined' && document.fullscreenElement === element
}

export function toggleFullscreen(element: Element): void {
  if (isFullscreen(element)) {
    exitFullscreen(element)
    return
  }
  if (typeof element.requestFullscreen !== 'function') return
  try {
    const result: unknown = element.requestFullscreen()
    if (result instanceof Promise) result.catch(() => undefined)
  } catch {
    // Denied (no user gesture, sandboxed frame); the deck stays in the page.
  }
}

export function exitFullscreen(element: Element): void {
  if (!isFullscreen(element) || typeof document.exitFullscreen !== 'function') return
  try {
    const result: unknown = document.exitFullscreen()
    if (result instanceof Promise) result.catch(() => undefined)
  } catch {
    // Already left; nothing to undo.
  }
}
