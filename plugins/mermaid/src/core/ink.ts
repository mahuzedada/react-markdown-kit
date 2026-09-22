/**
 * Ink rendering: the geometry of the hand-drawn `ink` style.
 *
 * A shape is a list of *sides*, each a polyline (two points for a straight
 * edge, a dense sampling for an arc or a curve). Every side is drawn as one
 * confident marker stroke: a slight seeded bow along its normal, zero at both
 * ends so sides meet exactly at their corners, and a faint secondary wave so
 * long edges do not read as perfect arcs. Corners get a small shared jitter
 * (keyed by their coordinates, so both sides of a corner move together). A
 * closed outline does not end where it started: the pen runs a few pixels
 * past the first corner, drifting outward, the way a hand closes a loop.
 *
 * The result is a plain SVG path for an SVG stroke of uniform width, and a
 * closed centerline for the fill, so the fill sits exactly under the stroke.
 * Everything is seeded from the shape id: the same shape draws the same way
 * on every render, undo, export and machine.
 *
 * This is a renderer concern only; the drawing format never sees it.
 */
import type { Point } from './drawing-data.js'

export type DrawingStyle = 'clean' | 'ink'

/** A polyline the pen follows in one movement: two points for a straight edge, more for a curve */
export type InkSide = readonly Point[]

export type InkOptions = Readonly<{
  /** The sides form a loop: the last ends where the first starts */
  closed: boolean
  seed: number
  /** Peak bow of the longest side from its geometric path, in px */
  amplitude: number
  /** Closed outlines only: skip the overlap tail past the first corner */
  noTail?: boolean | undefined
  /** Length the bow of each side is measured against; the longest side by default */
  reference?: number | undefined
}>

export type InkOutline = Readonly<{
  /** The stroke: an open path, drawn with round caps and joins */
  stroke: string
  /** The displaced centerline closed with `Z`, for the fill of a closed outline */
  fill: string
}>

/** Resampling step along a side, in px */
const SAMPLE_STEP = 4
/** Corners move by at most this fraction of the amplitude */
const CORNER_JITTER = 0.5
/** A closed outline overlaps its first side by this much, capped by the side length */
const TAIL_LENGTH = 10
const TAU = Math.PI * 2

/** FNV-1a: a stable 32-bit seed from a shape id */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mix(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return (h ^ (h >>> 16)) >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Bow amplitude for a shape of the given smallest dimension (px) */
export function inkAmplitude(size: number): number {
  return Math.min(1.6, Math.max(0.5, size * 0.014))
}

/** Bow amplitude for a connector of the given length (px) */
export function inkLineAmplitude(length: number): number {
  return Math.min(2.4, Math.max(0.5, length * 0.012))
}

const f = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2))

function sideLength(side: InkSide): number {
  let total = 0
  for (let i = 1; i < side.length; i++) {
    total += Math.hypot(side[i]!.x - side[i - 1]!.x, side[i]!.y - side[i - 1]!.y)
  }
  return total
}

type Samples = Readonly<{ points: Point[]; ts: number[] }>

/** Even resampling along a side; `t` is the arc parameter in [0, 1] */
function resample(side: InkSide, total: number): Samples {
  const out: Point[] = []
  const ts: number[] = []
  let walked = 0
  for (let i = 1; i < side.length; i++) {
    const a = side[i - 1]!
    const b = side[i]!
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.round(l / SAMPLE_STEP))
    for (let k = 0; k < n; k++) {
      const u = k / n
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
      ts.push((walked + l * u) / total)
    }
    walked += l
  }
  out.push(side[side.length - 1]!)
  ts.push(1)
  return { points: out, ts }
}

function normalAt(points: readonly Point[], i: number): Point {
  const prev = points[Math.max(0, i - 1)]!
  const next = points[Math.min(points.length - 1, i + 1)]!
  const tx = next.x - prev.x
  const ty = next.y - prev.y
  const len = Math.hypot(tx, ty) || 1
  return { x: -ty / len, y: tx / len }
}

/** The jitter of a corner, the same for every side that ends there */
function cornerJitter(seed: number, p: Point, amplitude: number): Point {
  const key = mix(seed, (Math.round(p.x * 4) * 73856093) ^ (Math.round(p.y * 4) * 19349663))
  const rand = mulberry32(key)
  const angle = rand() * TAU
  const d = rand() * amplitude * CORNER_JITTER
  return { x: p.x + Math.cos(angle) * d, y: p.y + Math.sin(angle) * d }
}

type Bow = Readonly<{
  /** Peak of the main bow; its sign picks the side of the path */
  main: number
  /** Peak of the secondary wave */
  wave: number
  phase: number
}>

function bowFor(seed: number, index: number, amplitude: number, share: number): Bow {
  const rand = mulberry32(mix(seed, index))
  const sign = rand() < 0.5 ? -1 : 1
  return {
    // Together the two peaks never exceed the amplitude
    main: sign * amplitude * share * (0.5 + rand() * 0.25),
    wave: amplitude * share * 0.25 * (rand() < 0.5 ? -1 : 1),
    phase: rand() * Math.PI,
  }
}

/** One side displaced by its bow; endpoints are the (jittered) corners */
function drawSide(side: InkSide, bow: Bow, from: Point, to: Point): Point[] {
  const total = sideLength(side)
  if (total === 0) return [from]
  const { points, ts } = resample(side, total)
  const out: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const t = ts[i]!
    const nrm = normalAt(points, i)
    const off = bow.main * Math.sin(Math.PI * t) + bow.wave * Math.sin(TAU * t + bow.phase) * Math.sin(Math.PI * t)
    // Endpoints slide linearly onto the jittered corners
    const dx = (from.x - side[0]!.x) * (1 - t) + (to.x - side[side.length - 1]!.x) * t
    const dy = (from.y - side[0]!.y) * (1 - t) + (to.y - side[side.length - 1]!.y) * t
    out.push({ x: points[i]!.x + nrm.x * off + dx, y: points[i]!.y + nrm.y * off + dy })
  }
  return out
}

/** Path data through the points: a move, then lines */
function pathOf(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)} ${f(p.y)}`).join(' ')
}

/**
 * The stroke and fill of an outline made of sides drawn in order. Sides must
 * be connected: each starts where the previous ends (and for a closed
 * outline, the last ends where the first starts).
 */
export function inkOutline(sides: readonly InkSide[], options: InkOptions): InkOutline {
  const usable = sides.filter((s) => s.length >= 2 && sideLength(s) > 0)
  if (usable.length === 0) return { stroke: '', fill: '' }
  const { seed, amplitude, closed } = options
  const longest = options.reference ?? Math.max(...usable.map(sideLength))
  const corner = (p: Point): Point => cornerJitter(seed, p, amplitude)

  const center: Point[] = []
  usable.forEach((side, i) => {
    // Short sides (corner arcs, small features) bow in proportion to their length
    const share = Math.min(1, Math.max(0.25, sideLength(side) / longest))
    const pts = drawSide(side, bowFor(seed, i, amplitude, share), corner(side[0]!), corner(side[side.length - 1]!))
    center.push(...(i === 0 ? pts : pts.slice(1)))
  })

  if (!closed) return { stroke: pathOf(center), fill: '' }

  const fill = `${pathOf(center)} Z`
  if (options.noTail === true) return { stroke: `${pathOf(center)} Z`, fill }

  // The tail: the pen runs on along the first side, easing outward
  const first = usable[0]!
  const firstLen = sideLength(first)
  const tailLen = Math.min(TAIL_LENGTH, firstLen * 0.35)
  const { points, ts } = resample(first, firstLen)
  const start = center[0]!
  const end = center[center.length - 1]!
  const drift = mulberry32(mix(seed, 0x7a11))() < 0.5 ? -1 : 1
  const tail: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const d = ts[i]! * firstLen
    if (d > tailLen) break
    const u = d / tailLen
    const nrm = normalAt(points, i)
    const off = drift * amplitude * 0.6 * u * u
    // Land on the closing point, then peel away from the start of the first side
    const bx = (start.x - first[0]!.x) * (1 - u)
    const by = (start.y - first[0]!.y) * (1 - u)
    tail.push({ x: points[i]!.x + nrm.x * off + bx, y: points[i]!.y + nrm.y * off + by })
  }
  tail[0] = end
  return { stroke: pathOf([...center, ...tail.slice(1)]), fill }
}

/** Points along a cubic Bézier, including both ends */
export function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point, segments = 10): Point[] {
  const out: Point[] = []
  for (let k = 0; k <= segments; k++) {
    const u = k / segments
    const v = 1 - u
    out.push({
      x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
      y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
    })
  }
  return out
}

/** Points on an elliptical arc from angle `from` to `to` (radians, y down) */
export function arcPolygon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  segments = 12
): Point[] {
  // Snapped, so an arc's end is the exact point the next side starts from
  const snap = (v: number): number => Math.round(v * 1e6) / 1e6
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / segments
    return { x: snap(cx + rx * Math.cos(a)), y: snap(cy + ry * Math.sin(a)) }
  })
}

/** An ellipse as four quadrant arcs, clockwise from the top */
export function ellipseSides(cx: number, cy: number, rx: number, ry: number, segments = 10): InkSide[] {
  const q = Math.PI / 2
  return [0, 1, 2, 3].map((i) => arcPolygon(cx, cy, rx, ry, -q + i * q, i * q, segments))
}

/** A rectangle with rounded corners as sides: four edges and four corner arcs */
export function roundedRectSides(
  r: Readonly<{ x: number; y: number; w: number; h: number }>,
  radius: number
): InkSide[] {
  const rad = Math.min(radius, r.w / 2, r.h / 2)
  const right = r.x + r.w
  const bottom = r.y + r.h
  if (rad <= 0) {
    return polygonSides([
      { x: r.x, y: r.y },
      { x: right, y: r.y },
      { x: right, y: bottom },
      { x: r.x, y: bottom },
    ])
  }
  const q = Math.PI / 2
  return [
    [{ x: r.x + rad, y: r.y }, { x: right - rad, y: r.y }],
    arcPolygon(right - rad, r.y + rad, rad, rad, -q, 0, 3),
    [{ x: right, y: r.y + rad }, { x: right, y: bottom - rad }],
    arcPolygon(right - rad, bottom - rad, rad, rad, 0, q, 3),
    [{ x: right - rad, y: bottom }, { x: r.x + rad, y: bottom }],
    arcPolygon(r.x + rad, bottom - rad, rad, rad, q, 2 * q, 3),
    [{ x: r.x, y: bottom - rad }, { x: r.x, y: r.y + rad }],
    arcPolygon(r.x + rad, r.y + rad, rad, rad, 2 * q, 3 * q, 3),
  ]
}

/** The edges of a polygon as straight sides, closing back to the first point */
export function polygonSides(points: readonly Point[]): InkSide[] {
  return points.map((p, i) => [p, points[(i + 1) % points.length]!])
}

/** The segments of a polyline as straight sides (open) */
export function polylineSides(points: readonly Point[]): InkSide[] {
  const out: InkSide[] = []
  for (let i = 1; i < points.length; i++) out.push([points[i - 1]!, points[i]!])
  return out
}
