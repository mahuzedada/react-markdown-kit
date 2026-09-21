/**
 * Ported from @zuilib/text-editor (MIT). Orthogonal (elbow) connector routing over a sparse grid with A*.
 */
import { anchorPoint, bindingHeading } from './bindings.js'
import {
  bbox,
  flipHeading,
  HEADING_VECTORS,
  inflate,
  isHorizontal,
  manhattan,
  rectContains,
  rectContainsStrict,
  unionRects,
  vectorHeading,
  type Heading,
  type Rect,
} from './geometry.js'
import { isNodeShapeType, type DrawingShape, type Point } from './drawing-data.js'

/** Length of the segment that leaves a bound box before the first turn */
const EXIT_LENGTH = 28
/** Clearance kept around boxes the path routes around */
const OBSTACLE_PADDING = 14
/** Boxes farther than this from the connector's span don't shape the grid */
const OBSTACLE_REACH = 60
/** Interior points closer than this are merged */
const DEDUP_THRESHOLD = 1

type Node = {
  x: number
  y: number
  col: number
  row: number
  g: number
  f: number
  closed: boolean
  visited: boolean
  parent: Node | null
  dir: Heading | null
}

/**
 * Orthogonal route for an elbow connector: leaves each bound box
 * perpendicular to its attach side, avoids every box on the canvas, and
 * takes the path with the fewest bends (then the shortest). Falls back to
 * a plain L when the grid search fails.
 */
export function routeElbow(
  shape: DrawingShape,
  shapes: readonly DrawingShape[]
): Point[] {
  const byId = new Map(shapes.map((s) => [s.id, s]))
  const startBox = shape.startBinding ? byId.get(shape.startBinding.id) : undefined
  const endBox = shape.endBinding ? byId.get(shape.endBinding.id) : undefined
  const p1: Point = { x: shape.x, y: shape.y }
  const p2: Point = { x: shape.x + shape.width, y: shape.y + shape.height }

  const startTarget = endBox ? anchorPoint(endBox, shape.endBinding) : p2
  const endTarget = startBox ? anchorPoint(startBox, shape.startBinding) : p1
  const h1 = startBox
    ? bindingHeading(startBox, shape.startBinding, startTarget)
    : vectorHeading(p1, p2)
  const h2 = endBox
    ? bindingHeading(endBox, shape.endBinding, endTarget)
    : vectorHeading(p2, p1)

  const ds = startBox ? offset(p1, h1, EXIT_LENGTH) : p1
  const de = endBox ? offset(p2, h2, EXIT_LENGTH) : p2

  const span = unionRects([pointRect(ds), pointRect(de)])
  const reach = inflate(span, OBSTACLE_REACH)
  const obstacles = shapes
    .filter((s) => isNodeShapeType(s.type))
    .map((s) => inflate(bbox(s), OBSTACLE_PADDING))
    .filter((r) => intersects(r, reach))
    // A box the path must start or end inside cannot be an obstacle
    .filter((r) => !rectContains(r, ds) && !rectContains(r, de))

  const path =
    astar(ds, de, h1, h2, obstacles) ??
    (isHorizontal(h1) ? [ds, { x: de.x, y: ds.y }, de] : [ds, { x: ds.x, y: de.y }, de])

  let points = simplify([p1, ds, ...path, de, p2])
  if (shape.elbow !== undefined && points.length === 4) {
    points = applyElbowOverride(points, shape.elbow, obstacles)
  }
  return points
}

function offset(p: Point, heading: Heading, distance: number): Point {
  const v = HEADING_VECTORS[heading]
  return { x: p.x + v.x * distance, y: p.y + v.y * distance }
}

function pointRect(p: Point): Rect {
  return { x: p.x, y: p.y, w: 0, h: 0 }
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
}

function astar(
  start: Point,
  end: Point,
  startHeading: Heading,
  endHeading: Heading,
  obstacles: readonly Rect[]
): Point[] | null {
  const xs = new Set<number>([start.x, end.x, (start.x + end.x) / 2])
  const ys = new Set<number>([start.y, end.y, (start.y + end.y) / 2])
  for (const r of obstacles) {
    xs.add(r.x)
    xs.add(r.x + r.w)
    ys.add(r.y)
    ys.add(r.y + r.h)
  }
  const bounds = inflate(
    unionRects([pointRect(start), pointRect(end), ...obstacles]),
    OBSTACLE_PADDING
  )
  xs.add(bounds.x)
  xs.add(bounds.x + bounds.w)
  ys.add(bounds.y)
  ys.add(bounds.y + bounds.h)

  const cols = [...xs].sort((a, b) => a - b)
  const rows = [...ys].sort((a, b) => a - b)
  const grid: Node[][] = rows.map((y, row) =>
    cols.map((x, col) => ({
      x,
      y,
      col,
      row,
      g: Infinity,
      f: Infinity,
      closed: false,
      visited: false,
      parent: null,
      dir: null,
    }))
  )
  const startNode = grid[rows.indexOf(start.y)]![cols.indexOf(start.x)]!
  const endNode = grid[rows.indexOf(end.y)]![cols.indexOf(end.x)]!
  if (startNode === endNode) return [start]

  const bendPenalty = Math.max(10_000, manhattan(start, end) ** 2)
  const open = new MinHeap()
  startNode.g = 0
  startNode.f = manhattan(startNode, endNode)
  startNode.visited = true
  open.push(startNode)

  while (open.size) {
    const current = open.pop()
    if (current.closed) continue
    if (current === endNode) return trace(current)
    current.closed = true
    const prevDir = current.dir ?? startHeading

    for (const [dir, neighbor] of neighbors(grid, current)) {
      if (neighbor.closed) continue
      // Never double back, and never enter the end travelling away from
      // its box (the last segment must run into the box)
      if (dir === flipHeading(prevDir)) continue
      if (neighbor === endNode && dir === endHeading) continue
      const mid = { x: (current.x + neighbor.x) / 2, y: (current.y + neighbor.y) / 2 }
      if (obstacles.some((r) => rectContainsStrict(r, mid))) continue
      const g =
        current.g + manhattan(current, neighbor) + (dir !== prevDir ? bendPenalty : 0)
      if (!neighbor.visited || g < neighbor.g) {
        neighbor.visited = true
        neighbor.parent = current
        neighbor.dir = dir
        neighbor.g = g
        neighbor.f = g + manhattan(neighbor, endNode)
        open.push(neighbor)
      }
    }
  }
  return null
}

function neighbors(grid: Node[][], n: Node): Array<[Heading, Node]> {
  const out: Array<[Heading, Node]> = []
  if (n.row > 0) out.push(['up', grid[n.row - 1]![n.col]!])
  if (n.col < grid[0]!.length - 1) out.push(['right', grid[n.row]![n.col + 1]!])
  if (n.row < grid.length - 1) out.push(['down', grid[n.row + 1]![n.col]!])
  if (n.col > 0) out.push(['left', grid[n.row]![n.col - 1]!])
  return out
}

function trace(node: Node): Point[] {
  const points: Point[] = []
  for (let n: Node | null = node; n; n = n.parent) points.push({ x: n.x, y: n.y })
  return points.reverse()
}

class MinHeap {
  private items: Node[] = []

  get size(): number {
    return this.items.length
  }

  push(node: Node): void {
    const items = this.items
    items.push(node)
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (items[parent]!.f <= items[i]!.f) break
      ;[items[parent], items[i]] = [items[i]!, items[parent]!]
      i = parent
    }
  }

  pop(): Node {
    const items = this.items
    const top = items[0]!
    const last = items.pop() as Node
    if (items.length) {
      items[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < items.length && items[l]!.f < items[m]!.f) m = l
        if (r < items.length && items[r]!.f < items[m]!.f) m = r
        if (m === i) break
        ;[items[m], items[i]] = [items[i]!, items[m]!]
        i = m
      }
    }
    return top
  }
}

/** Drop near-duplicate and collinear interior points */
export function simplify(points: readonly Point[]): Point[] {
  const deduped: Point[] = []
  for (const p of points) {
    const last = deduped[deduped.length - 1]
    if (last && manhattan(last, p) < DEDUP_THRESHOLD) continue
    deduped.push(p)
  }
  const out: Point[] = []
  for (let i = 0; i < deduped.length; i++) {
    const prev = out[out.length - 1]
    const next = deduped[i + 1]
    const p = deduped[i]!
    if (prev && next) {
      const sameX = Math.abs(prev.x - p.x) < 0.01 && Math.abs(p.x - next.x) < 0.01
      const sameY = Math.abs(prev.y - p.y) < 0.01 && Math.abs(p.y - next.y) < 0.01
      if (sameX || sameY) continue
    }
    out.push(p)
  }
  return out
}

/**
 * Slide the middle segment of a three-segment Z to `t` of the span, unless
 * that would cut through a box.
 */
function applyElbowOverride(
  points: Point[],
  t: number,
  obstacles: readonly Rect[]
): Point[] {
  const [a, b, c, d] = points as [Point, Point, Point, Point]
  const horizontalMiddle = Math.abs(b.y - c.y) < 0.01 && Math.abs(b.x - c.x) > 0.01
  const verticalMiddle = Math.abs(b.x - c.x) < 0.01 && Math.abs(b.y - c.y) > 0.01
  const clamped = Math.min(0.95, Math.max(0.05, t))
  let next: Point[]
  if (verticalMiddle) {
    const x = a.x + (d.x - a.x) * clamped
    next = [a, { x, y: b.y }, { x, y: c.y }, d]
  } else if (horizontalMiddle) {
    const y = a.y + (d.y - a.y) * clamped
    next = [a, { x: b.x, y }, { x: c.x, y }, d]
  } else {
    return points
  }
  for (let i = 0; i < next.length - 1; i++) {
    const mid = { x: (next[i]!.x + next[i + 1]!.x) / 2, y: (next[i]!.y + next[i + 1]!.y) / 2 }
    if (obstacles.some((r) => rectContainsStrict(r, mid))) return points
  }
  return next
}
