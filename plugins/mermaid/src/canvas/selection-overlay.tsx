/**
 * Ported from @zuilib/text-editor (MIT). Selection chrome drawn inside the
 * SVG: resize corners, connector endpoints, elbow and waypoint handles, the
 * multi-selection frame and the marquee.
 */
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { bbox, type Rect } from '../core/geometry.js'
import { isConnectorType, type DrawingShape, type Point } from '../core/drawing-data.js'
import { selectionBounds, type Corner, type DragState, type GroupHandle } from './interaction.js'
import { useDiagramLabels } from './host.js'

const HANDLE = 8

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

/** Group handles sit on the frame this far outside the shapes */
const GROUP_PAD = 8
/** A side handle shows only on a frame side at least this long */
const SIDE_HANDLE_MIN = 64

const HANDLE_CURSORS: Record<GroupHandle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
}

/**
 * A multi-selection, as Excalidraw draws one: a thin outline around every
 * selected shape, a dashed frame around their union, and handles on that
 * frame that scale the whole selection (corners uniformly, sides along
 * one axis).
 */
export function GroupSelectionOverlay({
  shapes,
  paths,
  onHandlePointerDown,
}: {
  shapes: readonly DrawingShape[]
  paths: ReadonlyMap<string, readonly Point[]>
  onHandlePointerDown?: ((e: ReactPointerEvent, handle: GroupHandle, bounds: Rect) => void) | undefined
}): ReactElement | null {
  const text = useDiagramLabels()
  if (!shapes.length) return null
  const outlines = shapes.map((s) => ({ id: s.id, rect: selectionBounds([s], paths) }))
  const bounds = selectionBounds(shapes, paths)
  const x0 = bounds.x - GROUP_PAD
  const y0 = bounds.y - GROUP_PAD
  const x1 = bounds.x + bounds.w + GROUP_PAD
  const y1 = bounds.y + bounds.h + GROUP_PAD
  const xm = (x0 + x1) / 2
  const ym = (y0 + y1) / 2
  const handles: Array<{ handle: GroupHandle; x: number; y: number }> = [
    { handle: 'nw', x: x0, y: y0 },
    { handle: 'ne', x: x1, y: y0 },
    { handle: 'sw', x: x0, y: y1 },
    { handle: 'se', x: x1, y: y1 },
    ...(x1 - x0 >= SIDE_HANDLE_MIN
      ? [
          { handle: 'n' as const, x: xm, y: y0 },
          { handle: 's' as const, x: xm, y: y1 },
        ]
      : []),
    ...(y1 - y0 >= SIDE_HANDLE_MIN
      ? [
          { handle: 'w' as const, x: x0, y: ym },
          { handle: 'e' as const, x: x1, y: ym },
        ]
      : []),
  ]
  return (
    <g className="rmk-diagram-selection rmk-diagram-group-selection">
      {outlines.map(({ id, rect: r }) => (
        <rect
          key={id}
          x={r.x - 3}
          y={r.y - 3}
          width={r.w + 6}
          height={r.h + 6}
          rx={3}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          pointerEvents="none"
        />
      ))}
      <SelectionFrame rect={bounds} pad={GROUP_PAD} />
      {onHandlePointerDown &&
        handles.map(({ handle, x, y }) => (
          <Handle
            key={handle}
            x={x}
            y={y}
            square
            cursor={HANDLE_CURSORS[handle]}
            title={text.resizeSelection}
            onPointerDown={(e) => onHandlePointerDown(e, handle, bounds)}
          />
        ))}
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
