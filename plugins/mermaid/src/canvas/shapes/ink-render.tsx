/**
 * Ported from @zuilib/text-editor (MIT). Ink-style renderer: every box and
 * connector as a single seeded pen stroke (geometry from core/ink.ts).
 */
import type { ReactElement } from 'react'
import { arrowHeadPoints, pathLength, segmentAngleAt } from '../../core/connectors.js'
import { bbox, ellipsePolygon } from '../../core/geometry.js'
import {
  arcPolygon,
  inkAmplitude,
  inkFillOffset,
  inkStroke,
  roundedPolyline,
  roundedRectPolygon,
  sampleCubic,
  seedFrom,
} from '../../core/ink.js'
import type { DrawingShape, Point } from '../../core/drawing-data.js'
import { ACTOR_FIGURE_RATIO, CYLINDER_RY, NOTE_FOLD, QUEUE_RX } from '../../core/shapes/definitions.js'

const f = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2))

function extent(points: readonly Point[]): { w: number; h: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { w: maxX - minX, h: maxY - minY }
}

/**
 * Ink-style box: fill first (misregistered by a seeded px or two, like a
 * print), then the stroke ring on top. `part` keeps sub-strokes of one
 * shape (cylinder top, note fold …) on distinct seeds.
 */
export function InkBoxGeometry({ shape }: { shape: DrawingShape }): ReactElement | null {
  const b = bbox(shape)
  const seed = seedFrom(shape.id)
  const width = shape.strokeWidth
  const off = inkFillOffset(seed)
  const fillTransform = `translate(${f(off.x)} ${f(off.y)})`
  // Each part wobbles in proportion to its own size, so a small head or lid
  // stays calmer than the body it sits on
  const amplitudeOf = (points: readonly Point[]): number =>
    inkAmplitude(Math.min(extent(points).w, extent(points).h))

  const closed = (points: readonly Point[], part: number, fill = shape.fill): ReactElement => {
    const s = inkStroke(points, { closed: true, seed: seed + part, width, amplitude: amplitudeOf(points) })
    return (
      <g>
        <path d={s.center} fill={fill} stroke="none" transform={fillTransform} />
        <path d={s.ring} fill={shape.stroke} fillRule="evenodd" stroke="none" />
      </g>
    )
  }
  const open = (points: readonly Point[], part: number, w = width): ReactElement => (
    <path
      d={inkStroke(points, { closed: false, seed: seed + part, width: w, amplitude: amplitudeOf(points) }).ring}
      fill={shape.stroke}
      stroke="none"
    />
  )

  switch (shape.type) {
    case 'rect':
      return closed(roundedRectPolygon(b, Math.min(8, b.w / 4, b.h / 4)), 0)
    case 'ellipse':
      return closed(ellipsePolygon(b, 64), 0)
    case 'diamond':
      return closed(
        [
          { x: b.x + b.w / 2, y: b.y },
          { x: b.x + b.w, y: b.y + b.h / 2 },
          { x: b.x + b.w / 2, y: b.y + b.h },
          { x: b.x, y: b.y + b.h / 2 },
        ],
        0,
      )
    case 'note': {
      const fold = NOTE_FOLD(b)
      const r = b.x + b.w
      const btm = b.y + b.h
      const fillPts = [
        { x: b.x, y: b.y },
        { x: r, y: b.y },
        { x: r, y: btm - fold },
        { x: r - fold, y: btm },
        { x: b.x, y: btm },
      ]
      const foldPts = [
        { x: r - fold, y: btm },
        { x: r - fold, y: btm - fold },
        { x: r, y: btm - fold },
      ]
      return (
        <g>
          {closed(fillPts, 0)}
          <path
            d={`M ${foldPts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`}
            fill="rgba(0,0,0,0.08)"
            stroke="none"
          />
          {open(foldPts, 1)}
        </g>
      )
    }
    case 'cylinder': {
      const ry = CYLINDER_RY(b)
      const rx = b.w / 2
      const cx = b.x + rx
      const body = [
        { x: b.x, y: b.y + ry },
        { x: b.x, y: b.y + b.h - ry },
        ...arcPolygon(cx, b.y + b.h - ry, rx, ry, Math.PI, 0, 16),
        { x: b.x + b.w, y: b.y + ry },
      ]
      const s = inkStroke(body, { closed: false, seed: seed + 0, width, amplitude: amplitudeOf(body) })
      return (
        <g>
          <path d={`${s.center} Z`} fill={shape.fill} stroke="none" transform={fillTransform} />
          <path d={s.ring} fill={shape.stroke} stroke="none" />
          {closed(ellipsePolygon({ x: b.x, y: b.y, w: b.w, h: ry * 2 }, 48), 1)}
        </g>
      )
    }
    case 'cloud': {
      const p = (u: number, v: number): Point => ({ x: b.x + u * b.w, y: b.y + v * b.h })
      const start = p(0.22, 0.86)
      const segs: Array<[Point, Point, Point]> = [
        [p(0.04, 0.88), p(0.0, 0.58), p(0.16, 0.5)],
        [p(0.08, 0.26), p(0.3, 0.12), p(0.42, 0.28)],
        [p(0.5, 0.02), p(0.76, 0.04), p(0.78, 0.3)],
        [p(0.98, 0.26), p(1.04, 0.56), p(0.88, 0.64)],
        [p(1.0, 0.8), p(0.9, 0.9), p(0.76, 0.86)],
      ]
      const pts: Point[] = [start]
      let from = start
      for (const [c1, c2, to] of segs) {
        pts.push(...sampleCubic(from, c1, c2, to, 8))
        from = to
      }
      return closed(pts, 0)
    }
    case 'queue': {
      const rx = QUEUE_RX(b)
      const ry = b.h / 2
      const body = [
        { x: b.x + rx, y: b.y },
        { x: b.x + b.w - rx, y: b.y },
        { x: b.x + b.w - rx, y: b.y + b.h },
        { x: b.x + rx, y: b.y + b.h },
        ...arcPolygon(b.x + rx, b.y + ry, rx, ry, Math.PI / 2, (3 * Math.PI) / 2, 16).slice(1, -1),
      ]
      return (
        <g>
          {closed(body, 0)}
          {closed(ellipsePolygon({ x: b.x + b.w - rx * 2, y: b.y, w: rx * 2, h: b.h }, 48), 1)}
        </g>
      )
    }
    case 'actor': {
      const figH = b.h * ACTOR_FIGURE_RATIO
      const cx = b.x + b.w / 2
      const r = Math.max(4, Math.min(figH * 0.16, b.w * 0.2))
      const neck = b.y + r * 2
      const hip = b.y + figH * 0.62
      const armY = neck + figH * 0.12
      const reach = Math.min(b.w * 0.32, figH * 0.3)
      return (
        <g>
          {closed(ellipsePolygon({ x: cx - r, y: b.y, w: r * 2, h: r * 2 }, 32), 0)}
          {open(
            [
              { x: cx, y: neck },
              { x: cx, y: hip },
            ],
            1,
          )}
          {open(
            [
              { x: cx - reach, y: armY },
              { x: cx + reach, y: armY },
            ],
            2,
          )}
          {open(
            [
              { x: cx - reach, y: b.y + figH },
              { x: cx, y: hip },
              { x: cx + reach, y: b.y + figH },
            ],
            3,
          )}
        </g>
      )
    }
    default:
      return null
  }
}

/** Ink-style connector: a tapered pen line with chevron heads */
export function InkConnector({
  shape,
  points,
}: {
  shape: DrawingShape
  points: readonly Point[]
}): ReactElement | null {
  const first = points[0]
  const last = points[points.length - 1]
  if (points.length < 2 || first === undefined || last === undefined) return null
  const seed = seedFrom(shape.id)
  const length = pathLength(points)
  const amplitude = Math.min(3, Math.max(0.8, length * 0.015))
  const width = shape.strokeWidth
  const line = inkStroke(roundedPolyline(points), { closed: false, seed, width, amplitude })

  const heads: Point[][] = []
  if (shape.type === 'arrow' && length >= 1) {
    const headLength = Math.min(14, 4 + length / 4)
    heads.push(arrowHeadPoints(last, segmentAngleAt(points, points.length - 1, false), headLength))
    if (shape.bidirectional) {
      heads.push(arrowHeadPoints(first, segmentAngleAt(points, 0, true), headLength))
    }
  }
  return (
    <g fill={shape.stroke} stroke="none">
      <path d={line.ring} />
      {heads.map((pts, i) => (
        <path
          key={i}
          d={inkStroke(pts, { closed: false, seed: seed + 1 + i, width: width * 1.15, amplitude: 0.8 }).ring}
        />
      ))}
    </g>
  )
}
