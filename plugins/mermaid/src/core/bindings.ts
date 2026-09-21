/**
 * Ported from @zuilib/text-editor (MIT). Connector bindings: hit-testing boxes, anchor / outline points and re-resolving bound endpoints.
 */
import {
  bbox,
  center,
  distanceToPolygon,
  HEADING_VECTORS,
  pointInPolygon,
  rayPolygonT,
  type Heading,
} from './geometry.js'
import { nodeShapeDefinition } from './shapes/definitions.js'
import {
  isNodeShapeType,
  isConnectorType,
  withBindings,
  type Binding,
  type DrawingShape,
  type Point,
} from './drawing-data.js'

/** Gap between a bound endpoint and the outline it points at */
export const BINDING_GAP = 6
/** How far outside a box an endpoint may land and still bind to it */
export const BINDING_TOLERANCE = 10
/**
 * Drops inside this central fraction of a box bind to its center (auto-aim);
 * drops nearer the border pin a fixed point on that edge.
 */
const AUTO_AIM_FRACTION = 0.55

export function nodeShapeOutline(box: DrawingShape): Point[] {
  const def = nodeShapeDefinition(box)
  if (def) return def.outline(box)
  const b = bbox(box)
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ]
}

export function boxContainsPoint(
  box: DrawingShape,
  point: Point,
  tolerance = 0
): boolean {
  const outline = nodeShapeOutline(box)
  if (pointInPolygon(point, outline)) return true
  return tolerance > 0 && distanceToPolygon(point, outline) <= tolerance
}

/** Topmost box under a point, if any; smaller boxes win over enclosing ones */
export function findNodeShapeAt(
  shapes: readonly DrawingShape[],
  point: Point,
  excludeId?: string,
  tolerance = BINDING_TOLERANCE
): DrawingShape | null {
  let best: DrawingShape | null = null
  let bestArea = Infinity
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i]!
    if (shape.id === excludeId || !isNodeShapeType(shape.type)) continue
    if (!boxContainsPoint(shape, point, tolerance)) continue
    const b = bbox(shape)
    const area = b.w * b.h
    if (area < bestArea) {
      best = shape
      bestArea = area
    }
  }
  return best
}

/** The point a binding refers to: its fixed point, or the box center */
export function anchorPoint(box: DrawingShape, binding?: Binding): Point {
  const b = bbox(box)
  const [fx, fy] = binding?.fixedPoint ?? [0.5, 0.5]
  return { x: b.x + b.w * fx, y: b.y + b.h * fy }
}

/**
 * Fixed point for a drop at `point`: undefined (auto-aim) for drops near
 * the center, otherwise a ratio snapped onto the nearest bounding-box edge.
 */
export function fixedPointFor(
  box: DrawingShape,
  point: Point
): [number, number] | undefined {
  const b = bbox(box)
  if (b.w < 1 || b.h < 1) return undefined
  const fx = Math.min(1, Math.max(0, (point.x - b.x) / b.w))
  const fy = Math.min(1, Math.max(0, (point.y - b.y) / b.h))
  const inner = (1 - AUTO_AIM_FRACTION) / 2
  if (fx > inner && fx < 1 - inner && fy > inner && fy < 1 - inner) {
    return undefined
  }
  const edges: Array<[number, 'fx' | 'fy', number]> = [
    [fx * b.w, 'fx', 0],
    [(1 - fx) * b.w, 'fx', 1],
    [fy * b.h, 'fy', 0],
    [(1 - fy) * b.h, 'fy', 1],
  ]
  edges.sort((a, c) => a[0] - c[0])
  const [, axis, value] = edges[0]!
  const snapped: [number, number] = axis === 'fx' ? [value, fy] : [fx, value]
  return [round3(snapped[0]), round3(snapped[1])]
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Outward heading of an edge fixed point, or null for interior points */
export function edgeHeading(binding?: Binding): Heading | null {
  const fp = binding?.fixedPoint
  if (!fp) return null
  const [fx, fy] = fp
  // Corners pick the vertical edge unless clearly on a horizontal one
  if (fy <= 0) return fx <= 0 || fx >= 1 ? null : 'up'
  if (fy >= 1) return fx <= 0 || fx >= 1 ? null : 'down'
  if (fx <= 0) return 'left'
  if (fx >= 1) return 'right'
  return null
}

/**
 * Side a connector leaves a bound box from: the fixed point's edge when it
 * has one, otherwise the side facing `toward` (aspect-aware cone test).
 */
export function bindingHeading(
  box: DrawingShape,
  binding: Binding | undefined,
  toward: Point
): Heading {
  const fixed = edgeHeading(binding)
  if (fixed) return fixed
  const b = bbox(box)
  const c = center(box)
  const dx = (toward.x - c.x) / Math.max(b.w, 1)
  const dy = (toward.y - c.y) / Math.max(b.h, 1)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'down' : 'up'
}

/**
 * Point just outside the outline, along the ray from the binding's anchor
 * toward `toward` (orbit mode). Anchors on or outside the outline exit
 * straight from the anchor.
 */
export function outlinePoint(
  box: DrawingShape,
  binding: Binding | undefined,
  toward: Point,
  gap = BINDING_GAP
): Point {
  const anchor = anchorPoint(box, binding)
  if (binding?.mode === 'inside') return anchor
  const dx = toward.x - anchor.x
  const dy = toward.y - anchor.y
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return anchor
  const ux = dx / dist
  const uy = dy / dist
  const outline = nodeShapeOutline(box)
  const onBorder = distanceToPolygon(anchor, outline) < 0.5
  const inside = !onBorder && pointInPolygon(anchor, outline)
  const t = inside ? (rayPolygonT(anchor, { x: ux, y: uy }, outline) ?? 0) : 0
  return { x: anchor.x + ux * (t + gap), y: anchor.y + uy * (t + gap) }
}

/**
 * Exit point for an elbow-routed connector: leaves the outline
 * perpendicular to `heading`, from the fixed point when it sits on an edge
 * or from the face center otherwise.
 */
export function headingExitPoint(
  box: DrawingShape,
  binding: Binding | undefined,
  heading: Heading,
  gap = BINDING_GAP
): Point {
  const anchor = anchorPoint(box, binding)
  if (binding?.mode === 'inside') return anchor
  const v = HEADING_VECTORS[heading]
  const outline = nodeShapeOutline(box)
  const onBorder = distanceToPolygon(anchor, outline) < 0.5
  const inside = !onBorder && pointInPolygon(anchor, outline)
  const t = inside ? (rayPolygonT(anchor, v, outline) ?? 0) : 0
  return { x: anchor.x + v.x * (t + gap), y: anchor.y + v.y * (t + gap) }
}

export type ResolvedEndpoints = Readonly<{ p1: Point; p2: Point }>

/**
 * Recompute the endpoints of every bound connector from the current
 * positions of the boxes they're attached to, and drop bindings whose box
 * no longer exists. Idempotent, so it can run after every shape update.
 */
export function resolveBindings(
  shapes: readonly DrawingShape[]
): readonly DrawingShape[] {
  const byId = new Map(shapes.map((s) => [s.id, s]))
  return shapes.map((shape) => {
    if (!isConnectorType(shape.type)) return shape
    if (!shape.startBinding && !shape.endBinding) return shape

    const startBox = boxById(byId, shape.startBinding)
    const endBox = boxById(byId, shape.endBinding)
    if (!startBox && !endBox) {
      // Both bindings went stale (boxes deleted): keep last geometry
      return withBindings(shape, undefined, undefined)
    }

    const freeStart: Point = { x: shape.x, y: shape.y }
    const freeEnd: Point = { x: shape.x + shape.width, y: shape.y + shape.height }
    const waypoints = shape.waypoints
    // Bound endpoints aim at the nearest waypoint when the path has some,
    // so multi-segment connectors leave the box toward their first bend
    const startTarget = waypoints?.length
      ? waypoints[0]!
      : endBox
        ? anchorPoint(endBox, shape.endBinding)
        : freeEnd
    const endTarget = waypoints?.length
      ? waypoints[waypoints.length - 1]!
      : startBox
        ? anchorPoint(startBox, shape.startBinding)
        : freeStart

    const elbow = shape.routing === 'elbow' && !waypoints?.length
    const p1 = startBox
      ? elbow
        ? headingExitPoint(
            startBox,
            shape.startBinding,
            bindingHeading(startBox, shape.startBinding, startTarget)
          )
        : outlinePoint(startBox, shape.startBinding, startTarget)
      : freeStart
    const p2 = endBox
      ? elbow
        ? headingExitPoint(
            endBox,
            shape.endBinding,
            bindingHeading(endBox, shape.endBinding, endTarget)
          )
        : outlinePoint(endBox, shape.endBinding, endTarget)
      : freeEnd

    const next: DrawingShape = {
      ...withBindings(
        shape,
        startBox ? shape.startBinding : undefined,
        endBox ? shape.endBinding : undefined
      ),
      x: p1.x,
      y: p1.y,
      width: p2.x - p1.x,
      height: p2.y - p1.y,
    }
    return shallowEqualShape(shape, next) ? shape : next
  })
}

function boxById(
  byId: Map<string, DrawingShape>,
  binding?: Binding
): DrawingShape | undefined {
  if (!binding) return undefined
  const box = byId.get(binding.id)
  return box && isNodeShapeType(box.type) ? box : undefined
}

function shallowEqualShape(a: DrawingShape, b: DrawingShape): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.startBinding === b.startBinding &&
    a.endBinding === b.endBinding
  )
}

/** Attach a freshly drawn connector to the boxes under its endpoints */
export function bindEndpoints(
  shape: DrawingShape,
  shapes: readonly DrawingShape[]
): DrawingShape {
  const start: Point = { x: shape.x, y: shape.y }
  const end: Point = { x: shape.x + shape.width, y: shape.y + shape.height }
  const startBox = findNodeShapeAt(shapes, start, shape.id)
  const endBox = findNodeShapeAt(shapes, end, shape.id)
  // Both ends inside the same box would degenerate: leave unbound
  if (startBox && endBox && startBox.id === endBox.id) return shape
  return withBindings(
    shape,
    startBox ? createBinding(startBox, start) : undefined,
    endBox ? createBinding(endBox, end) : undefined
  )
}

export function createBinding(box: DrawingShape, point: Point): Binding {
  const fixedPoint = fixedPointFor(box, point)
  return fixedPoint ? { id: box.id, fixedPoint } : { id: box.id }
}
