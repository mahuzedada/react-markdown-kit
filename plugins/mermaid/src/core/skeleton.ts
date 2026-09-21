/**
 * Ported from @zuilib/text-editor (MIT). The ```diagram skeleton: compact intent description, auto layout and expansion into DrawingData, plus its JSON Schema.
 */
/**
 * Skeleton (intent) layer: a compact, LLM-friendly description of a diagram
 * — boxes, connectors between them and loose texts — that expands into a
 * full `DrawingData` document. Sizes, positions and connector geometry are
 * derived, so a generator only needs to say *what* is on the canvas.
 */
import { isBlockWidth, type BlockWidth } from './block-width.js'
import { resolveBindings } from './bindings.js'
import { bbox, textBoxSize, wrapText } from './geometry.js'
import { NODE_SHAPE_DEFINITIONS, type TextField } from './shapes/definitions.js'
import {
  NODE_SHAPE_TYPES,
  CONNECTOR_TYPES,
  EMPTY_DRAWING,
  FONT_SIZE,
  isNodeShapeType,
  isConnectorType,
  SIDE_FIXED_POINTS,
  SMALL_FONT_SIZE,
  type Binding,
  type BindingSide,
  type NodeShapeType,
  type ConnectorType,
  type DrawingData,
  type DrawingShape,
  type Point,
  normalizeDrawingData,
} from './drawing-data.js'

export type ColorName =
  | 'plain'
  | 'black'
  | 'gray'
  | 'red'
  | 'green'
  | 'blue'
  | 'orange'
  | 'purple'

export const COLOR_PRESETS: Record<ColorName, { stroke: string; fill: string }> = {
  /** No outline, light surface; text stays dark */
  plain: { stroke: 'transparent', fill: '#f1f3f5' },
  /** Solid dark card; text renders light */
  black: { stroke: '#1e1e1e', fill: '#1e1e1e' },
  gray: { stroke: '#1e1e1e', fill: 'transparent' },
  red: { stroke: '#e03131', fill: '#ffc9c9' },
  green: { stroke: '#2f9e44', fill: '#b2f2bb' },
  blue: { stroke: '#1971c2', fill: '#a5d8ff' },
  orange: { stroke: '#f08c00', fill: '#ffec99' },
  purple: { stroke: '#7048e8', fill: '#d0bfff' },
}

const COLOR_NAMES = Object.keys(COLOR_PRESETS) as readonly ColorName[]

export type SkeletonBox = Readonly<{
  id: string
  /** Default `'rect'` */
  type?: NodeShapeType
  label?: string
  text?: string
  footer?: string
  /** Omitted → auto layout */
  x?: number
  y?: number
  /** Omitted → measured from the text, never smaller than the type's default size */
  w?: number
  h?: number
  /** Preset → stroke + fill (fill only when `fill` isn't given) */
  color?: ColorName
  stroke?: string
  fill?: string
}>

export type SkeletonEnd = string | Readonly<{ id: string; side?: BindingSide }>

export type SkeletonConnector = Readonly<{
  id?: string
  /** Default `'arrow'` */
  type?: ConnectorType
  from: SkeletonEnd
  to: SkeletonEnd
  text?: string
  bidirectional?: boolean
  /** Default `'straight'` */
  routing?: 'elbow' | 'straight'
  color?: ColorName
  stroke?: string
}>

export type SkeletonText = Readonly<{
  id?: string
  x: number
  y: number
  text: string
  color?: ColorName
  stroke?: string
}>

export type DrawingSkeleton = Readonly<{
  /** Auto-layout flow direction, default `'right'` */
  direction?: 'right' | 'down'
  canvasWidth?: number
  canvasHeight?: number
  /** Block width of the expanded drawing; omit for `full` */
  width?: BlockWidth
  boxes: readonly SkeletonBox[]
  connectors?: readonly SkeletonConnector[]
  texts?: readonly SkeletonText[]
}>

/** Width `text` wraps at before a box without `w` is measured */
const TEXT_WRAP_WIDTH = 260
/** Vertical gap between the text slots of a box */
const SLOT_GAP = 6
/** Gap between consecutive ranks along the flow direction */
const RANK_GAP = 90
/** Gap between boxes stacked within a rank */
const STACK_GAP = 40
const LAYOUT_ORIGIN = 32
const CANVAS_MARGIN = 32
const MIN_AUTO_CANVAS_HEIGHT = 120
const DEFAULT_STROKE = '#1e1e1e'
const STROKE_WIDTH = 2

type Size = Readonly<{ w: number; h: number }>

/** Structural check: an object with a `boxes` array */
export function isDrawingSkeleton(value: unknown): value is DrawingSkeleton {
  return isRecord(value) && Array.isArray(value.boxes)
}

/**
 * Parse a skeleton JSON payload into drawing data. Lenient: invalid boxes,
 * connectors and texts are dropped individually, and a malformed document
 * yields an empty canvas. Never throws.
 */
export function parseDrawingSkeleton(json: string): DrawingData {
  try {
    const parsed: unknown = JSON.parse(json)
    if (!isDrawingSkeleton(parsed)) return EMPTY_DRAWING
    return expandDrawingSkeleton(normalizeSkeleton(parsed))
  } catch {
    return EMPTY_DRAWING
  }
}

export function expandDrawingSkeleton(skeleton: DrawingSkeleton): DrawingData {
  const boxes = dedupeById(skeleton.boxes)
  const boxTypes = new Map(boxes.map((box) => [box.id, box.type ?? ('rect' as const)]))
  const sizes = new Map(boxes.map((box) => [box.id, measureBox(box, boxTypes.get(box.id)!)]))
  const boxIds = new Set(boxTypes.keys())
  // Connectors to unknown boxes and self-loops are dropped
  const connectors = (skeleton.connectors ?? []).filter(
    (c) =>
      boxIds.has(endId(c.from)) && boxIds.has(endId(c.to)) && endId(c.from) !== endId(c.to)
  )
  const positions = layoutBoxes(boxes, sizes, connectors, skeleton.direction ?? 'right')

  const boxShapes = boxes.map((box) =>
    expandBox(box, boxTypes.get(box.id)!, sizes.get(box.id)!, positions.get(box.id)!)
  )
  const centers = new Map(boxShapes.map((shape) => [shape.id, shapeCenter(shape)]))
  // Generated ids are deterministic so the same skeleton always expands to
  // the same payload
  const used = new Set(boxIds)
  const nextId = (prefix: string): string => {
    let i = used.size + 1
    while (used.has(`${prefix}${i}`)) i += 1
    const id = `${prefix}${i}`
    used.add(id)
    return id
  }
  const connectorShapes = connectors.map((c) => expandConnector(c, centers, nextId('c')))
  const textShapes = (skeleton.texts ?? []).map((t) => expandText(t, nextId('t')))

  const shapes = resolveBindings([...boxShapes, ...connectorShapes, ...textShapes])
  const bottom = shapes.reduce((max, shape) => {
    const b = bbox(shape)
    return Math.max(max, b.y + b.h)
  }, 0)

  // Normalize so key order and validation match the concrete parser
  return normalizeDrawingData({
    version: 3,
    ...(skeleton.canvasWidth !== undefined ? { canvasWidth: skeleton.canvasWidth } : {}),
    canvasHeight:
      skeleton.canvasHeight ??
      Math.max(MIN_AUTO_CANVAS_HEIGHT, Math.ceil(bottom + CANVAS_MARGIN)),
    ...(skeleton.width !== undefined ? { width: skeleton.width } : {}),
    shapes,
  })
}

// ---------------------------------------------------------------------------
// Sizing

/**
 * Outer size of a box from its text slots. Inner (text area) size is
 * converted to outer size with the ratio between the type's text area and
 * bounding box at its default size.
 */
function measureBox(box: SkeletonBox, type: NodeShapeType): Size {
  const def = NODE_SHAPE_DEFINITIONS[type]
  const probe: DrawingShape = {
    id: '',
    type,
    x: 0,
    y: 0,
    width: def.defaultSize.w,
    height: def.defaultSize.h,
    stroke: '',
    fill: '',
    strokeWidth: 0,
  }
  const area = def.textArea(probe)
  const ratioW = area.w / def.defaultSize.w
  const ratioH = area.h / def.defaultSize.h
  const wrapWidth = box.w !== undefined ? Math.max(20, box.w * ratioW) : TEXT_WRAP_WIDTH

  const slots = def.textSlots.flatMap((slot) => {
    const size = slotSize(box, slot, wrapWidth)
    return size ? [size] : []
  })
  const innerW = slots.reduce((max, s) => Math.max(max, s.w), 0)
  const innerH =
    slots.reduce((sum, s) => sum + s.h, 0) + Math.max(0, slots.length - 1) * SLOT_GAP

  return {
    w: box.w ?? Math.max(def.defaultSize.w, Math.ceil(innerW / ratioW)),
    h: box.h ?? Math.max(def.defaultSize.h, Math.ceil(innerH / ratioH)),
  }
}

function slotSize(box: SkeletonBox, slot: TextField, wrapWidth: number): Size | null {
  const value = box[slot]
  if (!value) return null
  const fontSize = slot === 'text' ? FONT_SIZE : SMALL_FONT_SIZE
  return textBoxSize(wrapText(value, wrapWidth, fontSize).join('\n'), fontSize)
}

// ---------------------------------------------------------------------------
// Layout

type Edge = Readonly<{ from: string; to: string }>

/**
 * Position every box. Boxes with both `x` and `y` keep them; the rest are
 * ranked by longest path over the connector graph (cycles broken by
 * dropping DFS back-edges) and laid out rank by rank along `direction`,
 * stacked and centered on the cross axis.
 */
function layoutBoxes(
  boxes: readonly SkeletonBox[],
  sizes: ReadonlyMap<string, Size>,
  connectors: readonly SkeletonConnector[],
  direction: 'right' | 'down'
): Map<string, Point> {
  const positions = new Map<string, Point>()
  const auto = boxes.filter((box) => box.x === undefined || box.y === undefined)
  const autoIds = new Set(auto.map((box) => box.id))
  const edges = connectors
    .map((c) => ({ from: endId(c.from), to: endId(c.to) }))
    .filter((e) => e.from !== e.to && autoIds.has(e.from) && autoIds.has(e.to))
  const ranks = rankNodes(
    auto.map((box) => box.id),
    acyclicEdges(
      auto.map((box) => box.id),
      edges
    )
  )

  const rows: string[][] = []
  for (const box of auto) {
    const rank = ranks.get(box.id) ?? 0
    ;(rows[rank] ??= []).push(box.id)
  }

  const main = direction === 'right' ? 'w' : 'h'
  const cross = direction === 'right' ? 'h' : 'w'
  const rowMain = rows.map((row) => row.reduce((max, id) => Math.max(max, sizes.get(id)![main]), 0))
  const rowCross = rows.map(
    (row) =>
      row.reduce((sum, id) => sum + sizes.get(id)![cross], 0) +
      Math.max(0, row.length - 1) * STACK_GAP
  )
  const maxCross = rowCross.reduce((max, c) => Math.max(max, c), 0)

  let mainOffset = LAYOUT_ORIGIN
  rows.forEach((row, rank) => {
    let crossOffset = LAYOUT_ORIGIN + (maxCross - rowCross[rank]!) / 2
    for (const id of row) {
      const size = sizes.get(id)!
      const mainPos = Math.round(mainOffset + (rowMain[rank]! - size[main]) / 2)
      const crossPos = Math.round(crossOffset)
      positions.set(
        id,
        direction === 'right' ? { x: mainPos, y: crossPos } : { x: crossPos, y: mainPos }
      )
      crossOffset += size[cross] + STACK_GAP
    }
    mainOffset += rowMain[rank]! + RANK_GAP
  })

  for (const box of boxes) {
    const computed = positions.get(box.id) ?? { x: LAYOUT_ORIGIN, y: LAYOUT_ORIGIN }
    positions.set(box.id, { x: box.x ?? computed.x, y: box.y ?? computed.y })
  }
  return positions
}

/** Edges minus the DFS back-edges, so the remaining graph is a DAG */
function acyclicEdges(ids: readonly string[], edges: readonly Edge[]): Edge[] {
  const outgoing = new Map<string, Edge[]>()
  for (const edge of edges) (outgoing.get(edge.from) ?? outgoing.set(edge.from, []).get(edge.from)!).push(edge)
  const state = new Map<string, 'visiting' | 'done'>()
  const kept: Edge[] = []
  const visit = (id: string): void => {
    state.set(id, 'visiting')
    for (const edge of outgoing.get(id) ?? []) {
      const target = state.get(edge.to)
      if (target === 'visiting') continue
      kept.push(edge)
      if (target === undefined) visit(edge.to)
    }
    state.set(id, 'done')
  }
  for (const id of ids) if (!state.has(id)) visit(id)
  return kept
}

/** Longest path from any source, over a DAG */
function rankNodes(ids: readonly string[], edges: readonly Edge[]): Map<string, number> {
  const incoming = new Map<string, string[]>()
  for (const edge of edges) (incoming.get(edge.to) ?? incoming.set(edge.to, []).get(edge.to)!).push(edge.from)
  const ranks = new Map<string, number>()
  const rankOf = (id: string): number => {
    const known = ranks.get(id)
    if (known !== undefined) return known
    const rank = (incoming.get(id) ?? []).reduce((max, from) => Math.max(max, rankOf(from) + 1), 0)
    ranks.set(id, rank)
    return rank
  }
  for (const id of ids) rankOf(id)
  return ranks
}

// ---------------------------------------------------------------------------
// Shape expansion

function expandBox(box: SkeletonBox, type: NodeShapeType, size: Size, position: Point): DrawingShape {
  const preset = box.color ? COLOR_PRESETS[box.color] : undefined
  const fill = box.fill ?? preset?.fill ?? NODE_SHAPE_DEFINITIONS[type].defaultFill ?? 'transparent'
  return {
    id: box.id,
    type,
    x: position.x,
    y: position.y,
    width: size.w,
    height: size.h,
    stroke: box.stroke ?? preset?.stroke ?? DEFAULT_STROKE,
    fill,
    strokeWidth: STROKE_WIDTH,
    ...(box.text ? { text: box.text } : {}),
    ...(box.label ? { label: box.label } : {}),
    ...(box.footer ? { footer: box.footer } : {}),
  }
}

function expandConnector(
  connector: SkeletonConnector,
  centers: ReadonlyMap<string, Point>,
  fallbackId: string
): DrawingShape {
  const type = connector.type ?? 'arrow'
  const from = centers.get(endId(connector.from))!
  const to = centers.get(endId(connector.to))!
  return {
    id: connector.id ?? fallbackId,
    type,
    x: from.x,
    y: from.y,
    width: to.x - from.x,
    height: to.y - from.y,
    stroke: connector.stroke ?? (connector.color ? COLOR_PRESETS[connector.color].stroke : DEFAULT_STROKE),
    fill: 'transparent',
    strokeWidth: STROKE_WIDTH,
    startBinding: toBinding(connector.from),
    endBinding: toBinding(connector.to),
    ...(connector.text ? { text: connector.text } : {}),
    ...(type === 'arrow' && connector.bidirectional ? { bidirectional: true } : {}),
    ...(connector.routing === 'elbow' ? { routing: 'elbow' as const } : {}),
  }
}

function expandText(text: SkeletonText, fallbackId: string): DrawingShape {
  const size = textBoxSize(text.text)
  return {
    id: text.id ?? fallbackId,
    type: 'text',
    x: text.x,
    y: text.y,
    width: size.w,
    height: size.h,
    stroke: text.stroke ?? (text.color ? COLOR_PRESETS[text.color].stroke : DEFAULT_STROKE),
    fill: 'transparent',
    strokeWidth: STROKE_WIDTH,
    text: text.text,
  }
}

function endId(end: SkeletonEnd): string {
  return typeof end === 'string' ? end : end.id
}

function toBinding(end: SkeletonEnd): Binding {
  if (typeof end === 'string' || !end.side) return { id: endId(end) }
  return { id: end.id, fixedPoint: SIDE_FIXED_POINTS[end.side] }
}

function shapeCenter(shape: DrawingShape): Point {
  const b = bbox(shape)
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
}

// ---------------------------------------------------------------------------
// Lenient normalization of untrusted JSON

function normalizeSkeleton(raw: DrawingSkeleton): DrawingSkeleton {
  const value = raw as Record<string, unknown>
  const boxes = (value.boxes as unknown[]).flatMap((b) => {
    const box = normalizeBox(b)
    return box ? [box] : []
  })
  const connectors = Array.isArray(value.connectors)
    ? value.connectors.flatMap((c) => {
        const connector = normalizeConnector(c)
        return connector ? [connector] : []
      })
    : []
  const texts = Array.isArray(value.texts)
    ? value.texts.flatMap((t) => {
        const text = normalizeText(t)
        return text ? [text] : []
      })
    : []
  const canvasWidth = finiteNumber(value.canvasWidth)
  const canvasHeight = finiteNumber(value.canvasHeight)
  return {
    direction: value.direction === 'down' ? 'down' : 'right',
    ...(canvasWidth !== undefined ? { canvasWidth } : {}),
    ...(canvasHeight !== undefined ? { canvasHeight } : {}),
    ...(isBlockWidth(value.width) ? { width: value.width } : {}),
    boxes,
    connectors,
    texts,
  }
}

function normalizeBox(value: unknown): SkeletonBox | null {
  if (!isRecord(value) || !nonEmptyString(value.id)) return null
  if (value.type !== undefined && !(typeof value.type === 'string' && isNodeShapeType(value.type))) {
    return null
  }
  return compact<SkeletonBox>({
    id: value.id,
    type: value.type as NodeShapeType | undefined,
    label: nonEmptyString(value.label) ? value.label : undefined,
    text: nonEmptyString(value.text) ? value.text : undefined,
    footer: nonEmptyString(value.footer) ? value.footer : undefined,
    x: finiteNumber(value.x),
    y: finiteNumber(value.y),
    w: positiveNumber(value.w),
    h: positiveNumber(value.h),
    color: colorName(value.color),
    stroke: nonEmptyString(value.stroke) ? value.stroke : undefined,
    fill: nonEmptyString(value.fill) ? value.fill : undefined,
  })
}

function normalizeConnector(value: unknown): SkeletonConnector | null {
  if (!isRecord(value)) return null
  const from = normalizeEnd(value.from)
  const to = normalizeEnd(value.to)
  if (!from || !to) return null
  if (
    value.type !== undefined &&
    !(typeof value.type === 'string' && isConnectorType(value.type))
  ) {
    return null
  }
  return compact<SkeletonConnector>({
    id: nonEmptyString(value.id) ? value.id : undefined,
    type: value.type as ConnectorType | undefined,
    from,
    to,
    text: nonEmptyString(value.text) ? value.text : undefined,
    bidirectional: value.bidirectional === true ? true : undefined,
    routing: value.routing === 'elbow' ? ('elbow' as const) : undefined,
    color: colorName(value.color),
    stroke: nonEmptyString(value.stroke) ? value.stroke : undefined,
  })
}

function normalizeEnd(value: unknown): SkeletonEnd | null {
  if (nonEmptyString(value)) return value
  if (!isRecord(value) || !nonEmptyString(value.id)) return null
  const side = value.side
  return typeof side === 'string' && side in SIDE_FIXED_POINTS
    ? { id: value.id, side: side as BindingSide }
    : { id: value.id }
}

function normalizeText(value: unknown): SkeletonText | null {
  if (!isRecord(value) || !nonEmptyString(value.text)) return null
  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  if (x === undefined || y === undefined) return null
  return compact<SkeletonText>({
    id: nonEmptyString(value.id) ? value.id : undefined,
    x,
    y,
    text: value.text,
    color: colorName(value.color),
    stroke: nonEmptyString(value.stroke) ? value.stroke : undefined,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function positiveNumber(value: unknown): number | undefined {
  const n = finiteNumber(value)
  return n !== undefined && n > 0 ? n : undefined
}

function colorName(value: unknown): ColorName | undefined {
  return typeof value === 'string' && (COLOR_NAMES as readonly string[]).includes(value)
    ? (value as ColorName)
    : undefined
}

/** Drop `undefined` entries so optional fields stay absent */
function compact<T extends object>(value: { [K in keyof T]: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

// ---------------------------------------------------------------------------
// JSON Schema

const COLOR_SCHEMA = {
  enum: COLOR_NAMES,
  description:
    'Named color preset: outline plus, for boxes, a matching fill. `plain` has no outline and a light fill, `black` is a dark card with light text, `gray` is a dark outline on transparent (the default); the rest pair a colored outline with its pastel fill.',
} as const

const END_SCHEMA = {
  oneOf: [
    {
      type: 'string',
      description: 'Id of a box. The connector attaches to its outline, aimed at the other end',
    },
    {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Id of a box' },
        side: {
          enum: ['top', 'right', 'bottom', 'left'],
          description: 'Pin the endpoint to the middle of this side of the box instead of auto-aiming',
        },
      },
    },
  ],
  description: 'Box a connector end attaches to: a bare box id, or {id, side} to pick the attach edge',
} as const

export const DRAWING_SKELETON_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'DrawingSkeleton',
  description:
    'Compact intent description of a diagram. Boxes are sized from their text and laid out automatically along the connector flow; connectors are drawn between box outlines. Only say what is on the canvas — geometry is derived',
  type: 'object',
  required: ['boxes'],
  additionalProperties: false,
  properties: {
    direction: {
      enum: ['right', 'down'],
      description:
        'Auto-layout flow direction. Boxes connected a→b are placed in successive ranks along this axis ("right" = columns left to right, "down" = rows top to bottom). Default "right"',
    },
    canvasWidth: {
      type: 'number',
      minimum: 120,
      description: 'Logical canvas width in px. Omit for a fluid canvas in CSS pixels',
    },
    canvasHeight: {
      type: 'number',
      minimum: 80,
      description: 'Canvas height in px. Omit to fit the content',
    },
    width: {
      enum: ['full', 'text', 'content'],
      description:
        'Block width: "text" aligns the drawing with the text column (same as "full" unless the app sets a text measure); "content" fits the drawing to its shapes and left-aligns it with the text; omit to span the editor',
    },
    boxes: {
      type: 'array',
      items: { $ref: '#/definitions/box' },
      description: 'Card-like shapes carrying up to three text slots. Order is the render order and the stacking order within a layout rank',
    },
    connectors: {
      type: 'array',
      items: { $ref: '#/definitions/connector' },
      description: 'Arrows and lines between boxes. Connectors whose from/to id does not match a box are dropped',
    },
    texts: {
      type: 'array',
      items: { $ref: '#/definitions/text' },
      description: 'Free-floating annotations not attached to any box. Prefer box slots (label/text/footer) when the text belongs to a box',
    },
  },
  definitions: {
    box: {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Unique within the drawing; connectors reference it' },
        type: {
          enum: NODE_SHAPE_TYPES,
          description:
            'Shape: rect (default), ellipse, diamond (decision), note (sticky note, yellow by default), cylinder (database), cloud (external system), queue (message queue), actor (stick figure; only the "text" slot renders, below the figure)',
        },
        label: { type: 'string', description: 'Small bold heading at the top of the box' },
        text: {
          type: 'string',
          description: 'Main content, centered. Wraps automatically; "\\n" forces a line break',
        },
        footer: { type: 'string', description: 'Small dim line at the bottom of the box' },
        x: { type: 'number', description: 'Top-left x in px. Omit (with y) to let the layout place the box' },
        y: { type: 'number', description: 'Top-left y in px. Omit (with x) to let the layout place the box' },
        w: {
          type: 'number',
          exclusiveMinimum: 0,
          description: 'Width in px. Omit to size from the text (never smaller than the type default)',
        },
        h: {
          type: 'number',
          exclusiveMinimum: 0,
          description: 'Height in px. Omit to size from the text (never smaller than the type default)',
        },
        color: COLOR_SCHEMA,
        stroke: { type: 'string', description: 'CSS color of the outline and text; overrides the preset' },
        fill: {
          type: 'string',
          description: 'CSS color of the interior ("transparent" for none); overrides the preset',
        },
      },
    },
    connector: {
      type: 'object',
      required: ['from', 'to'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Optional; generated when omitted' },
        type: {
          enum: CONNECTOR_TYPES,
          description: 'arrow (default; arrowhead at "to") or line (no arrowheads)',
        },
        from: END_SCHEMA,
        to: END_SCHEMA,
        text: { type: 'string', description: 'Label rendered at the middle of the connector' },
        bidirectional: {
          type: 'boolean',
          description: 'Arrow only: arrowheads on both ends',
        },
        routing: {
          enum: ['straight', 'elbow'],
          description:
            'straight (default) draws a direct line; elbow draws a right-angled path routed around the boxes',
        },
        color: COLOR_SCHEMA,
        stroke: { type: 'string', description: 'CSS color of the line and label; overrides the preset' },
      },
    },
    text: {
      type: 'object',
      required: ['x', 'y', 'text'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Optional; generated when omitted' },
        x: { type: 'number', description: 'Top-left x of the first line, in px' },
        y: { type: 'number', description: 'Top-left y of the first line, in px' },
        text: { type: 'string', description: 'Content; "\\n" forces a line break' },
        color: COLOR_SCHEMA,
        stroke: { type: 'string', description: 'CSS color of the text; overrides the preset' },
      },
    },
  },
} as const
