import { useRef, type ReactElement } from 'react'

/** Pointer and keyboard resizing share one bounded percentage. */
export default function SourceDivider({ value, onChange }: {
  readonly value: number
  readonly onChange: (value: number) => void
}): ReactElement {
  const dragging = useRef(false)
  const update = (next: number): void => onChange(Math.max(24, Math.min(55, next)))
  return <div
    role="separator"
    aria-label="Resize Markdown source"
    aria-orientation="vertical"
    aria-valuemin={24}
    aria-valuemax={55}
    aria-valuenow={Math.round(value)}
    tabIndex={0}
    className="z-10 w-1 cursor-col-resize touch-none bg-border transition-colors hover:bg-primary focus-visible:bg-primary focus-visible:outline-none max-md:hidden"
    onPointerDown={(event) => {
      dragging.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    }}
    onPointerMove={(event) => {
      if (!dragging.current) return
      const bounds = event.currentTarget.parentElement!.getBoundingClientRect()
      update((event.clientX - bounds.left) / bounds.width * 100)
    }}
    onPointerUp={(event) => {
      dragging.current = false
      event.currentTarget.releasePointerCapture(event.pointerId)
    }}
    onLostPointerCapture={() => { dragging.current = false }}
    onKeyDown={(event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()
      update(event.key === 'Home' ? 24 : event.key === 'End' ? 55 : value + (event.key === 'ArrowLeft' ? -2 : 2))
    }}
  />
}
