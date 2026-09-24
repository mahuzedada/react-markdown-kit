/**
 * Ink-style renderer: every box and connector as one seeded marker stroke
 * (geometry from core/ink.ts). The stroke is a real SVG stroke of uniform
 * width with round caps and joins, over a fill that follows the same
 * displaced centerline. Under the main stroke sits a thinner, translucent
 * pass on a different seed: the pencil under-drawing that makes a sketch
 * read as a sketch without making it messy.
 */
import type { ReactElement } from 'react'
import { arrowHeadPoints, crossArms, headRadius, pathLength, segmentAngleAt } from '../../core/connectors.js'
import { bbox } from '../../core/geometry.js'
import {
  arcPolygon,
  ellipseSides,
  inkAmplitude,
  inkLineAmplitude,
  inkOutline,
  polygonSides,
  polylineSides,
  roundedRectSides,
  sampleCubic,
  seedFrom,
  type InkSide,
} from '../../core/ink.js'
import { strokeDashArray, type ArrowHead, type DrawingShape, type Point } from '../../core/drawing-data.js'
import { ACTOR_FIGURE_RATIO, CYLINDER_RY, NOTE_FOLD, QUEUE_RX } from '../../core/shapes/definitions.js'

/** Width and opacity of the under-drawing pass, relative to the main stroke */
const UNDER_WIDTH = 0.55
const UNDER_OPACITY = 0.42
/** Salt that puts the under-drawing on its own seed */
const UNDER_SALT = 0x5a5a5a5a
/** Salt per sub-stroke of one shape (cylinder lid, note fold, limbs …) */
const PART_SALT = 0x1000

type Pen = Readonly<{ seed: number; stroke: string; width: number; dashes?: string | undefined }>

function sideExtent(sides: readonly InkSide[]): number {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const side of sides) {
    for (const p of side) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  return Math.min(maxX - minX, maxY - minY)
}

function longestSide(sides: readonly InkSide[]): number {
  let longest = 0
  for (const side of sides) {
    let total = 0
    for (let i = 1; i < side.length; i++) total += Math.hypot(side[i]!.x - side[i - 1]!.x, side[i]!.y - side[i - 1]!.y)
    if (total > longest) longest = total
  }
  return longest
}

/**
 * One stroke of the pen along the sides: fill first (closed outlines, or
 * open ones closed for the fill by `closer` sides that are never drawn),
 * then the under-drawing, then the marker line.
 */
function Stroke({
  pen,
  sides,
  part,
  closed,
  fill,
  noTail,
  closer,
}: {
  pen: Pen
  sides: readonly InkSide[]
  part: number
  closed: boolean
  fill?: string | undefined
  noTail?: boolean | undefined
  closer?: readonly InkSide[] | undefined
}): ReactElement | null {
  // Each part bows in proportion to its own size, so a small lid or head
  // stays calmer than the body it sits on
  const amplitude = inkAmplitude(sideExtent(sides))
  const seed = pen.seed + part * PART_SALT
  const reference = longestSide(sides)
  const main = inkOutline(sides, { closed, seed, amplitude, noTail, reference })
  if (main.stroke === '') return null
  const under = inkOutline(sides, { closed, seed: seed ^ UNDER_SALT, amplitude: amplitude * 0.8, noTail: true, reference })
  // The drawn sides keep their indices and corners, so the fill's edge is the stroke's centerline
  const fillPath =
    closer !== undefined
      ? inkOutline([...sides, ...closer], { closed: true, seed, amplitude, noTail: true, reference }).fill
      : main.fill
  return (
    <g stroke={pen.stroke} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {(closed || closer !== undefined) && fill !== undefined && <path d={fillPath} fill={fill} stroke="none" />}
      <path d={under.stroke} strokeWidth={pen.width * UNDER_WIDTH} opacity={UNDER_OPACITY} strokeDasharray={pen.dashes} />
      <path d={main.stroke} strokeWidth={pen.width} strokeDasharray={pen.dashes} />
    </g>
  )
}

/** Ink-style box: its outline as sides, with sub-strokes on their own seeds */
export function InkBoxGeometry({ shape }: { shape: DrawingShape }): ReactElement | null {
  const b = bbox(shape)
  const pen: Pen = { seed: seedFrom(shape.id), stroke: shape.stroke, width: shape.strokeWidth, dashes: strokeDashArray(shape) }
  const fill = shape.fill
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2

  switch (shape.type) {
    case 'rect':
      return (
        <Stroke
          pen={pen}
          part={0}
          closed
          fill={fill}
          sides={roundedRectSides(b, shape.corners === 'sharp' ? 0 : Math.min(6, b.w / 5, b.h / 5))}
        />
      )
    case 'ellipse':
      return <Stroke pen={pen} part={0} closed fill={fill} sides={ellipseSides(cx, cy, b.w / 2, b.h / 2, 12)} />
    case 'diamond':
      return (
        <Stroke
          pen={pen}
          part={0}
          closed
          fill={fill}
          sides={polygonSides([
            { x: cx, y: b.y },
            { x: b.x + b.w, y: cy },
            { x: cx, y: b.y + b.h },
            { x: b.x, y: cy },
          ])}
        />
      )
    case 'note': {
      const fold = NOTE_FOLD(b)
      const r = b.x + b.w
      const btm = b.y + b.h
      const sheet = polygonSides([
        { x: b.x, y: b.y },
        { x: r, y: b.y },
        { x: r, y: btm - fold },
        { x: r - fold, y: btm },
        { x: b.x, y: btm },
      ])
      // The fold: a flap lifted off the corner, drawn as an open stroke
      const flap: InkSide[] = polylineSides([
        { x: r - fold, y: btm },
        { x: r - fold * 0.92, y: btm - fold * 0.92 },
        { x: r, y: btm - fold },
      ])
      return (
        <g>
          <Stroke pen={pen} part={0} closed fill={fill} sides={sheet} />
          <path
            d={`M ${r - fold} ${btm} L ${r - fold * 0.92} ${btm - fold * 0.92} L ${r} ${btm - fold} Z`}
            fill="rgba(0,0,0,0.1)"
            stroke="none"
          />
          <Stroke pen={pen} part={1} closed={false} sides={flap} />
        </g>
      )
    }
    case 'cylinder': {
      const ry = CYLINDER_RY(b)
      const rx = b.w / 2
      const body: InkSide[] = [
        [{ x: b.x, y: b.y + ry }, { x: b.x, y: b.y + b.h - ry }],
        arcPolygon(cx, b.y + b.h - ry, rx, ry, Math.PI, Math.PI / 2, 8),
        arcPolygon(cx, b.y + b.h - ry, rx, ry, Math.PI / 2, 0, 8),
        [{ x: b.x + b.w, y: b.y + b.h - ry }, { x: b.x + b.w, y: b.y + ry }],
      ]
      // The back of the lid closes the fill; the lid itself is its own loop
      const lidBack: InkSide[] = [
        arcPolygon(cx, b.y + ry, rx, ry, 0, -Math.PI / 2, 6),
        arcPolygon(cx, b.y + ry, rx, ry, -Math.PI / 2, -Math.PI, 6),
      ]
      return (
        <g>
          <Stroke pen={pen} part={0} closed={false} fill={fill} sides={body} closer={lidBack} />
          <Stroke pen={pen} part={1} closed fill={fill} sides={ellipseSides(cx, b.y + ry, rx, ry, 8)} />
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
      const sides: InkSide[] = []
      let from = start
      for (const [c1, c2, to] of segs) {
        sides.push(sampleCubic(from, c1, c2, to, 8))
        from = to
      }
      sides.push([from, start])
      return <Stroke pen={pen} part={0} closed fill={fill} sides={sides} />
    }
    case 'queue': {
      const rx = QUEUE_RX(b)
      const ry = b.h / 2
      const body: InkSide[] = [
        [{ x: b.x + b.w - rx, y: b.y + b.h }, { x: b.x + rx, y: b.y + b.h }],
        arcPolygon(b.x + rx, cy, rx, ry, Math.PI / 2, Math.PI, 6),
        arcPolygon(b.x + rx, cy, rx, ry, Math.PI, (3 * Math.PI) / 2, 6),
        [{ x: b.x + rx, y: b.y }, { x: b.x + b.w - rx, y: b.y }],
      ]
      // The front of the end cap closes the fill under the cap's own loop
      const capFront: InkSide[] = [
        arcPolygon(b.x + b.w - rx, cy, rx, ry, -Math.PI / 2, 0, 6),
        arcPolygon(b.x + b.w - rx, cy, rx, ry, 0, Math.PI / 2, 6),
      ]
      return (
        <g>
          <Stroke pen={pen} part={0} closed={false} fill={fill} sides={body} closer={capFront} />
          <Stroke pen={pen} part={1} closed fill={fill} sides={ellipseSides(b.x + b.w - rx, cy, rx, ry, 8)} />
        </g>
      )
    }
    case 'actor': {
      const figH = b.h * ACTOR_FIGURE_RATIO
      const r = Math.max(4, Math.min(figH * 0.16, b.w * 0.2))
      const neck = b.y + r * 2
      const hip = b.y + figH * 0.62
      const armY = neck + figH * 0.12
      const reach = Math.min(b.w * 0.32, figH * 0.3)
      return (
        <g>
          <Stroke pen={pen} part={0} closed fill={fill} sides={ellipseSides(cx, b.y + r, r, r, 6)} />
          <Stroke pen={pen} part={1} closed={false} sides={polylineSides([{ x: cx, y: neck }, { x: cx, y: hip }])} />
          <Stroke
            pen={pen}
            part={2}
            closed={false}
            sides={polylineSides([
              { x: cx - reach, y: armY },
              { x: cx + reach, y: armY },
            ])}
          />
          <Stroke
            pen={pen}
            part={3}
            closed={false}
            sides={polylineSides([
              { x: cx - reach, y: b.y + figH },
              { x: cx, y: hip },
              { x: cx + reach, y: b.y + figH },
            ])}
          />
        </g>
      )
    }
    default:
      return null
  }
}

/**
 * Ink-style connector: a gently bowed marker line with open chevron heads,
 * each barb its own length, the way a quick arrow is drawn.
 */
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
  const amplitude = inkLineAmplitude(length)
  const width = shape.strokeWidth
  const line = inkOutline(polylineSides(points), { closed: false, seed, amplitude })
  const under = inkOutline(polylineSides(points), {
    closed: false,
    seed: seed ^ UNDER_SALT,
    amplitude: amplitude * 0.8,
  })

  const heads: string[] = []
  if (shape.type === 'arrow' && length >= 1) {
    const headLength = Math.min(15, 5 + length / 4)
    const head = (tip: Point, angle: number, part: number): string => {
      if (shape.head !== undefined) return inkHead(shape.head, tip, angle, headLength, seed + part * PART_SALT)
      const [a, t, c] = arrowHeadPoints(tip, angle, headLength) as [Point, Point, Point]
      // One barb a touch longer than the other
      const long = part % 2 === 0 ? a : c
      const stretched = { x: t.x + (long.x - t.x) * 1.15, y: t.y + (long.y - t.y) * 1.15 }
      const barbs = part % 2 === 0 ? [stretched, t, c] : [a, t, stretched]
      return inkOutline(polylineSides(barbs), { closed: false, seed: seed + part * PART_SALT, amplitude: 0.6 }).stroke
    }
    heads.push(head(last, segmentAngleAt(points, points.length - 1, false), 1))
    if (shape.bidirectional) heads.push(head(first, segmentAngleAt(points, 0, true), 2))
  }
  const dashes = strokeDashArray(shape)
  return (
    <g stroke={shape.stroke} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={under.stroke} strokeWidth={width * UNDER_WIDTH} opacity={UNDER_OPACITY} strokeDasharray={dashes} />
      <path d={line.stroke} strokeWidth={width} strokeDasharray={dashes} />
      {heads.map((d, i) => (
        <path key={i} d={d} strokeWidth={width * 1.1} />
      ))}
    </g>
  )
}

/** A circle or cross head drawn with the pen: a loose loop, or two quick strokes */
function inkHead(kind: ArrowHead, tip: Point, angle: number, length: number, seed: number): string {
  const r = headRadius(length)
  const back = kind === 'circle' ? r : r * 1.2
  const c = { x: tip.x - back * Math.cos(angle), y: tip.y - back * Math.sin(angle) }
  if (kind === 'circle') return inkOutline(ellipseSides(c.x, c.y, r, r, 6), { closed: true, seed, amplitude: 0.5 }).stroke
  const [a, b] = crossArms(c, angle, r)
  return [a, b].map((arm, i) => inkOutline(polylineSides(arm), { closed: false, seed: seed + i, amplitude: 0.5 }).stroke).join(' ')
}
