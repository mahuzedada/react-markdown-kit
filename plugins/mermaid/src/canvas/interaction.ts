/**
 * Ported from @zuilib/text-editor (MIT). Pointer-drag state machine of the
 * canvas: what a drag is (draw, move, resize, group resize, endpoint,
 * elbow, waypoint, marquee) and how a pointer position applies to the
 * shapes.
 *
 * A multi-selection behaves the way Excalidraw's does: one frame around the
 * union of the selected shapes, a drag anywhere inside it moves them all,
 * and its handles scale them together. A corner scales uniformly from the
 * opposite corner, a side scales along its one axis, and Alt scales from
 * the centre. Positions, sizes and waypoints scale; stroke widths and text
 * sizes do not, and bound connectors follow their boxes through the
 * binding resolver.
 */
import { bbox, rectWithin, unionRects, type Rect } from '../core/geometry.js'
import { isConnectorType, type DrawingShape, type Point } from '../core/drawing-data.js'

export type Corner = 'nw' | 'ne' | 'sw' | 'se'
/** A handle of the multi-selection frame: a corner or the middle of a side. */
export type GroupHandle = Corner | 'n' | 'e' | 's' | 'w'

export type DragState =
  | { mode: 'draw'; id: string; origin: Point }
  | {
      mode: 'move'
      /** Shape the pointer went down on */
      clickedId: string
      origin: Point
      origs: ReadonlyMap<string, DrawingShape>
      /** The clicked shape was already the (only) selection: click-to-edit */
      wasSelected: boolean
      /** A click (no drag) on one shape of a multi-selection narrows the selection to it */
      collapseOnClick?: boolean
    }
  | { mode: 'resize'; id: string; corner: Corner; orig: DrawingShape }
  | {
      mode: 'group-resize'
      handle: GroupHandle
      /** Union of the selection at drag start */
      bounds: Rect
      origs: ReadonlyMap<string, DrawingShape>
      /** Alt at drag start: scale about the centre instead of the opposite handle */
      fromCenter: boolean
    }
  | { mode: 'endpoint'; id: string; end: 'start' | 'end'; orig: DrawingShape }
  | {
      mode: 'elbow'
      id: string
      /** Endpoints of the Z at drag start and its middle-segment orientation */
      a: Point
      d: Point
      vertical: boolean
    }
  | { mode: 'waypoint'; id: string; index: number }
  | { mode: 'marquee'; origin: Point; current: Point; additive: boolean }

/** Waypoint drag snaps to a neighbor's axis within this distance */
const WAYPOINT_SNAP = 8
/** Pointer travel below this is a click, not a drag */
export const CLICK_TOLERANCE = 3

type OptionalShapeKey = {
  [K in keyof DrawingShape]-?: undefined extends DrawingShape[K] ? K : never
}[keyof DrawingShape]

/**
 * Copy of `shape` without the given optional fields. The model forbids an
 * explicit `undefined` (`exactOptionalPropertyTypes`), so "unset" is "absent".
 */
export function omitFields(shape: DrawingShape, keys: readonly OptionalShapeKey[]): DrawingShape {
  const next: { -readonly [K in keyof DrawingShape]: DrawingShape[K] } = { ...shape }
  for (const key of keys) delete next[key]
  return next
}

export function marqueeRect(origin: Point, current: Point): Rect {
  return {
    x: Math.min(origin.x, current.x),
    y: Math.min(origin.y, current.y),
    w: Math.abs(current.x - origin.x),
    h: Math.abs(current.y - origin.y),
  }
}

/** Ids of the shapes fully contained by a rectangle */
export function shapesWithin(
  shapes: readonly DrawingShape[],
  rect: Rect,
  paths: ReadonlyMap<string, readonly Point[]>,
): string[] {
  return shapes
    .filter((shape) => {
      if (isConnectorType(shape.type)) {
        const points = paths.get(shape.id) ?? []
        return (
          points.length > 0 &&
          points.every(
            (p) => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h,
          )
        )
      }
      return rectWithin(bbox(shape), rect)
    })
    .map((s) => s.id)
}

/** Apply the pointer position to the shapes for an in-progress drag */
export function applyDrag(
  shapes: readonly DrawingShape[],
  drag: DragState,
  point: Point,
): readonly DrawingShape[] {
  switch (drag.mode) {
    case 'marquee':
      return shapes
    case 'draw':
      return shapes.map((s) =>
        s.id === drag.id ? { ...s, width: point.x - s.x, height: point.y - s.y } : s,
      )
    case 'move': {
      const dx = point.x - drag.origin.x
      const dy = point.y - drag.origin.y
      return shapes.map((s) => {
        const orig = drag.origs.get(s.id)
        if (!orig) return s
        return {
          ...s,
          x: orig.x + dx,
          y: orig.y + dy,
          ...(orig.waypoints
            ? { waypoints: orig.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
            : {}),
        }
      })
    }
    case 'group-resize':
      return scaleShapes(shapes, drag.origs, groupScale(drag, point))
    case 'resize': {
      const o = drag.orig
      const right = o.x + o.width
      const bottom = o.y + o.height
      const nx = drag.corner === 'nw' || drag.corner === 'sw' ? point.x : o.x
      const ny = drag.corner === 'nw' || drag.corner === 'ne' ? point.y : o.y
      const nr = drag.corner === 'ne' || drag.corner === 'se' ? point.x : right
      const nb = drag.corner === 'sw' || drag.corner === 'se' ? point.y : bottom
      return shapes.map((s) =>
        s.id === drag.id ? { ...s, x: nx, y: ny, width: nr - nx, height: nb - ny } : s,
      )
    }
    case 'endpoint': {
      const o = drag.orig
      return shapes.map((s) => {
        if (s.id !== drag.id) return s
        if (drag.end === 'start') {
          return {
            ...s,
            x: point.x,
            y: point.y,
            width: o.x + o.width - point.x,
            height: o.y + o.height - point.y,
          }
        }
        return { ...s, width: point.x - o.x, height: point.y - o.y }
      })
    }
    case 'elbow': {
      const span = drag.vertical ? drag.d.x - drag.a.x : drag.d.y - drag.a.y
      if (Math.abs(span) < 1) return shapes
      const raw = drag.vertical ? (point.x - drag.a.x) / span : (point.y - drag.a.y) / span
      const elbow = Math.round(Math.min(0.95, Math.max(0.05, raw)) * 1000) / 1000
      return shapes.map((s) => (s.id === drag.id ? { ...s, elbow } : s))
    }
    case 'waypoint':
      return shapes.map((s) => {
        if (s.id !== drag.id || !s.waypoints) return s
        const waypoints = s.waypoints
        if (drag.index < 0 || drag.index >= waypoints.length) return s
        // Snap to a neighboring point's axis so right angles are easy to
        // hit while diagonals remain possible
        const prevPt = (drag.index === 0 ? undefined : waypoints[drag.index - 1]) ?? { x: s.x, y: s.y }
        const nextPt =
          (drag.index === waypoints.length - 1 ? undefined : waypoints[drag.index + 1]) ?? {
            x: s.x + s.width,
            y: s.y + s.height,
          }
        let px = point.x
        let py = point.y
        if (Math.abs(px - prevPt.x) < WAYPOINT_SNAP) px = prevPt.x
        else if (Math.abs(px - nextPt.x) < WAYPOINT_SNAP) px = nextPt.x
        if (Math.abs(py - prevPt.y) < WAYPOINT_SNAP) py = prevPt.y
        else if (Math.abs(py - nextPt.y) < WAYPOINT_SNAP) py = nextPt.y
        const next = [...waypoints]
        next[drag.index] = { x: px, y: py }
        return { ...s, waypoints: next }
      })
  }
}

/** Ids that move together when `clickedId` is dragged */
export function moveGroup(
  shapes: readonly DrawingShape[],
  selected: ReadonlySet<string>,
  clickedId: string,
): Map<string, DrawingShape> {
  const ids = selected.has(clickedId) ? selected : new Set([clickedId])
  return new Map(shapes.filter((s) => ids.has(s.id)).map((s) => [s.id, s]))
}

/** Shapes keep at least this size when a group shrinks. */
const MIN_SCALED_SIZE = 8

/** The frame a selection's handles sit on: the union of its boxes and connector paths. */
export function selectionBounds(
  shapes: readonly DrawingShape[],
  paths: ReadonlyMap<string, readonly Point[]>,
): Rect {
  return unionRects(
    shapes.map((s): Rect => {
      if (!isConnectorType(s.type)) return bbox(s)
      const pts = paths.get(s.id) ?? []
      if (!pts.length) return bbox(s)
      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    }),
  )
}

export function pointInRect(point: Point, rect: Rect, pad = 0): boolean {
  return (
    point.x >= rect.x - pad && point.x <= rect.x + rect.w + pad && point.y >= rect.y - pad && point.y <= rect.y + rect.h + pad
  )
}

export interface GroupScale {
  readonly anchor: Point
  readonly sx: number
  readonly sy: number
}

/** The scale a group-resize drag asks for at `point`, clamped so no box collapses. */
export function groupScale(drag: Extract<DragState, { mode: 'group-resize' }>, point: Point): GroupScale {
  const { bounds: b, handle, fromCenter } = drag
  const horizontal = handle.includes('e') || handle.includes('w')
  const vertical = handle === 'n' || handle === 's' || handle.length === 2
  const anchor: Point = fromCenter
    ? { x: b.x + b.w / 2, y: b.y + b.h / 2 }
    : {
        x: handle.includes('w') ? b.x + b.w : handle.includes('e') ? b.x : b.x + b.w / 2,
        y: handle.includes('n') ? b.y + b.h : handle.includes('s') ? b.y : b.y + b.h / 2,
      }
  const reachX = fromCenter ? b.w / 2 : b.w
  const reachY = fromCenter ? b.h / 2 : b.h
  // Distance from the anchor along the dragged direction; crossing the
  // anchor is clamped rather than flipped
  const dx = handle.includes('w') ? anchor.x - point.x : point.x - anchor.x
  const dy = handle.includes('n') ? anchor.y - point.y : point.y - anchor.y
  const rx = reachX > 0 ? dx / reachX : Number.NaN
  const ry = reachY > 0 ? dy / reachY : Number.NaN
  let sx = 1
  let sy = 1
  if (horizontal && vertical) {
    // Corner: uniform, following whichever axis the pointer went further on
    const s = Number.isNaN(rx) ? ry : Number.isNaN(ry) ? rx : Math.max(rx, ry)
    sx = sy = Number.isNaN(s) ? 1 : s
  } else if (horizontal) {
    sx = Number.isNaN(rx) ? 1 : rx
  } else {
    sy = Number.isNaN(ry) ? 1 : ry
  }
  const min = minScale(drag.origs)
  const clamp = (s: number): number => Math.min(20, Math.max(min, s))
  if (horizontal && vertical) {
    const s = clamp(sx)
    return { anchor, sx: s, sy: s }
  }
  return { anchor, sx: clamp(sx), sy: clamp(sy) }
}

/** The smallest scale that keeps every box at `MIN_SCALED_SIZE`. */
function minScale(origs: ReadonlyMap<string, DrawingShape>): number {
  let min = 0.05
  for (const s of origs.values()) {
    if (isConnectorType(s.type) || s.type === 'text') continue
    const side = Math.min(Math.abs(s.width), Math.abs(s.height))
    if (side > 0) min = Math.max(min, MIN_SCALED_SIZE / side)
  }
  return min
}

/** `origs` scaled about `anchor`; every other shape as it is. */
export function scaleShapes(
  shapes: readonly DrawingShape[],
  origs: ReadonlyMap<string, DrawingShape>,
  { anchor, sx, sy }: GroupScale,
): readonly DrawingShape[] {
  const px = (x: number): number => anchor.x + (x - anchor.x) * sx
  const py = (y: number): number => anchor.y + (y - anchor.y) * sy
  return shapes.map((s) => {
    const o = origs.get(s.id)
    if (!o) return s
    if (o.type === 'text') {
      // Text keeps its size: its centre moves with the group
      const cx = px(o.x + o.width / 2)
      const cy = py(o.y + o.height / 2)
      return { ...s, x: cx - o.width / 2, y: cy - o.height / 2 }
    }
    return {
      ...s,
      x: px(o.x),
      y: py(o.y),
      width: o.width * sx,
      height: o.height * sy,
      ...(o.waypoints ? { waypoints: o.waypoints.map((p) => ({ x: px(p.x), y: py(p.y) })) } : {}),
    }
  })
}

/** The selection moved by `dx`, `dy`: the keyboard nudge. */
export function translateShapes(
  shapes: readonly DrawingShape[],
  ids: ReadonlySet<string>,
  dx: number,
  dy: number,
): readonly DrawingShape[] {
  return shapes.map((s) =>
    ids.has(s.id)
      ? {
          ...s,
          x: s.x + dx,
          y: s.y + dy,
          ...(s.waypoints ? { waypoints: s.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : {}),
        }
      : s,
  )
}
