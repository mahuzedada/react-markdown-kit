/**
 * Ported from @zuilib/text-editor (MIT). Geometry of each box type: default size, text slots, outline and text area.
 */
import {
  bbox,
  ellipsePolygon,
  rectPolygon,
  type Rect,
} from '../geometry.js'
import type { NodeShapeType, DrawingShape, Point } from '../drawing-data.js'

export type TextField = 'text' | 'label' | 'footer'

/** Horizontal/vertical padding inside a box before its texts wrap */
export const BOX_TEXT_PADDING = 8

/**
 * Geometry of a box type, kept free of React so the router, bindings,
 * skeleton expansion and exporters can use it without a DOM.
 */
export type NodeShapeDefinition = Readonly<{
  type: NodeShapeType
  label: string
  /** Size used when a shape is created without explicit dimensions */
  defaultSize: Readonly<{ w: number; h: number }>
  /** Text slots the shape renders (and offers for editing) */
  textSlots: readonly TextField[]
  /** Fill applied when the tool is picked with the default (transparent) fill */
  defaultFill?: string
  /** Closed outline used for hit-testing and binding endpoints */
  outline: (shape: DrawingShape) => Point[]
  /** Area the text slots lay out in */
  textArea: (shape: DrawingShape) => Rect
}>

function inset(r: Rect, dx: number, dy: number = dx): Rect {
  return {
    x: r.x + dx,
    y: r.y + dy,
    w: Math.max(r.w - dx * 2, 20),
    h: Math.max(r.h - dy * 2, 10),
  }
}

/** Inscribed rectangle of an ellipse: sides scaled by 1/√2 */
function ellipseInscribed(r: Rect): Rect {
  const k = (1 - Math.SQRT1_2) / 2
  return inset(r, r.w * k, r.h * k)
}

export const NOTE_FOLD = (r: Rect): number => Math.min(18, r.w / 4, r.h / 4)
export const CYLINDER_RY = (r: Rect): number => Math.min(r.h * 0.14, 18)
export const QUEUE_RX = (r: Rect): number => Math.min(r.w * 0.12, 18)
/** Fraction of the actor's height taken by the stick figure */
export const ACTOR_FIGURE_RATIO = 0.62

function halfEllipse(
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

export const NODE_SHAPE_DEFINITIONS: Record<NodeShapeType, NodeShapeDefinition> = {
  rect: {
    type: 'rect',
    label: 'Rectangle',
    defaultSize: { w: 160, h: 90 },
    textSlots: ['label', 'text', 'footer'],
    outline: (s) => rectPolygon(bbox(s)),
    textArea: (s) => inset(bbox(s), BOX_TEXT_PADDING),
  },
  ellipse: {
    type: 'ellipse',
    label: 'Ellipse',
    defaultSize: { w: 160, h: 90 },
    textSlots: ['label', 'text', 'footer'],
    outline: (s) => ellipsePolygon(bbox(s)),
    textArea: (s) => inset(ellipseInscribed(bbox(s)), 2),
  },
  diamond: {
    type: 'diamond',
    label: 'Diamond',
    defaultSize: { w: 170, h: 100 },
    textSlots: ['label', 'text', 'footer'],
    outline: (s) => {
      const b = bbox(s)
      return [
        { x: b.x + b.w / 2, y: b.y },
        { x: b.x + b.w, y: b.y + b.h / 2 },
        { x: b.x + b.w / 2, y: b.y + b.h },
        { x: b.x, y: b.y + b.h / 2 },
      ]
    },
    textArea: (s) => {
      const b = bbox(s)
      return inset(b, b.w / 4, b.h / 4)
    },
  },
  note: {
    type: 'note',
    label: 'Note',
    defaultSize: { w: 160, h: 110 },
    textSlots: ['label', 'text', 'footer'],
    defaultFill: '#ffec99',
    outline: (s) => {
      const b = bbox(s)
      const f = NOTE_FOLD(b)
      return [
        { x: b.x, y: b.y },
        { x: b.x + b.w, y: b.y },
        { x: b.x + b.w, y: b.y + b.h - f },
        { x: b.x + b.w - f, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
      ]
    },
    textArea: (s) => {
      const b = bbox(s)
      const f = NOTE_FOLD(b)
      return {
        x: b.x + BOX_TEXT_PADDING,
        y: b.y + BOX_TEXT_PADDING,
        w: Math.max(b.w - BOX_TEXT_PADDING * 2, 20),
        h: Math.max(b.h - BOX_TEXT_PADDING * 2 - f / 2, 10),
      }
    },
  },
  cylinder: {
    type: 'cylinder',
    label: 'Database',
    defaultSize: { w: 140, h: 110 },
    textSlots: ['label', 'text', 'footer'],
    outline: (s) => {
      const b = bbox(s)
      const ry = CYLINDER_RY(b)
      const cx = b.x + b.w / 2
      return [
        ...halfEllipse(cx, b.y + ry, b.w / 2, ry, Math.PI, 2 * Math.PI),
        ...halfEllipse(cx, b.y + b.h - ry, b.w / 2, ry, 0, Math.PI),
      ]
    },
    textArea: (s) => {
      const b = bbox(s)
      const ry = CYLINDER_RY(b)
      return {
        x: b.x + BOX_TEXT_PADDING,
        y: b.y + ry * 2 + 4,
        w: Math.max(b.w - BOX_TEXT_PADDING * 2, 20),
        h: Math.max(b.h - ry * 3 - 8, 10),
      }
    },
  },
  cloud: {
    type: 'cloud',
    label: 'Cloud',
    defaultSize: { w: 180, h: 110 },
    textSlots: ['label', 'text', 'footer'],
    outline: (s) => ellipsePolygon(bbox(s)),
    textArea: (s) => {
      const b = bbox(s)
      return inset(b, b.w * 0.17, b.h * 0.2)
    },
  },
  queue: {
    type: 'queue',
    label: 'Queue',
    defaultSize: { w: 180, h: 80 },
    textSlots: ['label', 'text', 'footer'],
    outline: (s) => {
      const b = bbox(s)
      const rx = QUEUE_RX(b)
      const cy = b.y + b.h / 2
      return [
        ...halfEllipse(b.x + b.w - rx, cy, rx, b.h / 2, -Math.PI / 2, Math.PI / 2),
        ...halfEllipse(b.x + rx, cy, rx, b.h / 2, Math.PI / 2, (3 * Math.PI) / 2),
      ]
    },
    textArea: (s) => {
      const b = bbox(s)
      const rx = QUEUE_RX(b)
      return {
        x: b.x + rx + 4,
        y: b.y + 6,
        w: Math.max(b.w - rx * 3 - 8, 20),
        h: Math.max(b.h - 12, 10),
      }
    },
  },
  actor: {
    type: 'actor',
    label: 'Actor',
    defaultSize: { w: 90, h: 120 },
    textSlots: ['text'],
    outline: (s) => rectPolygon(bbox(s)),
    textArea: (s) => {
      const b = bbox(s)
      const top = b.y + b.h * ACTOR_FIGURE_RATIO
      return {
        x: b.x - 20,
        y: top,
        w: b.w + 40,
        h: Math.max(b.y + b.h - top, 10),
      }
    },
  },
}

export function nodeShapeDefinition(shape: DrawingShape): NodeShapeDefinition | null {
  return (NODE_SHAPE_DEFINITIONS as Partial<Record<string, NodeShapeDefinition>>)[shape.type] ?? null
}
