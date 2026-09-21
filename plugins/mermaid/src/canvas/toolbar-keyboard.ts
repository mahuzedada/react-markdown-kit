/**
 * Ported from @zuilib/text-editor (MIT). APG toolbar keyboard pattern for the
 * canvas's tool row: one Tab stop, arrow keys move between items, Home / End
 * jump to the ends.
 */
import { useCallback, useEffect, useRef, type FocusEvent, type KeyboardEvent, type RefObject } from 'react'

export type ToolbarOrientation = 'horizontal' | 'vertical'

/**
 * Items take part in the roving tabindex by opting in with this attribute.
 * Anything else inside the toolbar (a popover's own buttons) keeps its own
 * focus handling.
 */
export const TOOLBAR_ITEM_ATTRIBUTE = 'data-rmk-diagram-toolbar-item'
const ITEM_SELECTOR = `[${TOOLBAR_ITEM_ATTRIBUTE}]`

/**
 * Index the given key moves focus to, or `null` for keys the toolbar does
 * not handle. Arrow keys follow the toolbar's orientation (and, in RTL
 * layouts, the visual direction); Home / End jump to the ends.
 */
export function nextToolbarIndex(
  key: string,
  index: number,
  count: number,
  orientation: ToolbarOrientation = 'horizontal',
  rtl = false,
): number | null {
  if (count === 0) return null
  const [prev, next] =
    orientation === 'vertical'
      ? ['ArrowUp', 'ArrowDown']
      : rtl
        ? ['ArrowRight', 'ArrowLeft']
        : ['ArrowLeft', 'ArrowRight']
  const current = Math.max(0, index)
  switch (key) {
    case prev:
      return (current - 1 + count) % count
    case next:
      return (current + 1) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/** Enabled items directly owned by the toolbar (popover menus excluded) */
export function toolbarItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter((el) => {
    if ((el as HTMLButtonElement).disabled) return false
    const menu = el.closest('[role="menu"], [role="listbox"]')
    return menu === null || !container.contains(menu)
  })
}

export interface ToolbarKeyboardProps<T extends HTMLElement> {
  readonly ref: RefObject<T | null>
  readonly onKeyDown: (event: KeyboardEvent<T>) => void
  readonly onFocus: (event: FocusEvent<T>) => void
  readonly 'aria-orientation': ToolbarOrientation
}

/** Spread the result onto the `role="toolbar"` element. */
export function useToolbarKeyboard<T extends HTMLElement = HTMLDivElement>(
  orientation: ToolbarOrientation = 'horizontal',
): ToolbarKeyboardProps<T> {
  const ref = useRef<T>(null)
  const activeRef = useRef<HTMLElement | null>(null)
  // Writing direction, measured once the toolbar exists (not per keystroke)
  const rtlRef = useRef(false)

  const setActive = useCallback((item: HTMLElement | null) => {
    const container = ref.current
    if (!container) return
    const items = toolbarItems(container)
    const previous = activeRef.current
    const active =
      item !== null && items.includes(item)
        ? item
        : previous !== null && items.includes(previous)
          ? previous
          : (items[0] ?? null)
    activeRef.current = active
    for (const el of items) el.tabIndex = el === active ? 0 : -1
  }, [])

  useEffect(() => {
    const container = ref.current
    if (!container) return
    rtlRef.current =
      typeof getComputedStyle === 'function' && getComputedStyle(container).direction === 'rtl'
    setActive(null)
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => setActive(null))
    observer.observe(container, { childList: true, subtree: true, attributeFilter: ['disabled'] })
    return () => observer.disconnect()
  }, [setActive])

  const onFocus = useCallback(
    (event: FocusEvent<T>) => {
      const target = event.target as HTMLElement
      if (target !== activeRef.current && target.matches(ITEM_SELECTOR)) setActive(target)
    },
    [setActive],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<T>) => {
      const container = ref.current
      if (!container || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement
      if (!target.matches(ITEM_SELECTOR)) return
      if (target.closest('[role="menu"], [role="listbox"]')) return
      const items = toolbarItems(container)
      const index = items.indexOf(target)
      const next = nextToolbarIndex(event.key, index, items.length, orientation, rtlRef.current)
      if (next === null) return
      const item = items[next]
      if (item === undefined) return
      event.preventDefault()
      setActive(item)
      item.focus()
    },
    [orientation, setActive],
  )

  return { ref, onKeyDown, onFocus, 'aria-orientation': orientation }
}
