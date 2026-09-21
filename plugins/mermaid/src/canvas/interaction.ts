/**
 * Ported from @zuilib/text-editor (MIT). Pointer-drag state machine of the
 * canvas: what a drag is (draw, move, resize, endpoint, elbow, waypoint,
 * marquee) and how a pointer position applies to the shapes.
 */
import { bbox, rectWithin, type Rect } from '../core/geometry.js'
import { isConnectorType, type DrawingShape, type Point } from '../core/drawing-data.js'

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

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
    }
  | { mode: 'resize'; id: string; corner: Corner; orig: DrawingShape }
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
