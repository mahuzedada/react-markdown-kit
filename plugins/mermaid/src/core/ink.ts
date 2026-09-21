/**
 * Ported from @zuilib/text-editor (MIT). Ink rendering: seeded hand-drawn stroke outlines and rounded-polygon helpers.
 */
import type { Point } from './drawing-data.js'

/**
 * "Ink" rendering: one confident pen stroke instead of a plotted outline.
 * Every shape's centerline is resampled densely, displaced along its normal
 * by a smooth low-frequency field (two sines, integer frequencies on closed
 * paths so the seam is continuous) and widened by a slowly varying pressure
 * factor. The result is a filled ring path, not an SVG stroke, so the width
 * can breathe along the path. Everything is seeded from the shape id: the
 * same shape draws the same way on every render, undo, export and machine.
 *
 * This is a renderer concern only — the drawing format never sees it.
 */

export type DrawingStyle = 'clean' | 'ink'

export type InkOptions = Readonly<{
  closed: boolean
  seed: number
  /** Nominal stroke width; the pressure factor varies it by ±30 % */
  width: number
  /** Peak displacement from the geometric path, in px */
  amplitude: number
}>

export type InkStroke = Readonly<{
  /** Filled outline of the stroke (use `fillRule="evenodd"`) */
  ring: string
  /** Displaced centerline, for fills */
  center: string
}>

const SAMPLE_STEP = 5
const PRESSURE = 0.3

/** FNV-1a: a stable 32-bit seed from a shape id */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
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

/** Wobble amplitude for a shape of the given smallest dimension (px) */
export function inkAmplitude(size: number): number {
  return Math.min(4, Math.max(1, size * 0.03))
}

/** Fill misregistration for a shape: a seeded 2–3 px offset */
export function inkFillOffset(seed: number): Point {
  const rand = mulberry32(seed ^ 0x9e3779b9)
  const angle = rand() * Math.PI * 2
  const d = 2 + rand()
  return { x: Math.cos(angle) * d, y: Math.sin(angle) * d }
}

type Field = Readonly<{
  offset: (t: number) => number
  pressure: (t: number) => number
}>

function makeField(seed: number, amplitude: number, closed: boolean): Field {
  const rand = mulberry32(seed)
  const int = (lo: number, span: number) => lo + Math.floor(rand() * span)
  const f1 = closed ? int(2, 2) : 1.5 + rand()
  const f2 = closed ? int(5, 3) : 3 + rand() * 2
  const g = closed ? int(2, 2) : 1 + rand()
  const p1 = rand() * Math.PI * 2
  const p2 = rand() * Math.PI * 2
  const pg = rand() * Math.PI * 2
  // Two harmonics whose peaks sum to at most `amplitude`
  const a1 = amplitude * (0.55 + rand() * 0.15)
  const a2 = amplitude * 0.3
  const TAU = Math.PI * 2
  return {
    offset: (t) => a1 * Math.sin(TAU * f1 * t + p1) + a2 * Math.sin(TAU * f2 * t + p2),
    pressure: (t) => 1 + PRESSURE * Math.sin(TAU * g * t + pg),
  }
}

type Samples = Readonly<{ points: Point[]; ts: number[] }>

/** Even resampling along a polyline; `t` is the arc parameter in [0, 1) */
function resample(points: readonly Point[], closed: boolean): Samples {
  const src = closed ? [...points, points[0]!] : [...points]
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < src.length; i++) {
    const l = Math.hypot(src[i]!.x - src[i - 1]!.x, src[i]!.y - src[i - 1]!.y)
    lengths.push(l)
    total += l
  }
  if (total === 0) return { points: [src[0]!], ts: [0] }
  const out: Point[] = []
  const ts: number[] = []
  let walked = 0
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1]!
    const b = src[i]!
    const l = lengths[i - 1]!
    const n = Math.max(1, Math.round(l / SAMPLE_STEP))
    for (let k = 0; k < n; k++) {
      const u = k / n
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
      ts.push((walked + l * u) / total)
    }
    walked += l
  }
  if (!closed) {
    out.push(src[src.length - 1]!)
    ts.push(1)
  }
  return { points: out, ts }
}

function normalAt(points: readonly Point[], i: number, closed: boolean): Point {
  const n = points.length
  const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!
  const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!
  const tx = next.x - prev.x
  const ty = next.y - prev.y
  const len = Math.hypot(tx, ty) || 1
  return { x: -ty / len, y: tx / len }
}

const f = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2))
const pathOf = (points: readonly Point[]): string =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)} ${f(p.y)}`).join(' ')

/** Ink stroke along a polyline (open) or polygon (closed) */
export function inkStroke(points: readonly Point[], options: InkOptions): InkStroke {
  if (points.length < 2) return { ring: '', center: '' }
  const { closed, seed, width, amplitude } = options
  const field = makeField(seed, amplitude, closed)
  const { points: pts, ts } = resample(points, closed)
  if (pts.length < 2) return { ring: '', center: '' }

  const center: Point[] = []
  const outer: Point[] = []
  const inner: Point[] = []
  for (let i = 0; i < pts.length; i++) {
    const t = ts[i]!
    const nrm = normalAt(pts, i, closed)
    const off = field.offset(t)
    const c = { x: pts[i]!.x + nrm.x * off, y: pts[i]!.y + nrm.y * off }
    // Open strokes thin out toward both ends, like a pen lifting
    const taper = closed ? 1 : 0.55 + 0.45 * Math.min(1, t / 0.1, (1 - t) / 0.1)
    const half = (width * field.pressure(t) * taper) / 2
    center.push(c)
    outer.push({ x: c.x + nrm.x * half, y: c.y + nrm.y * half })
    inner.push({ x: c.x - nrm.x * half, y: c.y - nrm.y * half })
  }

  if (closed) {
    return {
      ring: `${pathOf(outer)} Z ${pathOf([...inner].reverse())} Z`,
      center: `${pathOf(center)} Z`,
    }
  }
  return {
    ring: `${pathOf(outer)} ${pathOf([...inner].reverse()).replace(/^M/, 'L')} Z`,
    center: pathOf(center),
  }
}

/** Rectangle outline with circular corners, as a polygon */
export function roundedRectPolygon(
  r: Readonly<{ x: number; y: number; w: number; h: number }>,
  radius: number,
  segments = 4
): Point[] {
  const rad = Math.min(radius, r.w / 2, r.h / 2)
  if (rad <= 0) {
    return [
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.h },
      { x: r.x, y: r.y + r.h },
    ]
  }
  const corners: Array<[number, number, number]> = [
    [r.x + r.w - rad, r.y + rad, -Math.PI / 2],
    [r.x + r.w - rad, r.y + r.h - rad, 0],
    [r.x + rad, r.y + r.h - rad, Math.PI / 2],
    [r.x + rad, r.y + rad, Math.PI],
  ]
  const out: Point[] = []
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= segments; i++) {
      const a = start + (Math.PI / 2) * (i / segments)
      out.push({ x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) })
    }
  }
  return out
}

/** Polyline with its interior corners rounded (quadratic), as points */
export function roundedPolyline(points: readonly Point[], cornerRadius = 6, segments = 4): Point[] {
  if (points.length < 3) return [...points]
  const out: Point[] = [points[0]!]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!
    const p = points[i]!
    const next = points[i + 1]!
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y)
    const outLen = Math.hypot(next.x - p.x, next.y - p.y)
    const r = Math.min(cornerRadius, inLen / 2, outLen / 2)
    if (r < 0.5) {
      out.push(p)
      continue
    }
    const a = { x: p.x - ((p.x - prev.x) / inLen) * r, y: p.y - ((p.y - prev.y) / inLen) * r }
    const b = { x: p.x + ((next.x - p.x) / outLen) * r, y: p.y + ((next.y - p.y) / outLen) * r }
    for (let k = 0; k <= segments; k++) {
      const u = k / segments
      const v = 1 - u
      out.push({
        x: v * v * a.x + 2 * v * u * p.x + u * u * b.x,
        y: v * v * a.y + 2 * v * u * p.y + u * u * b.y,
      })
    }
  }
  out.push(points[points.length - 1]!)
  return out
}

/** Points along a cubic Bézier, excluding the start point */
export function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point, segments = 10): Point[] {
  const out: Point[] = []
  for (let k = 1; k <= segments; k++) {
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
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / segments
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
  })
}
