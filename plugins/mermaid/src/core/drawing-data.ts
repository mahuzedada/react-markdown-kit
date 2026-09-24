/**
 * Ported from @zuilib/text-editor (MIT). Drawing data model: shape types, the DrawingData document, and the lenient parser / serializer for the ```drawing payload (version 3, version 2 migrated on read).
 */
import { isBlockWidth, type BlockWidth } from './block-width.js'

/** Card-like shapes: fillable, bindable, carrying the three text slots */
export type NodeShapeType =
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'note'
  | 'cylinder'
  | 'cloud'
  | 'queue'
  | 'actor'

export type ConnectorType = 'arrow' | 'line'

export type DrawingShapeType = NodeShapeType | ConnectorType | 'text'

export const NODE_SHAPE_TYPES: readonly NodeShapeType[] = [
  'rect',
  'ellipse',
  'diamond',
  'note',
  'cylinder',
  'cloud',
  'queue',
  'actor',
]

export const CONNECTOR_TYPES: readonly ConnectorType[] = ['arrow', 'line']

export const SHAPE_TYPES: readonly DrawingShapeType[] = [
  ...NODE_SHAPE_TYPES,
  ...CONNECTOR_TYPES,
  'text',
]

export function isNodeShapeType(type: string): type is NodeShapeType {
  return (NODE_SHAPE_TYPES as readonly string[]).includes(type)
}

export function isConnectorType(type: string): type is ConnectorType {
  return (CONNECTOR_TYPES as readonly string[]).includes(type)
}

export type Point = Readonly<{ x: number; y: number }>

/** Outline pattern; omitted = solid */
export type StrokeStyle = 'dashed' | 'dotted'
export const STROKE_STYLES: readonly StrokeStyle[] = ['dashed', 'dotted']

/** Arrowhead on an arrow's end (both ends when bidirectional); omitted = a chevron */
export type ArrowHead = 'circle' | 'cross'
export const ARROW_HEADS: readonly ArrowHead[] = ['circle', 'cross']

/** The stroke widths the canvas offers (Excalidraw's thin, medium, bold) */
export const STROKE_WIDTHS = { thin: 1, medium: 2, bold: 4 } as const
export type StrokeWidthName = keyof typeof STROKE_WIDTHS
/** Widths from here up are bold: Mermaid's thick link (`==>`) */
export const THICK_WIDTH = 3

export type BindingSide = 'top' | 'right' | 'bottom' | 'left'

/**
 * Where a connector endpoint attaches to a box.
 *
 * `fixedPoint` is a ratio inside the box's bounding box (`[0,0]` top-left,
 * `[1,1]` bottom-right). Omitted = the box center, which makes the endpoint
 * auto-aim at the other end. `mode: 'inside'` pins the endpoint exactly on
 * the fixed point; the default (`'orbit'`) projects it onto the outline with
 * a small gap.
 */
export type Binding = Readonly<{
  id: string
  fixedPoint?: readonly [number, number]
  mode?: 'orbit' | 'inside'
}>

export type DrawingShape = Readonly<{
  id: string
  type: DrawingShapeType
  /** Top-left corner (boxes/text) or start point (connectors) */
  x: number
  y: number
  /** Size (boxes/text) or delta to the end point (connectors) */
  width: number
  height: number
  stroke: string
  fill: string
  strokeWidth: number
  /** Boxes and connectors: dashed or dotted outline; omitted = solid */
  strokeStyle?: StrokeStyle
  /** Rect: square corners (Mermaid `[text]`); omitted = rounded (`(text)`) */
  corners?: 'sharp'
  /** Boxes and free text: text colour; omitted = derived from the stroke */
  color?: string
  /** Standalone text, main (center) content of a box, or connector label */
  text?: string
  /** Small heading rendered at the top of a box */
  label?: string
  /** Small line rendered at the bottom of a box */
  footer?: string
  /** Connector: box the start point is attached to */
  startBinding?: Binding
  /** Connector: box the end point is attached to */
  endBinding?: Binding
  /** Arrow: arrowheads on both ends */
  bidirectional?: boolean
  /** Arrow: head shape (Mermaid `--o`, `--x`); omitted = a chevron (`-->`) */
  head?: ArrowHead
  /** Connector routing: right-angled auto-routed path instead of a straight line */
  routing?: 'elbow'
  /**
   * Elbow override: position of the middle segment as a fraction of the
   * span, applied only when the routed path is a simple three-segment Z.
   */
  elbow?: number
  /**
   * Connector: intermediate path points between start and end (absolute
   * canvas coordinates). Takes precedence over `routing`.
   */
  waypoints?: readonly Point[]
}>

export type DrawingData = Readonly<{
  version: 3
  /**
   * Logical canvas width. When set the drawing is scaled to fit narrower
   * layouts (SVG viewBox); when omitted the canvas is fluid and shapes are
   * in CSS pixels.
   */
  canvasWidth?: number
  canvasHeight: number
  /**
   * Block width: `full` (default) spans the editor; `text` aligns with the
   * text column; `content` fits the shapes' horizontal extent. The editor
   * omits `full` unless it was written explicitly (an insertion default or
   * the source payload); unknown values are dropped.
   */
  width?: BlockWidth
  /** Accessible name of the drawing (SVG `aria-label`) */
  title?: string
  /** Longer accessible description of the drawing */
  description?: string
  shapes: readonly DrawingShape[]
}>

export const DEFAULT_CANVAS_HEIGHT = 320
export const MIN_CANVAS_HEIGHT = 80
/** Shapes beyond this are dropped by `normalizeDrawingData` */
export const MAX_SHAPES = 5000
/** Coordinates and sizes are clamped to ±this */
export const MAX_COORDINATE = 100_000
/** Longest accepted `title` / `description` */
const MAX_TEXT_LENGTH = 2000

/**
 * A CSS colour the renderer will accept: hex, `rgb()` / `rgba()`, `hsl()` /
 * `hsla()`, `oklch()` / `oklab()` with plain numeric arguments, or a named
 * colour (letters only). Anything else — `url()`, `var()`, nested
 * functions, stray characters — is rejected.
 */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch|oklab)\([\w.,%\s/+-]*\)|[a-z]+)$/i

export function isSafeColor(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && SAFE_COLOR.test(value)
}

export const FONT_SIZE = 15
export const SMALL_FONT_SIZE = 11
export const LINE_HEIGHT = 1.35

export const EMPTY_DRAWING: DrawingData = {
  version: 3,
  canvasHeight: DEFAULT_CANVAS_HEIGHT,
  shapes: [],
}

export const STROKE_COLORS = [
  '#1e1e1e',
  '#e03131',
  '#2f9e44',
  '#1971c2',
  '#f08c00',
  '#7048e8',
] as const

export const FILL_COLORS = [
  'transparent',
  '#ffc9c9',
  '#b2f2bb',
  '#a5d8ff',
  '#ffec99',
  '#d0bfff',
] as const

let shapeIdCounter = 0

export function createShapeId(): string {
  shapeIdCounter += 1
  return `s${Date.now().toString(36)}${shapeIdCounter.toString(36)}`
}

/** Edge midpoints, used by the ```diagram skeleton's `side` option */
export const SIDE_FIXED_POINTS: Record<BindingSide, readonly [number, number]> = {
  top: [0.5, 0],
  right: [1, 0.5],
  bottom: [0.5, 1],
  left: [0, 0.5],
}

export function serializeDrawingData(data: DrawingData): string {
  return JSON.stringify(data)
}

/**
 * Parse a ```drawing payload. Version 3 is the format the editor writes;
 * version 2 (shape sizes as `w`/`h`) is migrated on read so persisted
 * drawings keep loading (the ```diagram skeleton is a separate block type,
 * see skeleton.ts). Shapes that fail validation are dropped and a malformed
 * document yields an empty canvas. Never throws.
 */
export function deserializeDrawingData(json: string): DrawingData {
  try {
    return normalizeDrawingData(JSON.parse(json))
  } catch {
    return EMPTY_DRAWING
  }
}

let warnedTruncation = false
function warnOnce(message: string): void {
  if (warnedTruncation) return
  warnedTruncation = true
  console.warn(message)
}

/** Version 2 persisted shape sizes as `w`/`h`; version 3 spells them out */
function migrateShapeV2(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  const { w, h, ...rest } = raw
  return { ...rest, width: w, height: h }
}

/**
 * Normalize a parsed payload. Version 2 payloads are migrated to version 3
 * (`w`/`h` → `width`/`height`). Payloads over `MAX_SHAPES` are truncated;
 * `onWarn` hears about it (default: one `console.warn` per session, since
 * the node re-parses on every read).
 */
export function normalizeDrawingData(
  parsed: unknown,
  onWarn: (message: string) => void = warnOnce
): DrawingData {
  if (
    !isRecord(parsed) ||
    (parsed.version !== 2 && parsed.version !== 3) ||
    !Array.isArray(parsed.shapes)
  ) {
    return EMPTY_DRAWING
  }
  let rawShapes: unknown[] =
    parsed.version === 2 ? parsed.shapes.map(migrateShapeV2) : parsed.shapes
  if (rawShapes.length > MAX_SHAPES) {
    onWarn(`Drawing has ${rawShapes.length} shapes; keeping the first ${MAX_SHAPES}`)
    rawShapes = rawShapes.slice(0, MAX_SHAPES)
  }
  const shapes = rawShapes.flatMap((raw) => {
    const shape = normalizeShape(raw)
    return shape ? [shape] : []
  })
  const ids = new Set(shapes.map((s) => s.id))
  const height = numberOr(parsed.canvasHeight, NaN)
  const canvasWidth = numberOr(parsed.canvasWidth, NaN)
  const title = accessibleText(parsed.title)
  const description = accessibleText(parsed.description)
  return {
    version: 3,
    canvasHeight:
      Number.isFinite(height) && height >= MIN_CANVAS_HEIGHT
        ? height
        : DEFAULT_CANVAS_HEIGHT,
    ...(Number.isFinite(canvasWidth) && canvasWidth >= 120
      ? { canvasWidth }
      : {}),
    // `full` stays implicit unless the payload spells it out; unknown
    // values (newer versions) are dropped rather than rejected
    ...(isBlockWidth(parsed.width) ? { width: parsed.width } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    // Bindings to ids that don't exist (or aren't boxes) are dropped
    shapes: shapes.map((shape) => {
      if (!isConnectorType(shape.type)) return shape
      const startBinding = validBinding(shape.startBinding, ids, shapes)
      const endBinding = validBinding(shape.endBinding, ids, shapes)
      if (startBinding === shape.startBinding && endBinding === shape.endBinding) {
        return shape
      }
      return withBindings(shape, startBinding, endBinding)
    }),
  }
}

/**
 * Copy of `shape` carrying exactly the given bindings. An undefined binding
 * removes the key instead of storing `undefined` (which
 * `exactOptionalPropertyTypes` forbids); existing keys keep their position
 * so the serialized key order is unchanged.
 */
export function withBindings(
  shape: DrawingShape,
  startBinding: Binding | undefined,
  endBinding: Binding | undefined
): DrawingShape {
  const next: { -readonly [K in keyof DrawingShape]: DrawingShape[K] } = { ...shape }
  if (startBinding) next.startBinding = startBinding
  else delete next.startBinding
  if (endBinding) next.endBinding = endBinding
  else delete next.endBinding
  return next
}

function validBinding(
  binding: Binding | undefined,
  ids: Set<string>,
  shapes: readonly DrawingShape[]
): Binding | undefined {
  if (!binding || !ids.has(binding.id)) return undefined
  const target = shapes.find((s) => s.id === binding.id)
  return target && isNodeShapeType(target.type) ? binding : undefined
}

export function isStrokeStyle(value: unknown): value is StrokeStyle {
  return typeof value === 'string' && (STROKE_STYLES as readonly string[]).includes(value)
}

export function isArrowHead(value: unknown): value is ArrowHead {
  return typeof value === 'string' && (ARROW_HEADS as readonly string[]).includes(value)
}

/**
 * SVG `stroke-dasharray` for a shape's stroke style, scaled by its width
 * the way Excalidraw's are (round caps turn the short dashes into dots)
 */
export function strokeDashArray(shape: Pick<DrawingShape, 'strokeStyle' | 'strokeWidth'>): string | undefined {
  if (shape.strokeStyle === 'dashed') return `8 ${8 + shape.strokeWidth}`
  if (shape.strokeStyle === 'dotted') return `1.5 ${6 + shape.strokeWidth}`
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function accessibleText(value: unknown): string | undefined {
  const text = optionalString(value)?.trim()
  return text ? text.slice(0, MAX_TEXT_LENGTH) : undefined
}

function clampCoordinate(n: number): number {
  return Math.min(MAX_COORDINATE, Math.max(-MAX_COORDINATE, n))
}

function normalizeBinding(value: unknown): Binding | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) {
    return undefined
  }
  const binding: { id: string; fixedPoint?: [number, number]; mode?: 'inside' } = {
    id: value.id,
  }
  const fp = value.fixedPoint
  if (
    Array.isArray(fp) &&
    fp.length === 2 &&
    typeof fp[0] === 'number' &&
    typeof fp[1] === 'number'
  ) {
    binding.fixedPoint = [clamp01(fp[0]), clamp01(fp[1])]
  }
  if (value.mode === 'inside') binding.mode = 'inside'
  return binding
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function normalizeShape(value: unknown): DrawingShape | null {
  if (!isRecord(value)) return null
  const type = value.type
  if (
    typeof value.id !== 'string' ||
    !value.id ||
    typeof type !== 'string' ||
    !(SHAPE_TYPES as readonly string[]).includes(type) ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    typeof value.width !== 'number' ||
    typeof value.height !== 'number' ||
    ![value.x, value.y, value.width, value.height].every(Number.isFinite)
  ) {
    return null
  }
  const shape: {
    -readonly [K in keyof DrawingShape]: DrawingShape[K]
  } = {
    id: value.id,
    type: type as DrawingShapeType,
    x: clampCoordinate(value.x),
    y: clampCoordinate(value.y),
    width: clampCoordinate(value.width),
    height: clampCoordinate(value.height),
    stroke: isSafeColor(value.stroke) ? value.stroke : STROKE_COLORS[0],
    fill: isSafeColor(value.fill) ? value.fill : 'transparent',
    strokeWidth: Math.min(100, Math.max(0, numberOr(value.strokeWidth, 2))),
  }
  const text = optionalString(value.text)
  if (text !== undefined) shape.text = text
  if (shape.type !== 'text' && isStrokeStyle(value.strokeStyle)) shape.strokeStyle = value.strokeStyle
  if (!isConnectorType(shape.type) && isSafeColor(value.color)) shape.color = value.color
  if (shape.type === 'rect' && value.corners === 'sharp') shape.corners = 'sharp'
  if (isNodeShapeType(shape.type)) {
    const label = optionalString(value.label)
    const footer = optionalString(value.footer)
    if (label !== undefined) shape.label = label
    if (footer !== undefined) shape.footer = footer
    // Boxes always have a non-negative size
    if (shape.width < 0) {
      shape.x += shape.width
      shape.width = -shape.width
    }
    if (shape.height < 0) {
      shape.y += shape.height
      shape.height = -shape.height
    }
  }
  if (isConnectorType(shape.type)) {
    const startBinding = normalizeBinding(value.startBinding)
    const endBinding = normalizeBinding(value.endBinding)
    if (startBinding) shape.startBinding = startBinding
    if (endBinding) shape.endBinding = endBinding
    if (shape.type === 'arrow' && value.bidirectional === true) {
      shape.bidirectional = true
    }
    if (shape.type === 'arrow' && isArrowHead(value.head)) shape.head = value.head
    if (value.routing === 'elbow') shape.routing = 'elbow'
    if (typeof value.elbow === 'number' && Number.isFinite(value.elbow)) {
      shape.elbow = clamp01(value.elbow)
    }
    if (Array.isArray(value.waypoints)) {
      const waypoints = value.waypoints.flatMap((p) =>
        isRecord(p) &&
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y)
          ? [{ x: p.x, y: p.y }]
          : []
      )
      if (waypoints.length) shape.waypoints = waypoints
    }
  }
  return shape
}
