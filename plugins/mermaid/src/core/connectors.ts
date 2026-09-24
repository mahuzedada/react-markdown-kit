/**
 * Ported from @zuilib/text-editor (MIT). Connector path helpers: vertices, SVG path strings, arrowheads and label midpoint.
 */
import { routeElbow } from './routing.js'
import type { ArrowHead, DrawingShape, Point } from './drawing-data.js'

/** Vertices of a connector's path, start to end */
export function connectorPoints(
  shape: DrawingShape,
  shapes: readonly DrawingShape[] = []
): Point[] {
  const p1: Point = { x: shape.x, y: shape.y }
  const p2: Point = { x: shape.x + shape.width, y: shape.y + shape.height }
  if (shape.waypoints?.length) return [p1, ...shape.waypoints, p2]
  if (shape.routing === 'elbow') return routeElbow(shape, shapes)
  return [p1, p2]
}

/** SVG path through the points, with softened corners on multi-segment paths */
export function polylinePath(points: readonly Point[], cornerRadius = 6): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${fmt(points[0]!.x)} ${fmt(points[0]!.y)} L ${fmt(points[1]!.x)} ${fmt(points[1]!.y)}`
  }
  let d = `M ${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!
    const p = points[i]!
    const next = points[i + 1]!
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y)
    const outLen = Math.hypot(next.x - p.x, next.y - p.y)
    const r = Math.min(cornerRadius, inLen / 2, outLen / 2)
    if (r < 0.5) {
      d += ` L ${fmt(p.x)} ${fmt(p.y)}`
      continue
    }
    const a = { x: p.x - ((p.x - prev.x) / inLen) * r, y: p.y - ((p.y - prev.y) / inLen) * r }
    const b = { x: p.x + ((next.x - p.x) / outLen) * r, y: p.y + ((next.y - p.y) / outLen) * r }
    d += ` L ${fmt(a.x)} ${fmt(a.y)} Q ${fmt(p.x)} ${fmt(p.y)} ${fmt(b.x)} ${fmt(b.y)}`
  }
  const last = points[points.length - 1]!
  return `${d} L ${fmt(last.x)} ${fmt(last.y)}`
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** Direction of the segment arriving at points[index], skipping zero-length segments */
export function segmentAngleAt(
  points: readonly Point[],
  index: number,
  backward: boolean
): number {
  const step = backward ? 1 : -1
  for (let i = index + step; i >= 0 && i < points.length; i += step) {
    const dx = points[index]!.x - points[i]!.x
    const dy = points[index]!.y - points[i]!.y
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) return Math.atan2(dy, dx)
  }
  return 0
}

/** The three vertices of a chevron head: one barb, the tip, the other barb */
export function arrowHeadPoints(tip: Point, angle: number, length: number): Point[] {
  const spread = Math.PI / 7
  return [
    { x: tip.x - length * Math.cos(angle - spread), y: tip.y - length * Math.sin(angle - spread) },
    tip,
    { x: tip.x - length * Math.cos(angle + spread), y: tip.y - length * Math.sin(angle + spread) },
  ]
}

export function arrowHeadPath(tip: Point, angle: number, length: number): string {
  const [a, t, b] = arrowHeadPoints(tip, angle, length) as [Point, Point, Point]
  return `M ${fmt(a.x)} ${fmt(a.y)} L ${fmt(t.x)} ${fmt(t.y)} L ${fmt(b.x)} ${fmt(b.y)}`
}

export function pathLength(points: readonly Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
  }
  return total
}

/** Arrowhead paths for the end (and start when bidirectional), in the arrow's head shape */
export function arrowHeads(shape: DrawingShape, points: readonly Point[]): string[] {
  if (shape.type !== 'arrow' || points.length < 2) return []
  const length = pathLength(points)
  if (length < 1) return []
  const headLength = Math.min(14, 4 + length / 4)
  const last = points.length - 1
  const head = (tip: Point, angle: number): string => headPath(shape.head, tip, angle, headLength)
  const heads = [head(points[last]!, segmentAngleAt(points, last, false))]
  if (shape.bidirectional) heads.push(head(points[0]!, segmentAngleAt(points, 0, true)))
  return heads
}

/** Radius of a circle head, and half the span of a cross, for a chevron of `length` */
export function headRadius(length: number): number {
  return Math.max(3, length * 0.36)
}

/**
 * One head at `tip`, pointing along `angle`: a chevron, a circle that
 * touches the tip (Mermaid `--o`), or a cross just short of it (`--x`)
 */
export function headPath(kind: ArrowHead | undefined, tip: Point, angle: number, length: number): string {
  if (kind === undefined) return arrowHeadPath(tip, angle, length)
  const r = headRadius(length)
  const back = kind === 'circle' ? r : r * 1.2
  const c = { x: tip.x - back * Math.cos(angle), y: tip.y - back * Math.sin(angle) }
  if (kind === 'circle') {
    return `M ${fmt(c.x - r)} ${fmt(c.y)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(c.x + r)} ${fmt(c.y)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(c.x - r)} ${fmt(c.y)} Z`
  }
  const [a, b] = crossArms(c, angle, r)
  return `M ${fmt(a[0].x)} ${fmt(a[0].y)} L ${fmt(a[1].x)} ${fmt(a[1].y)} M ${fmt(b[0].x)} ${fmt(b[0].y)} L ${fmt(b[1].x)} ${fmt(b[1].y)}`
}

/** The two strokes of a cross centred on `c`, turned 45° off the path */
export function crossArms(c: Point, angle: number, r: number): [readonly [Point, Point], readonly [Point, Point]] {
  const arm = (turn: number): readonly [Point, Point] => {
    const dx = r * Math.cos(angle + turn)
    const dy = r * Math.sin(angle + turn)
    return [
      { x: c.x - dx, y: c.y - dy },
      { x: c.x + dx, y: c.y + dy },
    ]
  }
  return [arm(Math.PI / 4), arm(-Math.PI / 4)]
}

/** Anchor for the connector label: center of the middle (or only) segment */
export function connectorMidpoint(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!
  const a = points[Math.floor((points.length - 1) / 2)]!
  const b = points[Math.ceil((points.length + 1) / 2) - 1]!
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
