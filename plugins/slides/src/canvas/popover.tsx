/**
 * A button that opens a small panel under (or over) it: the zoom choices,
 * the image form, the parser notes. Escape or a press outside closes it.
 */
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'

export interface PopoverProps {
  readonly label: string
  readonly button: ReactNode
  /** Where the panel opens from the button. */
  readonly placement: 'below-start' | 'below-end' | 'above-end'
  readonly children: (close: () => void) => ReactNode
  /** Keeps the inline editor's selection when the button is pressed. */
  readonly keepFocus?: boolean
}

export function Popover({ label, button, placement, children, keepFocus = false }: PopoverProps): ReactElement {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div data-rmk-canvas-popover="" ref={root}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onMouseDown={keepFocus ? (event) => event.preventDefault() : undefined}
        onClick={() => setOpen(!open)}
      >
        {button}
      </button>
      {open ? (
        <div role="dialog" aria-label={label} data-rmk-canvas-panel={placement}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  )
}

export interface CanvasMenuItem {
  readonly label: string
  readonly onSelect: () => void
  readonly disabled?: boolean
}

export interface CanvasMenuProps {
  readonly label: string
  readonly button: ReactNode
  readonly items: readonly CanvasMenuItem[]
}

/** A menu in the canvas's style, for a host's own actions in the top-right bar. */
export function CanvasMenu({ label, button, items }: CanvasMenuProps): ReactElement {
  return (
    <Popover label={label} button={button} placement="below-end">
      {(close) => (
        <div role="group" data-rmk-canvas-menu="">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                close()
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}
