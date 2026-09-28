/**
 * Freehand drawing over the current slide (`d`). Strokes are stored in
 * slide coordinates (0 to 1 on each axis), so they stay on the content
 * when the slide is resized, and per slide, so they come back when the
 * talk returns to it. `x` clears the slide's strokes. The layer only takes
 * the pointer while drawing is on; otherwise it is visible and inert.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import type { Stroke } from '../hooks/use-drawings.js'

export interface DrawingLayerProps {
  readonly strokes: readonly Stroke[]
  readonly active: boolean
  readonly onStroke: (stroke: Stroke) => void
}

function pointIn(event: ReactPointerEvent<SVGSVGElement>): readonly [number, number] {
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = bounds.width === 0 ? 0 : (event.clientX - bounds.left) / bounds.width
  const y = bounds.height === 0 ? 0 : (event.clientY - bounds.top) / bounds.height
  return [x, y]
}

function path(stroke: Stroke): string {
  return stroke.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(4)} ${y.toFixed(4)}`).join(' ')
}

export function DrawingLayer({ strokes, active, onStroke }: DrawingLayerProps): ReactElement | null {
  const [drawing, setDrawing] = useState<Stroke | undefined>(undefined)
  const current = useRef<Stroke | undefined>(undefined)
  if (!active && strokes.length === 0) return null

  const update = (stroke: Stroke | undefined): void => {
    current.current = stroke
    setDrawing(stroke)
  }
  const finish = (): void => {
    if (current.current !== undefined && current.current.length > 1) onStroke(current.current)
    update(undefined)
  }

  return (
    <svg
      data-rmk-deck-drawing=""
      data-rmk-deck-drawing-active={active ? '' : undefined}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      onPointerDown={(event) => {
        if (!active) return
        event.currentTarget.setPointerCapture?.(event.pointerId)
        update([pointIn(event)])
      }}
      onPointerMove={(event) => {
        if (current.current !== undefined) update([...current.current, pointIn(event)])
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      {[...strokes, ...(drawing === undefined ? [] : [drawing])].map((stroke, index) => (
        <path key={index} d={path(stroke)} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
