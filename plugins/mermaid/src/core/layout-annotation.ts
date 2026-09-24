/**
 * The RMK layout annotation: one Mermaid comment line that carries the
 * geometry a ```mermaid flowchart cannot express.
 *
 *     %% rmk-layout v1 {"canvasHeight":260,"nodes":{…},"edges":{…}}
 *
 * This module is the reference implementation of LAYOUT_ANNOTATION.md: the
 * line grammar, the payload types, the validator and the canonical writer.
 * `mermaid.ts` builds an annotation from a drawing; `mermaid-parse.ts`
 * applies one to a parsed flowchart. Neither touches the wire format.
 *
 * Reading is fail-closed: a line that carries the marker but is not a valid
 * annotation is rejected as a whole, with the path of the first problem, and
 * the flowchart falls back to the automatic layout. Members the reader does
 * not know are ignored, so a later minor revision can add fields without a
 * version bump.
 */
import { isNodeShapeType, isStrokeStyle, type Binding, type DrawingShape, type NodeShapeType, type Point, type StrokeStyle } from './drawing-data.js'
import { isBlockWidth, type BlockWidth } from './block-width.js'

/** The word after `%%` that identifies the annotation. */
export const LAYOUT_ANNOTATION_MARKER = 'rmk-layout'
/** The major version this module reads and writes. */
export const LAYOUT_ANNOTATION_VERSION = 1

/** Which text slots of a card the node's `<br/>`-joined text fills. */
export type LayoutSlot = 'label' | 'text' | 'footer'
export const LAYOUT_SLOTS: readonly LayoutSlot[] = ['label', 'text', 'footer']

/** Shapes Mermaid has no bracket for; the annotation records them. */
export type LayoutNodeType = Extract<NodeShapeType, 'cloud' | 'actor'>
export const LAYOUT_NODE_TYPES: readonly LayoutNodeType[] = ['cloud', 'actor']

/** Geometry of one node, keyed by its Mermaid id. Colours come from `style` lines. */
export interface LayoutNode {
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
  readonly strokeWidth?: number
  readonly slots?: readonly LayoutSlot[]
  readonly type?: LayoutNodeType
}

/** A binding without its box id: the syntax already names both endpoints. */
export type LayoutAnchor = Omit<Binding, 'id'>

/** Geometry of one edge, keyed by `from->to` (see `edgeKeys`). */
export interface LayoutEdge {
  readonly id?: string
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
  readonly stroke?: string
  readonly fill?: string
  readonly strokeWidth?: number
  /** Which pattern a dotted link token (`-.->`) draws; a solid token ignores it */
  readonly strokeStyle?: StrokeStyle
  readonly routing?: 'elbow'
  readonly elbow?: number
  readonly waypoints?: readonly Point[]
  readonly start?: LayoutAnchor
  readonly end?: LayoutAnchor
}

/** The payload of a version 1 annotation. Every member is optional. */
export interface LayoutAnnotation {
  readonly canvasHeight?: number
  readonly canvasWidth?: number
  readonly width?: BlockWidth
  readonly description?: string
  readonly nodes?: Readonly<Record<string, LayoutNode>>
  readonly edges?: Readonly<Record<string, LayoutEdge>>
  /** Free text shapes, which Mermaid has no syntax for. */
  readonly texts?: readonly DrawingShape[]
  /** Connectors not bound at both ends, which Mermaid cannot express. */
  readonly loose?: readonly DrawingShape[]
}

/** Why an annotation line was rejected. `path` is dotted, e.g. `nodes.web.x`. */
export interface LayoutProblem {
  readonly message: string
  readonly path?: string
}

export type LayoutRead =
  | { readonly kind: 'none' }
  | { readonly kind: 'annotation'; readonly annotation: LayoutAnnotation }
  | { readonly kind: 'invalid'; readonly problem: LayoutProblem }

const MARKER_LINE = new RegExp(`^%%\\s+${LAYOUT_ANNOTATION_MARKER}(?![A-Za-z0-9_-])`)
const ANNOTATION_LINE = new RegExp(`^%%\\s+${LAYOUT_ANNOTATION_MARKER}\\s+v(\\d+)\\s+(\\{.*\\})\\s*$`)

/**
 * Read one line of a fence body. `none` when the line is not an annotation
 * (an ordinary comment or statement); `invalid` when it carries the marker
 * but breaks the grammar, has an unsupported version or fails validation.
 */
export function readLayoutAnnotation(line: string): LayoutRead {
  const trimmed = line.trim()
  if (!MARKER_LINE.test(trimmed)) return { kind: 'none' }
  const match = ANNOTATION_LINE.exec(trimmed)
  if (match === null) {
    return invalid(`Expected "%% ${LAYOUT_ANNOTATION_MARKER} v<major> {…}" with the JSON object on the same line.`)
  }
  const version = Number(match[1])
  if (version !== LAYOUT_ANNOTATION_VERSION) {
    return invalid(`Unsupported layout annotation version; this reader supports version ${LAYOUT_ANNOTATION_VERSION}.`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(match[2] as string)
  } catch {
    return invalid('The layout annotation is not valid JSON.')
  }
  const checked = validateAnnotation(parsed)
  return 'problem' in checked ? { kind: 'invalid', problem: checked.problem } : { kind: 'annotation', annotation: checked.value }
}

/**
 * The canonical line for an annotation (without indentation): marker,
 * version, then the payload as compact JSON with numbers rounded to two
 * decimals. Member order is the order the payload object was built in.
 */
export function writeLayoutAnnotation(annotation: LayoutAnnotation): string {
  return `%% ${LAYOUT_ANNOTATION_MARKER} v${LAYOUT_ANNOTATION_VERSION} ${JSON.stringify(annotation, rounded)}`
}

/**
 * The `edges` key of every edge, in statement order: `from->to` for the
 * first edge between two nodes, `from->to#2` for the second, and so on.
 */
export function edgeKeys(edges: readonly { readonly from: string; readonly to: string }[]): string[] {
  const seen = new Map<string, number>()
  return edges.map(({ from, to }) => {
    const base = `${from}->${to}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}#${n}`
  })
}

/* ------------------------------------------------------------ validation */

type Checked<T> = { readonly value: T } | { readonly problem: LayoutProblem }

function invalid(message: string, path?: string): { kind: 'invalid'; problem: LayoutProblem } {
  return { kind: 'invalid', problem: path === undefined ? { message } : { message, path } }
}

function fail<T>(message: string, path: string): Checked<T> {
  return { problem: { message, path } }
}

function validateAnnotation(value: unknown): Checked<LayoutAnnotation> {
  if (!isRecord(value)) return fail('Expected a JSON object.', '')
  const out: Mutable<LayoutAnnotation> = {}
  const problem =
    optionalNumber(value, 'canvasHeight', '', (n) => (out.canvasHeight = n)) ??
    optionalNumber(value, 'canvasWidth', '', (n) => (out.canvasWidth = n)) ??
    optionalEnum(value, 'width', '', isBlockWidth, 'one of "full", "text", "content"', (w) => (out.width = w)) ??
    optionalString(value, 'description', '', (s) => (out.description = s)) ??
    optionalMap(value, 'nodes', validateNode, (nodes) => (out.nodes = nodes)) ??
    optionalMap(value, 'edges', validateEdge, (edges) => (out.edges = edges)) ??
    optionalShapes(value, 'texts', (type) => type === 'text', 'a "text" shape', (texts) => (out.texts = texts)) ??
    optionalShapes(value, 'loose', (type) => type === 'arrow' || type === 'line', 'an "arrow" or "line" shape', (loose) => (out.loose = loose))
  return problem === undefined ? { value: out } : { problem }
}

function validateNode(value: unknown, path: string): Checked<LayoutNode> {
  if (!isRecord(value)) return fail('Expected an object.', path)
  const out: Mutable<LayoutNode> = {}
  const problem =
    optionalNumber(value, 'x', path, (n) => (out.x = n)) ??
    optionalNumber(value, 'y', path, (n) => (out.y = n)) ??
    optionalNumber(value, 'width', path, (n) => (out.width = n)) ??
    optionalNumber(value, 'height', path, (n) => (out.height = n)) ??
    optionalNumber(value, 'strokeWidth', path, (n) => (out.strokeWidth = n)) ??
    optionalSlots(value, path, (slots) => (out.slots = slots)) ??
    optionalEnum(value, 'type', path, isLayoutNodeType, 'one of "cloud", "actor"', (t) => (out.type = t))
  return problem === undefined ? { value: out } : { problem }
}

function validateEdge(value: unknown, path: string): Checked<LayoutEdge> {
  if (!isRecord(value)) return fail('Expected an object.', path)
  const out: Mutable<LayoutEdge> = {}
  const problem =
    optionalString(value, 'id', path, (s) => (out.id = s)) ??
    optionalNumber(value, 'x', path, (n) => (out.x = n)) ??
    optionalNumber(value, 'y', path, (n) => (out.y = n)) ??
    optionalNumber(value, 'width', path, (n) => (out.width = n)) ??
    optionalNumber(value, 'height', path, (n) => (out.height = n)) ??
    optionalString(value, 'stroke', path, (s) => (out.stroke = s)) ??
    optionalString(value, 'fill', path, (s) => (out.fill = s)) ??
    optionalNumber(value, 'strokeWidth', path, (n) => (out.strokeWidth = n)) ??
    optionalEnum(value, 'strokeStyle', path, isStrokeStyle, 'one of "dashed", "dotted"', (st) => (out.strokeStyle = st)) ??
    optionalEnum(value, 'routing', path, (r): r is 'elbow' => r === 'elbow', '"elbow"', (r) => (out.routing = r)) ??
    optionalNumber(value, 'elbow', path, (n) => (out.elbow = n)) ??
    optionalPoints(value, path, (points) => (out.waypoints = points)) ??
    optionalAnchor(value, 'start', path, (a) => (out.start = a)) ??
    optionalAnchor(value, 'end', path, (a) => (out.end = a))
  return problem === undefined ? { value: out } : { problem }
}

function validateAnchor(value: unknown, path: string): Checked<LayoutAnchor> {
  if (!isRecord(value)) return fail('Expected an object.', path)
  const out: Mutable<LayoutAnchor> = {}
  if (value['fixedPoint'] !== undefined) {
    const fp = value['fixedPoint']
    if (!Array.isArray(fp) || fp.length !== 2 || !fp.every(isFiniteNumber)) {
      return fail('Expected an array of two numbers.', join(path, 'fixedPoint'))
    }
    out.fixedPoint = [fp[0] as number, fp[1] as number]
  }
  const mode = value['mode']
  if (mode !== undefined) {
    if (mode !== 'orbit' && mode !== 'inside') return fail('Expected one of "orbit", "inside".', join(path, 'mode'))
    out.mode = mode
  }
  return { value: out }
}

/** Members the drawing normaliser needs; everything else it clamps or drops itself. */
function validateShape(value: unknown, path: string, accepts: (type: string) => boolean, expected: string): Checked<DrawingShape> {
  if (!isRecord(value)) return fail('Expected an object.', path)
  if (typeof value['id'] !== 'string' || value['id'] === '') return fail('Expected a non-empty string.', join(path, 'id'))
  if (typeof value['type'] !== 'string' || !accepts(value['type'])) return fail(`Expected ${expected}.`, join(path, 'type'))
  for (const member of ['x', 'y', 'width', 'height'] as const) {
    if (!isFiniteNumber(value[member])) return fail('Expected a finite number.', join(path, member))
  }
  return { value: value as unknown as DrawingShape }
}

/* --------------------------------------------------------------- helpers */

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

function optionalNumber(record: Record<string, unknown>, member: string, path: string, set: (n: number) => void): LayoutProblem | undefined {
  const value = record[member]
  if (value === undefined) return undefined
  if (!isFiniteNumber(value)) return { message: 'Expected a finite number.', path: join(path, member) }
  set(value)
  return undefined
}

function optionalString(record: Record<string, unknown>, member: string, path: string, set: (s: string) => void): LayoutProblem | undefined {
  const value = record[member]
  if (value === undefined) return undefined
  if (typeof value !== 'string') return { message: 'Expected a string.', path: join(path, member) }
  set(value)
  return undefined
}

function optionalEnum<T>(
  record: Record<string, unknown>,
  member: string,
  path: string,
  is: (value: unknown) => value is T,
  expected: string,
  set: (value: T) => void,
): LayoutProblem | undefined {
  const value = record[member]
  if (value === undefined) return undefined
  if (!is(value)) return { message: `Expected ${expected}.`, path: join(path, member) }
  set(value)
  return undefined
}

function optionalSlots(record: Record<string, unknown>, path: string, set: (slots: LayoutSlot[]) => void): LayoutProblem | undefined {
  const value = record['slots']
  if (value === undefined) return undefined
  const at = join(path, 'slots')
  if (!Array.isArray(value)) return { message: 'Expected an array.', path: at }
  const slots: LayoutSlot[] = []
  for (const [index, slot] of value.entries()) {
    if (!isLayoutSlot(slot)) return { message: 'Expected one of "label", "text", "footer".', path: join(at, String(index)) }
    if (slots.includes(slot)) return { message: 'Each slot may appear once.', path: join(at, String(index)) }
    slots.push(slot)
  }
  set(slots)
  return undefined
}

function optionalPoints(record: Record<string, unknown>, path: string, set: (points: Point[]) => void): LayoutProblem | undefined {
  const value = record['waypoints']
  if (value === undefined) return undefined
  const at = join(path, 'waypoints')
  if (!Array.isArray(value)) return { message: 'Expected an array.', path: at }
  const points: Point[] = []
  for (const [index, point] of value.entries()) {
    if (!isRecord(point) || !isFiniteNumber(point['x']) || !isFiniteNumber(point['y'])) {
      return { message: 'Expected an object with numeric "x" and "y".', path: join(at, String(index)) }
    }
    points.push({ x: point['x'], y: point['y'] })
  }
  set(points)
  return undefined
}

function optionalAnchor(record: Record<string, unknown>, member: string, path: string, set: (a: LayoutAnchor) => void): LayoutProblem | undefined {
  const value = record[member]
  if (value === undefined) return undefined
  const checked = validateAnchor(value, join(path, member))
  if ('problem' in checked) return checked.problem
  set(checked.value)
  return undefined
}

function optionalMap<T>(
  record: Record<string, unknown>,
  member: string,
  validate: (value: unknown, path: string) => Checked<T>,
  set: (map: Record<string, T>) => void,
): LayoutProblem | undefined {
  const value = record[member]
  if (value === undefined) return undefined
  if (!isRecord(value) || Array.isArray(value)) return { message: 'Expected an object keyed by id.', path: member }
  const map: Record<string, T> = {}
  for (const [key, entry] of Object.entries(value)) {
    const checked = validate(entry, join(member, key))
    if ('problem' in checked) return checked.problem
    map[key] = checked.value
  }
  set(map)
  return undefined
}

function optionalShapes(
  record: Record<string, unknown>,
  member: string,
  accepts: (type: string) => boolean,
  expected: string,
  set: (shapes: DrawingShape[]) => void,
): LayoutProblem | undefined {
  const value = record[member]
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return { message: 'Expected an array.', path: member }
  const shapes: DrawingShape[] = []
  for (const [index, entry] of value.entries()) {
    const checked = validateShape(entry, join(member, String(index)), accepts, expected)
    if ('problem' in checked) return checked.problem
    shapes.push(checked.value)
  }
  set(shapes)
  return undefined
}

function isLayoutSlot(value: unknown): value is LayoutSlot {
  return typeof value === 'string' && (LAYOUT_SLOTS as readonly string[]).includes(value)
}

function isLayoutNodeType(value: unknown): value is LayoutNodeType {
  return typeof value === 'string' && isNodeShapeType(value) && (LAYOUT_NODE_TYPES as readonly string[]).includes(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function join(path: string, member: string): string {
  return path === '' ? member : `${path}.${member}`
}

/** Geometry to two decimals: a readable line, and no drift a reader could see. */
function rounded(_key: string, value: unknown): unknown {
  return typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 100) / 100 : value
}
