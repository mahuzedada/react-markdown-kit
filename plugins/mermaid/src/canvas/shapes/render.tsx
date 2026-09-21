/**
 * Ported from @zuilib/text-editor (MIT). Clean-style outline geometry of a
 * box (rect, ellipse, diamond, note, cylinder, cloud, queue, actor) as React
 * SVG elements, without its text slots.
 */
import type { ReactElement, SVGProps } from 'react'
import { bbox } from '../../core/geometry.js'
import type { DrawingShape } from '../../core/drawing-data.js'
import { ACTOR_FIGURE_RATIO, CYLINDER_RY, NOTE_FOLD, QUEUE_RX } from '../../core/shapes/definitions.js'

export type StrokeProps = Pick<
  SVGProps<SVGElement>,
  'stroke' | 'strokeWidth' | 'strokeLinecap' | 'strokeLinejoin'
>

const n = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2))

/** Outline geometry of a box, without its text slots */
export function BoxGeometry({
  shape,
  stroke,
}: {
  shape: DrawingShape
  stroke: StrokeProps
}): ReactElement | null {
  const b = bbox(shape)
  const fill = shape.fill
  switch (shape.type) {
    case 'rect':
      return (
        <rect
          {...stroke}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={Math.min(8, b.w / 4, b.h / 4)}
          fill={fill}
        />
      )
    case 'ellipse':
      return (
        <ellipse {...stroke} cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={fill} />
      )
    case 'diamond':
      return (
        <polygon
          {...stroke}
          points={`${n(b.x + b.w / 2)},${n(b.y)} ${n(b.x + b.w)},${n(b.y + b.h / 2)} ${n(b.x + b.w / 2)},${n(b.y + b.h)} ${n(b.x)},${n(b.y + b.h / 2)}`}
          fill={fill}
        />
      )
    case 'note': {
      const f = NOTE_FOLD(b)
      const r = b.x + b.w
      const btm = b.y + b.h
      return (
        <g>
          <path
            {...stroke}
            d={`M ${n(b.x)} ${n(b.y)} H ${n(r)} V ${n(btm - f)} L ${n(r - f)} ${n(btm)} H ${n(b.x)} Z`}
            fill={fill}
          />
          <path
            {...stroke}
            d={`M ${n(r - f)} ${n(btm)} V ${n(btm - f)} H ${n(r)}`}
            fill="rgba(0,0,0,0.08)"
          />
        </g>
      )
    }
    case 'cylinder': {
      const ry = CYLINDER_RY(b)
      const rx = b.w / 2
      const cx = b.x + rx
      return (
        <g>
          <path
            {...stroke}
            d={`M ${n(b.x)} ${n(b.y + ry)} V ${n(b.y + b.h - ry)} A ${n(rx)} ${n(ry)} 0 0 0 ${n(b.x + b.w)} ${n(b.y + b.h - ry)} V ${n(b.y + ry)}`}
            fill={fill}
          />
          <ellipse {...stroke} cx={cx} cy={b.y + ry} rx={rx} ry={ry} fill={fill} />
        </g>
      )
    }
    case 'cloud': {
      const p = (u: number, v: number): string => `${n(b.x + u * b.w)} ${n(b.y + v * b.h)}`
      return (
        <path
          {...stroke}
          d={
            `M ${p(0.22, 0.86)} ` +
            `C ${p(0.04, 0.88)} ${p(0.0, 0.58)} ${p(0.16, 0.5)} ` +
            `C ${p(0.08, 0.26)} ${p(0.3, 0.12)} ${p(0.42, 0.28)} ` +
            `C ${p(0.5, 0.02)} ${p(0.76, 0.04)} ${p(0.78, 0.3)} ` +
            `C ${p(0.98, 0.26)} ${p(1.04, 0.56)} ${p(0.88, 0.64)} ` +
            `C ${p(1.0, 0.8)} ${p(0.9, 0.9)} ${p(0.76, 0.86)} Z`
          }
          fill={fill}
        />
      )
    }
    case 'queue': {
      const rx = QUEUE_RX(b)
      const ry = b.h / 2
      return (
        <g>
          <path
            {...stroke}
            d={`M ${n(b.x + rx)} ${n(b.y)} H ${n(b.x + b.w - rx)} V ${n(b.y + b.h)} H ${n(b.x + rx)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(b.x + rx)} ${n(b.y)} Z`}
            fill={fill}
          />
          <ellipse {...stroke} cx={b.x + b.w - rx} cy={b.y + ry} rx={rx} ry={ry} fill={fill} />
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
          <circle {...stroke} cx={cx} cy={b.y + r} r={r} fill={fill} />
          <path
            {...stroke}
            fill="none"
            d={`M ${n(cx)} ${n(neck)} V ${n(hip)} M ${n(cx - reach)} ${n(armY)} H ${n(cx + reach)} M ${n(cx)} ${n(hip)} L ${n(cx - reach)} ${n(b.y + figH)} M ${n(cx)} ${n(hip)} L ${n(cx + reach)} ${n(b.y + figH)}`}
          />
        </g>
      )
    }
    default:
      return null
  }
}
