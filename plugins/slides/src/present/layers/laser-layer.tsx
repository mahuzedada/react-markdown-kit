/** A laser dot that follows the pointer over the current slide (`l`). It hides the cursor and never turns the slide. */
import { useState, type ReactElement } from 'react'

export function LaserLayer(): ReactElement {
  const [spot, setSpot] = useState<{ readonly x: number; readonly y: number } | undefined>(undefined)
  return (
    <div
      data-rmk-deck-laser=""
      aria-hidden="true"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        setSpot({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
      }}
      onPointerLeave={() => setSpot(undefined)}
    >
      {spot === undefined ? null : <span data-rmk-deck-laser-dot="" style={{ left: spot.x, top: spot.y }} />}
    </div>
  )
}
