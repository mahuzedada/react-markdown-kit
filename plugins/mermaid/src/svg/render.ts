/**
 * Static SVG for a drawing, as hast.
 *
 * This is the renderer's half of the diagram: the same geometry the canvas
 * uses (outlines, text slots, bound endpoints, elbow routing, arrowheads)
 * emitted once as plain hast elements, so it server-renders, needs no DOM and
 * no React, and looks like what the author saw in the editor. Colours come
 * from the payload and land as attributes; the stylesheet never hard-codes
 * one, which is the styling contract.
 */
import type { Element, ElementContent } from 'hast'
import {
  FONT_SIZE,
  LINE_HEIGHT,
  SMALL_FONT_SIZE,
  isConnectorType,
  isNodeShapeType,
  type DrawingData,
  type DrawingShape,
  type Point,
} from '../core/drawing-data.js'
import { bbox, textBoxSize, wrapText, type Rect } from '../core/geometry.js'
import { arrowHeads, connectorMidpoint, connectorPoints, polylinePath } from '../core/connectors.js'
import { nodeShapeDefinition } from '../core/shapes/definitions.js'
import { ACTOR_FIGURE_RATIO, CYLINDER_RY, NOTE_FOLD, QUEUE_RX } from '../core/shapes/definitions.js'
import { h, n, text } from './hast.js'

const CONNECTOR_FONT_SIZE = 12
const CONNECTOR_LABEL_MAX_WIDTH = 160
/** Room kept right of the widest shape when the drawing has no fixed width. */
const FLUID_MARGIN = 32
const MIN_FLUID_WIDTH = 320

export interface RenderSvgOptions {
  /** Accessible name when the payload has none. */
  readonly fallbackTitle?: string
}

export function renderDrawingSvg(data: DrawingData, options: RenderSvgOptions = {}): Element {
  const width = data.canvasWidth ?? fluidWidth(data)
  const height = data.canvasHeight
  const title = data.title ?? options.fallbackTitle
  const children: ElementContent[] = []
  if (title !== undefined) children.push(h('title', {}, [text(title)]))
  if (data.description !== undefined) children.push(h('desc', {}, [text(data.description)]))
  for (const shape of data.shapes) children.push(shapeElement(shape, data.shapes))

  return h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${n(width)} ${n(height)}`,
      width: n(width),
      height: n(height),
      role: 'img',
      ...(title === undefined ? { ariaHidden: 'true' } : { ariaLabel: title }),
      ...(data.width === undefined ? {} : { dataWidth: data.width }),
    },
    children,
  )
}

function fluidWidth(data: DrawingData): number {
  let right = 0
  for (const shape of data.shapes) {
    const b = bbox(shape)
    right = Math.max(right, b.x + b.w)
  }
  return Math.max(MIN_FLUID_WIDTH, right + FLUID_MARGIN)
}

/* ----------------------------------------------------------------- shapes */

function strokeProps(shape: DrawingShape): Record<string, string> {
  return {
    stroke: shape.stroke,
    strokeWidth: n(shape.strokeWidth),
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
}

function shapeElement(shape: DrawingShape, shapes: readonly DrawingShape[]): Element {
  if (isNodeShapeType(shape.type)) {
    return h('g', { dataShape: shape.type }, [...boxGeometry(shape), ...boxTexts(shape)])
  }
  if (isConnectorType(shape.type)) {
    const points = connectorPoints(shape, shapes)
    const stroke = strokeProps(shape)
    const parts: ElementContent[] = [h('path', { ...stroke, d: polylinePath(points), fill: 'none' })]
    for (const d of arrowHeads(shape, points)) parts.push(h('path', { ...stroke, d, fill: 'none' }))
    if (shape.text) parts.push(connectorLabel(shape, points))
    return h('g', { dataShape: shape.type }, parts)
  }
  return freeText(shape)
}

/** Outline of a box, mirroring the canvas's `BoxGeometry` case by case. */
function boxGeometry(shape: DrawingShape): Element[] {
  const b = bbox(shape)
  const stroke = strokeProps(shape)
  const fill = shape.fill
  switch (shape.type) {
    case 'rect':
      return [
        h('rect', { ...stroke, x: n(b.x), y: n(b.y), width: n(b.w), height: n(b.h), rx: n(Math.min(8, b.w / 4, b.h / 4)), fill }),
      ]
    case 'ellipse':
      return [h('ellipse', { ...stroke, cx: n(b.x + b.w / 2), cy: n(b.y + b.h / 2), rx: n(b.w / 2), ry: n(b.h / 2), fill })]
    case 'diamond':
      return [
        h('polygon', {
          ...stroke,
          points: `${n(b.x + b.w / 2)},${n(b.y)} ${n(b.x + b.w)},${n(b.y + b.h / 2)} ${n(b.x + b.w / 2)},${n(b.y + b.h)} ${n(b.x)},${n(b.y + b.h / 2)}`,
          fill,
        }),
      ]
    case 'note': {
      const f = NOTE_FOLD(b)
      const r = b.x + b.w
      const bottom = b.y + b.h
      return [
        h('path', { ...stroke, d: `M ${n(b.x)} ${n(b.y)} H ${n(r)} V ${n(bottom - f)} L ${n(r - f)} ${n(bottom)} H ${n(b.x)} Z`, fill }),
        h('path', { ...stroke, d: `M ${n(r - f)} ${n(bottom)} V ${n(bottom - f)} H ${n(r)}`, fill: 'rgba(0,0,0,0.08)' }),
      ]
    }
    case 'cylinder': {
      const ry = CYLINDER_RY(b)
      const rx = b.w / 2
      return [
        h('path', {
          ...stroke,
          d: `M ${n(b.x)} ${n(b.y + ry)} V ${n(b.y + b.h - ry)} A ${n(rx)} ${n(ry)} 0 0 0 ${n(b.x + b.w)} ${n(b.y + b.h - ry)} V ${n(b.y + ry)}`,
          fill,
        }),
        h('ellipse', { ...stroke, cx: n(b.x + rx), cy: n(b.y + ry), rx: n(rx), ry: n(ry), fill }),
      ]
    }
    case 'cloud': {
      const p = (u: number, v: number): string => `${n(b.x + u * b.w)} ${n(b.y + v * b.h)}`
      return [
        h('path', {
          ...stroke,
          d:
            `M ${p(0.22, 0.86)} ` +
            `C ${p(0.04, 0.88)} ${p(0.0, 0.58)} ${p(0.16, 0.5)} ` +
            `C ${p(0.08, 0.26)} ${p(0.3, 0.12)} ${p(0.42, 0.28)} ` +
            `C ${p(0.5, 0.02)} ${p(0.76, 0.04)} ${p(0.78, 0.3)} ` +
            `C ${p(0.98, 0.26)} ${p(1.04, 0.56)} ${p(0.88, 0.64)} ` +
            `C ${p(1.0, 0.8)} ${p(0.9, 0.9)} ${p(0.76, 0.86)} Z`,
          fill,
        }),
      ]
    }
    case 'queue': {
      const rx = QUEUE_RX(b)
      const ry = b.h / 2
      return [
        h('path', {
          ...stroke,
          d: `M ${n(b.x + rx)} ${n(b.y)} H ${n(b.x + b.w - rx)} V ${n(b.y + b.h)} H ${n(b.x + rx)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(b.x + rx)} ${n(b.y)} Z`,
          fill,
        }),
        h('ellipse', { ...stroke, cx: n(b.x + b.w - rx), cy: n(b.y + ry), rx: n(rx), ry: n(ry), fill }),
      ]
    }
    case 'actor': {
      const figH = b.h * ACTOR_FIGURE_RATIO
      const cx = b.x + b.w / 2
      const r = Math.max(4, Math.min(figH * 0.16, b.w * 0.2))
      const neck = b.y + r * 2
      const hip = b.y + figH * 0.62
      const armY = neck + figH * 0.12
      const reach = Math.min(b.w * 0.32, figH * 0.3)
      return [
        h('circle', { ...stroke, cx: n(cx), cy: n(b.y + r), r: n(r), fill }),
        h('path', {
          ...stroke,
          fill: 'none',
          d: `M ${n(cx)} ${n(neck)} V ${n(hip)} M ${n(cx - reach)} ${n(armY)} H ${n(cx + reach)} M ${n(cx)} ${n(hip)} L ${n(cx - reach)} ${n(b.y + figH)} M ${n(cx)} ${n(hip)} L ${n(cx + reach)} ${n(b.y + figH)}`,
        }),
      ]
    }
    default:
      return []
  }
}

/* ------------------------------------------------------------------ text */

/** Relative luminance of a #rgb/#rrggbb colour (1 for anything else). */
function luminance(color: string): number {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)
  if (match === null) return 1
  const raw = match[1] ?? ''
  const hex = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

/** Text colour: the stroke, except on borderless (dark text) and dark-filled (light text) shapes. */
function textColorFor(shape: DrawingShape): string {
  if (shape.stroke === 'transparent' || shape.stroke === 'none') return '#1e1e1e'
  if (luminance(shape.fill) < 0.35) return '#ffffff'
  return shape.stroke
}

function slotLayout(shape: DrawingShape): { area: Rect; slots: readonly string[] } {
  const definition = nodeShapeDefinition(shape)
  return {
    area: definition ? definition.textArea(shape) : bbox(shape),
    slots: definition ? definition.textSlots : ['label', 'text', 'footer'],
  }
}

function boxTexts(shape: DrawingShape): Element[] {
  const { area, slots } = slotLayout(shape)
  const cx = area.x + area.w / 2
  const wrapW = Math.max(area.w, 20)
  const fill = textColorFor(shape)
  const out: Element[] = []
  const line = (value: string, y: number, extra: Record<string, string>): Element =>
    h('text', { x: n(cx), y: n(y), fill, textAnchor: 'middle', ...extra }, [text(value)])

  if (slots.includes('label') && shape.label) {
    const lines = wrapText(shape.label, wrapW, SMALL_FONT_SIZE)
    const lineH = SMALL_FONT_SIZE * LINE_HEIGHT
    lines.forEach((value, i) => {
      out.push(line(value, area.y + SMALL_FONT_SIZE + i * lineH, { fontSize: n(SMALL_FONT_SIZE), fontWeight: '600', letterSpacing: '0.3', opacity: '0.85' }))
    })
  }
  if (slots.includes('text') && shape.text) {
    const lines = wrapText(shape.text, wrapW, FONT_SIZE)
    const lineH = FONT_SIZE * LINE_HEIGHT
    const start = area.y + area.h / 2 - ((lines.length - 1) * lineH) / 2 + FONT_SIZE * 0.35
    lines.forEach((value, i) => {
      out.push(line(value, start + i * lineH, { fontSize: n(FONT_SIZE) }))
    })
  }
  if (slots.includes('footer') && shape.footer) {
    const lines = wrapText(shape.footer, wrapW, SMALL_FONT_SIZE)
    const lineH = SMALL_FONT_SIZE * LINE_HEIGHT
    lines.forEach((value, i) => {
      out.push(line(value, area.y + area.h - 3 - (lines.length - 1 - i) * lineH, { fontSize: n(SMALL_FONT_SIZE), opacity: '0.65' }))
    })
  }
  return out
}

/** Connector label on a small backing plate at the path midpoint. */
function connectorLabel(shape: DrawingShape, points: readonly Point[]): Element {
  const lines = wrapText(shape.text ?? '', CONNECTOR_LABEL_MAX_WIDTH, CONNECTOR_FONT_SIZE)
  const size = textBoxSize(lines.join('\n'), CONNECTOR_FONT_SIZE)
  const { x: midX, y: midY } = connectorMidpoint(points)
  const lineH = CONNECTOR_FONT_SIZE * LINE_HEIGHT
  const startY = midY - ((lines.length - 1) * lineH) / 2 + CONNECTOR_FONT_SIZE * 0.35
  return h('g', {}, [
    h('rect', {
      x: n(midX - size.w / 2 - 5),
      y: n(midY - size.h / 2 - 3),
      width: n(size.w + 10),
      height: n(size.h + 6),
      rx: '5',
      fill: 'var(--rmk-diagram-plate, #ffffff)',
      opacity: '0.94',
    }),
    ...lines.map((value, i) =>
      h('text', { x: n(midX), y: n(startY + i * lineH), fill: shape.stroke, fontSize: n(CONNECTOR_FONT_SIZE), textAnchor: 'middle' }, [text(value)]),
    ),
  ])
}

function freeText(shape: DrawingShape): Element {
  const lines = (shape.text ?? '').split('\n')
  return h(
    'text',
    { x: n(shape.x), y: n(shape.y + FONT_SIZE), fill: shape.stroke, fontSize: n(FONT_SIZE), style: 'white-space: pre' },
    lines.map((value, i) => h('tspan', { x: n(shape.x), dy: i === 0 ? '0' : n(FONT_SIZE * LINE_HEIGHT) }, [text(value)])),
  )
}
