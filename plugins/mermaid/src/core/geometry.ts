/**
 * Ported from @zuilib/text-editor (MIT). Pure geometry helpers: rects, headings, polygons, ray casts and text measurement.
 */
import {
  FONT_SIZE,
  isConnectorType,
  LINE_HEIGHT,
  type DrawingShape,
  type Point,
} from './drawing-data.js'

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>

export type Heading = 'up' | 'right' | 'down' | 'left'

export const HEADING_VECTORS: Record<Heading, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

export function flipHeading(h: Heading): Heading {
  return h === 'up' ? 'down' : h === 'down' ? 'up' : h === 'left' ? 'right' : 'left'
}

export function isHorizontal(h: Heading): boolean {
  return h === 'left' || h === 'right'
}

/** Dominant-axis heading of the vector from `from` to `to` */
export function vectorHeading(from: Point, to: Point): Heading {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'down' : 'up'
}

/** Bounding box with non-negative size, for rendering and hit areas */
export function bbox(shape: DrawingShape): Rect {
  return {
    x: Math.min(shape.x, shape.x + shape.width),
    y: Math.min(shape.y, shape.y + shape.height),
    w: Math.abs(shape.width),
    h: Math.abs(shape.height),
  }
}

/** Rewrite a box shape so width/height are non-negative */
export function normalize(shape: DrawingShape): DrawingShape {
  if (isConnectorType(shape.type)) return shape
  if (shape.width >= 0 && shape.height >= 0) return shape
  const b = bbox(shape)
  return { ...shape, x: b.x, y: b.y, width: b.w, height: b.h }
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

export function center(shape: DrawingShape): Point {
  return rectCenter(bbox(shape))
}

export function inflate(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }
}

export function rectContains(r: Rect, p: Point, pad = 0): boolean {
  return (
    p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad
  )
}

/** Strict interior test (points on the border are outside) */
export function rectContainsStrict(r: Rect, p: Point): boolean {
  return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h
}

/** True when `inner` lies fully inside `outer` */
export function rectWithin(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  )
}

export function unionRects(rects: readonly Rect[]): Rect {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of rects) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function pointsBounds(points: readonly Point[]): Rect {
  return unionRects(points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })))
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function ellipsePolygon(r: Rect, segments = 40): Point[] {
  const c = rectCenter(r)
  return Array.from({ length: segments }, (_, i) => {
    const a = (i * 2 * Math.PI) / segments
    return { x: c.x + (r.w / 2) * Math.cos(a), y: c.y + (r.h / 2) * Math.sin(a) }
  })
}

export function rectPolygon(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ]
}

/** Even-odd point-in-polygon */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!
    const b = polygon[j]!
    const crosses =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

/** Distance from a point to the closest polygon edge */
export function distanceToPolygon(p: Point, polygon: readonly Point[]): number {
  let best = Infinity
  for (let i = 0; i < polygon.length; i++) {
    best = Math.min(best, distanceToSegment(p, polygon[i]!, polygon[(i + 1) % polygon.length]!))
  }
  return best
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/**
 * Smallest t ≥ 0 where `origin + t·dir` crosses the polygon border, or
 * null when the ray misses every edge.
 */
export function rayPolygonT(
  origin: Point,
  dir: Point,
  polygon: readonly Point[],
  minT = 1e-6
): number | null {
  let best: number | null = null
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i]!
    const p2 = polygon[(i + 1) % polygon.length]!
    const ex = p2.x - p1.x
    const ey = p2.y - p1.y
    const denom = dir.x * ey - dir.y * ex
    if (Math.abs(denom) < 1e-9) continue
    const qx = p1.x - origin.x
    const qy = p1.y - origin.y
    const t = (qx * ey - qy * ex) / denom
    const s = (qx * dir.y - qy * dir.x) / denom
    if (t >= minT && s >= -1e-9 && s <= 1 + 1e-9 && (best === null || t < best)) {
      best = t
    }
  }
  return best
}

/**
 * Greedy word-wrap using the same approximate glyph width as textBoxSize.
 * Explicit newlines are kept; words longer than a line are hard-broken.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charW = fontSize * 0.6
  const maxChars = Math.max(1, Math.floor(maxWidth / charW))
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (para.length <= maxChars) {
      lines.push(para)
      continue
    }
    let current = ''
    for (let word of para.split(' ')) {
      while (word.length > maxChars) {
        if (current) {
          lines.push(current)
          current = ''
        }
        lines.push(word.slice(0, maxChars))
        word = word.slice(maxChars)
      }
      if (!current) {
        current = word
      } else if (current.length + 1 + word.length <= maxChars) {
        current += ` ${word}`
      } else {
        lines.push(current)
        current = word
      }
    }
    lines.push(current)
  }
  return lines
}

export function textBoxSize(
  text: string,
  fontSize: number = FONT_SIZE
): { w: number; h: number } {
  const lines = text.split('\n')
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0)
  return {
    w: Math.max(20, longest * fontSize * 0.6),
    h: lines.length * fontSize * LINE_HEIGHT,
  }
}
