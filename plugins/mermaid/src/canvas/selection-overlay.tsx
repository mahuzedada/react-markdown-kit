/**
 * Ported from @zuilib/text-editor (MIT). Selection chrome drawn inside the
 * SVG: resize corners, connector endpoints, elbow and waypoint handles, the
 * multi-selection frame and the marquee.
 */
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { bbox, unionRects, type Rect } from '../core/geometry.js'
import { isConnectorType, type DrawingShape, type Point } from '../core/drawing-data.js'
import type { Corner, DragState } from './interaction.js'
import { useDiagramLabels } from './labels.js'

const HANDLE = 7

function Handle({
  x,
  y,
  cursor,
  square,
  onPointerDown,
  title,
}: {
  x: number
  y: number
  cursor: string
  square?: boolean
  onPointerDown: (e: ReactPointerEvent) => void
  title?: string
}): ReactElement {
  const props = {
    className: 'rmk-diagram-handle',
    strokeWidth: 1.5,
    style: { cursor },
    onPointerDown,
  }
  return square ? (
    <rect {...props} x={x - HANDLE / 2} y={y - HANDLE / 2} width={HANDLE} height={HANDLE} rx={2}>
      {title && <title>{title}</title>}
    </rect>
  ) : (
    <circle {...props} cx={x} cy={y} r={HANDLE / 2 + 0.5}>
      {title && <title>{title}</title>}
    </circle>
  )
}

/** Handles for a single selected shape */
export function SelectionOverlay({
  shape,
  points,
  onHandlePointerDown,
  onWaypointAdd,
  onWaypointRemove,
}: {
  shape: DrawingShape
  points: readonly Point[]
  onHandlePointerDown: (e: ReactPointerEvent, drag: DragState) => void
  onWaypointAdd: (e: ReactPointerEvent, shapeId: string, segmentIndex: number, point: Point) => void
  onWaypointRemove: (shapeId: string, index: number) => void
}): ReactElement {
  const text = useDiagramLabels()
  if (isConnectorType(shape.type)) {
    const waypoints = shape.waypoints ?? []
    const [p0, p1, p2, p3] = points
    // A simple three-segment Z (elbow routing, no waypoints): its middle
    // segment gets a slide handle
    const z =
      shape.routing === 'elbow' && !waypoints.length && points.length === 4 && p0 && p1 && p2 && p3
        ? { a: p0, b: p1, c: p2, d: p3 }
        : null
    const elbowMid = z ? { x: (z.b.x + z.c.x) / 2, y: (z.b.y + z.c.y) / 2 } : null
    const elbowVertical = z !== null && Math.abs(z.b.x - z.c.x) < 0.01
    // Ghost "+" handles at each segment midpoint (skip tiny segments and the
    // elbow's middle segment where the slide handle already sits)
    const ghosts = points.slice(0, -1).flatMap((p, i) => {
      const q = points[i + 1]
      if (q === undefined || Math.hypot(q.x - p.x, q.y - p.y) < 28) return []
      if (z && i === 1) return []
      return [{ index: i, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }]
    })
    const start = points[0]
    const end = points[points.length - 1]
    return (
      <g className="rmk-diagram-selection">
        {ghosts.map(({ index, x, y }) => (
          <circle
            key={`ghost-${index}`}
            className="rmk-diagram-handle rmk-diagram-ghost"
            cx={x}
            cy={y}
            r={4.5}
            strokeWidth={1.5}
            strokeDasharray="2 2"
            style={{ cursor: 'copy' }}
            onPointerDown={(e) => onWaypointAdd(e, shape.id, index, { x, y })}
          >
            <title>{text.addWaypoint}</title>
          </circle>
        ))}
        {waypoints.map((p, i) => (
          <g
            key={`wp-${i}`}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onWaypointRemove(shape.id, i)
            }}
          >
            <Handle
              x={p.x}
              y={p.y}
              square
              cursor="move"
              title={text.waypoint}
              onPointerDown={(e) => onHandlePointerDown(e, { mode: 'waypoint', id: shape.id, index: i })}
            />
          </g>
        ))}
        {z && elbowMid && (
          <Handle
            x={elbowMid.x}
            y={elbowMid.y}
            square
            cursor={elbowVertical ? 'ew-resize' : 'ns-resize'}
            title={text.elbowHandle}
            onPointerDown={(e) =>
              onHandlePointerDown(e, {
                mode: 'elbow',
                id: shape.id,
                a: z.a,
                d: z.d,
                vertical: elbowVertical,
              })
            }
          />
        )}
        {(['start', 'end'] as const).map((which) => {
          const p = which === 'start' ? start : end
          if (p === undefined) return null
          return (
            <Handle
              key={which}
              x={p.x}
              y={p.y}
              cursor="crosshair"
              onPointerDown={(e) =>
                onHandlePointerDown(e, { mode: 'endpoint', id: shape.id, end: which, orig: shape })
              }
            />
          )
        })}
      </g>
    )
  }

  const b = bbox(shape)
  const pad = 5
  const corners: Array<{ corner: Corner; x: number; y: number }> = [
    { corner: 'nw', x: b.x - pad, y: b.y - pad },
    { corner: 'ne', x: b.x + b.w + pad, y: b.y - pad },
    { corner: 'sw', x: b.x - pad, y: b.y + b.h + pad },
    { corner: 'se', x: b.x + b.w + pad, y: b.y + b.h + pad },
  ]
  const resizable = shape.type !== 'text'
  return (
    <g className="rmk-diagram-selection">
      <SelectionFrame rect={b} pad={pad} />
      {resizable &&
        corners.map(({ corner, x, y }) => (
          <Handle
            key={corner}
            x={x}
            y={y}
            square
            cursor={corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize'}
            onPointerDown={(e) => onHandlePointerDown(e, { mode: 'resize', id: shape.id, corner, orig: shape })}
          />
        ))}
    </g>
  )
}

export function SelectionFrame({ rect, pad }: { rect: Rect; pad: number }): ReactElement {
  return (
    <rect
      x={rect.x - pad}
      y={rect.y - pad}
      width={rect.w + pad * 2}
      height={rect.h + pad * 2}
      rx={6}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeDasharray="5 4"
      pointerEvents="none"
    />
  )
}

/** Bounds of a multi-selection: a frame around the union of the shapes */
export function GroupSelectionOverlay({
  shapes,
  paths,
}: {
  shapes: readonly DrawingShape[]
  paths: ReadonlyMap<string, readonly Point[]>
}): ReactElement | null {
  if (!shapes.length) return null
  const rects = shapes.map((s): { id: string; rect: Rect } => {
    if (!isConnectorType(s.type)) return { id: s.id, rect: bbox(s) }
    const pts = paths.get(s.id) ?? []
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { id: s.id, rect: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } }
  })
  return (
    <g className="rmk-diagram-selection" pointerEvents="none">
      {rects.map(({ id, rect: r }) => (
        <rect
          key={id}
          x={r.x - 3}
          y={r.y - 3}
          width={r.w + 6}
          height={r.h + 6}
          rx={4}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.45}
        />
      ))}
      <SelectionFrame rect={unionRects(rects.map((r) => r.rect))} pad={8} />
    </g>
  )
}

export function MarqueeOverlay({ rect }: { rect: Rect }): ReactElement {
  return (
    <rect
      className="rmk-diagram-selection"
      x={rect.x}
      y={rect.y}
      width={rect.w}
      height={rect.h}
      rx={3}
      fill="currentColor"
      fillOpacity={0.08}
      stroke="currentColor"
      strokeWidth={1}
      pointerEvents="none"
    />
  )
}
