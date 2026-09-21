/**
 * Mermaid `flowchart` → DrawingData.
 *
 * The subset that matters for a drawing: the header with its direction, node
 * declarations with any of Mermaid's shape brackets, edges with labels
 * (`-->|text|` and `-- text -->`), bidirectional edges, chains, `&` groups,
 * `subgraph … end` (read through, grouping ignored), `style` lines for
 * colours, and comments. Front matter carries the title.
 *
 * Geometry Mermaid cannot express lives in one `%% rmk-layout v1 {…}`
 * annotation the exporter writes (`layout-annotation.ts`, spec in
 * LAYOUT_ANNOTATION.md). With it, a drawing round-trips without loss;
 * without it, or when it is rejected, the graph is laid out like a skeleton
 * and the rejection is reported as `layoutProblem`. Everything else Mermaid
 * supports (classDef, click, linkStyle, other diagram types) is ignored or
 * rejected with a reason, never thrown.
 */
import {
  isConnectorType,
  isNodeShapeType,
  normalizeDrawingData,
  type ConnectorType,
  type DrawingData,
  type DrawingShape,
  type NodeShapeType,
} from './drawing-data.js'
import { expandDrawingSkeleton, type SkeletonBox, type SkeletonConnector } from './skeleton.js'
import { isBlockWidth } from './block-width.js'
import {
  edgeKeys,
  readLayoutAnnotation,
  type LayoutAnnotation,
  type LayoutProblem,
  type LayoutSlot,
} from './layout-annotation.js'

export type MermaidParse =
  | {
      readonly data: DrawingData
      /** Set when a layout annotation was present but rejected; `data` is then auto-laid out. */
      readonly layoutProblem?: LayoutProblem
    }
  | { readonly error: string }

interface ParsedNode {
  id: string
  text: string | undefined
  type: NodeShapeType
  stroke?: string
  fill?: string
}

interface ParsedEdge {
  from: string
  to: string
  type: ConnectorType
  text?: string
  bidirectional?: boolean
}

const HEADER = /^(flowchart|graph)\b\s*(TB|TD|BT|LR|RL)?\s*;?\s*$/
const ID = /^[A-Za-z0-9_\-]+/

/** Shape openers, longest first, with their closer and our shape type. */
const SHAPES: readonly [open: string, close: string, type: NodeShapeType][] = [
  ['(((', ')))', 'ellipse'],
  ['([', '])', 'ellipse'],
  ['[[', ']]', 'queue'],
  ['[(', ')]', 'cylinder'],
  ['((', '))', 'ellipse'],
  ['{{', '}}', 'diamond'],
  ['[/', '/]', 'rect'],
  ['[\\', '\\]', 'rect'],
  ['[/', '\\]', 'rect'],
  ['[\\', '/]', 'rect'],
  ['[', ']', 'rect'],
  ['(', ')', 'rect'],
  ['{', '}', 'diamond'],
  ['>', ']', 'note'],
]

/** True when the source is a flowchart this parser can read (header check only). */
export function isMermaidFlowchart(source: string): boolean {
  const { body } = splitFrontMatter(source)
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('%%')) continue
    return HEADER.test(line)
  }
  return false
}

export function parseMermaidFlowchart(source: string): MermaidParse {
  const { title, body } = splitFrontMatter(source)
  const nodes = new Map<string, ParsedNode>()
  const edges: ParsedEdge[] = []
  let direction: 'right' | 'down' = 'right'
  let annotation: LayoutAnnotation | undefined
  let layoutProblem: LayoutProblem | undefined
  let seenHeader = false
  let depth = 0

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '') continue
    if (line.startsWith('%%')) {
      const read = readLayoutAnnotation(line)
      if (read.kind === 'none') continue
      if (annotation !== undefined || layoutProblem !== undefined) {
        layoutProblem = { message: 'A block may carry one layout annotation; found more than one.' }
      } else if (read.kind === 'invalid') {
        layoutProblem = read.problem
      } else {
        annotation = read.annotation
      }
      continue
    }
    let statements = splitStatements(line)
    if (!seenHeader) {
      const header = HEADER.exec(statements[0] ?? '')
      if (header === null) return { error: `Not a Mermaid flowchart: expected "flowchart" or "graph", got "${line.slice(0, 40)}".` }
      seenHeader = true
      direction = header[2] === 'TB' || header[2] === 'TD' || header[2] === 'BT' ? 'down' : 'right'
      statements = statements.slice(1)
      if (statements.length === 0) continue
    }
    if (/^subgraph\b/.test(line)) {
      depth += 1
      continue
    }
    if (line === 'end') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (/^direction\b/.test(line) && depth > 0) continue
    if (/^(classDef|class|click|linkStyle)\b/.test(line)) continue
    if (/^style\b/.test(line)) {
      applyStyle(line, nodes)
      continue
    }
    for (const statement of statements) {
      const problem = parseStatement(statement, nodes, edges)
      if (problem !== undefined) return { error: problem }
    }
  }
  if (!seenHeader) return { error: 'Not a Mermaid flowchart: the block is empty.' }
  if (layoutProblem !== undefined) return { data: build(nodes, edges, direction, title, undefined), layoutProblem }
  return { data: build(nodes, edges, direction, title, annotation) }
}

/* ---------------------------------------------------------------- parsing */

function splitFrontMatter(source: string): { title: string | undefined; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (match === null) return { title: undefined, body: source }
  const title = /^\s*title:\s*(.+?)\s*$/m.exec(match[1] ?? '')?.[1]
  return { title: title === undefined ? undefined : unquote(title), body: source.slice(match[0].length) }
}

/** `;` separates statements, except inside quotes. */
function splitStatements(line: string): string[] {
  const out: string[] = []
  let current = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') quoted = !quoted
    if (char === ';' && !quoted) {
      out.push(current)
      current = ''
      continue
    }
    current += char
  }
  out.push(current)
  return out.map((s) => s.trim()).filter((s) => s !== '')
}

function applyStyle(line: string, nodes: Map<string, ParsedNode>): void {
  const match = /^style\s+([A-Za-z0-9_\-]+)\s+(.+)$/.exec(line)
  if (match === null) return
  const node = nodes.get(match[1] as string)
  if (node === undefined) return
  for (const declaration of (match[2] as string).split(',')) {
    const [key, value] = declaration.split(':').map((part) => part.trim())
    if (key === 'fill' && value !== undefined) node.fill = value
    if (key === 'stroke' && value !== undefined) node.stroke = value
  }
}

/**
 * One statement: a group, then any number of (edge, group) pairs. A group is
 * node refs joined by `&`; an edge between groups connects every pair.
 */
function parseStatement(statement: string, nodes: Map<string, ParsedNode>, edges: ParsedEdge[]): string | undefined {
  let rest = statement
  const readGroup = (): string[] | string => {
    const ids: string[] = []
    for (;;) {
      const node = readNode(rest, nodes)
      if (typeof node === 'string') return node
      ids.push(node.id)
      rest = node.rest.trimStart()
      if (!rest.startsWith('&')) return ids
      rest = rest.slice(1).trimStart()
    }
  }
  let previous = readGroup()
  if (typeof previous === 'string') return previous
  while (rest !== '') {
    const edge = readEdge(rest)
    if (edge === undefined) return `Cannot read "${rest.slice(0, 40)}" in "${statement.slice(0, 60)}".`
    rest = edge.rest.trimStart()
    const next = readGroup()
    if (typeof next === 'string') return next
    for (const from of previous) {
      for (const to of next) {
        edges.push({
          from,
          to,
          type: edge.type,
          ...(edge.text === undefined ? {} : { text: edge.text }),
          ...(edge.bidirectional ? { bidirectional: true } : {}),
        })
      }
    }
    previous = next
  }
  return undefined
}

function readNode(input: string, nodes: Map<string, ParsedNode>): { id: string; rest: string } | string {
  const id = ID.exec(input)?.[0]
  if (id === undefined) return `Expected a node id at "${input.slice(0, 40)}".`
  let rest = input.slice(id.length)
  let text: string | undefined
  let type: NodeShapeType | undefined
  for (const [open, close, shapeType] of SHAPES) {
    if (!rest.startsWith(open)) continue
    const body = readShapeBody(rest.slice(open.length), close)
    if (body === undefined) return `Unclosed "${open}" after "${id}".`
    text = decodeText(body.text)
    type = shapeType
    rest = body.rest
    break
  }
  const classSuffix = /^:::[A-Za-z0-9_\-]+/.exec(rest)
  if (classSuffix !== null) rest = rest.slice(classSuffix[0].length)
  const existing = nodes.get(id)
  if (existing === undefined) {
    nodes.set(id, { id, text, type: type ?? 'rect' })
  } else if (type !== undefined) {
    existing.text = text
    existing.type = type
  }
  return { id, rest }
}

function readShapeBody(input: string, close: string): { text: string; rest: string } | undefined {
  if (input.startsWith('"')) {
    const end = input.indexOf('"', 1)
    if (end === -1) return undefined
    const after = input.slice(end + 1)
    if (!after.startsWith(close)) return undefined
    return { text: input.slice(1, end), rest: after.slice(close.length) }
  }
  const end = input.indexOf(close)
  if (end === -1) return undefined
  return { text: input.slice(0, end).trim(), rest: input.slice(end + close.length) }
}

const PLAIN_EDGE = /^(<)?(-{2,}[>ox]|-{3,}|-\.+->|-\.+-|={2,}>|={2,})(?:\|([^|]*)\|)?/
const LABELLED_EDGE = /^(<)?(--|-\.|==)\s+(.+?)\s+(-{2,}[>ox]|-{2,}|\.->|\.-|={2,}>|={2,})/

function readEdge(
  input: string,
): { type: ConnectorType; text?: string; bidirectional: boolean; rest: string } | undefined {
  const plain = PLAIN_EDGE.exec(input)
  if (plain !== null) {
    return {
      ...edgeType(plain[2] as string, plain[1] === '<'),
      ...(plain[3] === undefined ? {} : { text: decodeText(plain[3].trim()) }),
      rest: input.slice(plain[0].length),
    }
  }
  const labelled = LABELLED_EDGE.exec(input)
  if (labelled !== null) {
    return {
      ...edgeType(labelled[4] as string, labelled[1] === '<'),
      text: decodeText(labelled[3] as string),
      rest: input.slice(labelled[0].length),
    }
  }
  return undefined
}

function edgeType(token: string, backward: boolean): { type: ConnectorType; bidirectional: boolean } {
  const arrow = /[>ox]$/.test(token)
  return { type: arrow ? 'arrow' : 'line', bidirectional: arrow && backward }
}

function decodeText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/#quot;|&quot;/g, '"')
    .replace(/#lt;|&lt;/g, '<')
    .replace(/#gt;|&gt;/g, '>')
    .replace(/#124;/g, '|')
    .replace(/#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

function unquote(value: string): string {
  return /^".*"$/.test(value) ? value.slice(1, -1) : value
}

/* --------------------------------------------------------------- building */

function build(
  nodes: Map<string, ParsedNode>,
  edges: readonly ParsedEdge[],
  direction: 'right' | 'down',
  title: string | undefined,
  annotation: LayoutAnnotation | undefined,
): DrawingData {
  const layoutNodes = annotation?.nodes ?? {}
  const boxes: SkeletonBox[] = [...nodes.values()].map((node) => {
    const layout = layoutNodes[node.id]
    return {
      id: node.id,
      type: layout?.type ?? node.type,
      ...splitSlots(node.text ?? node.id, layout?.slots),
      ...(layout?.x === undefined ? {} : { x: layout.x }),
      ...(layout?.y === undefined ? {} : { y: layout.y }),
      ...(layout?.width === undefined ? {} : { w: layout.width }),
      ...(layout?.height === undefined ? {} : { h: layout.height }),
      ...(node.stroke === undefined ? {} : { stroke: node.stroke }),
      ...(node.fill === undefined ? {} : { fill: node.fill }),
    }
  })
  const layoutEdges = annotation?.edges ?? {}
  const keys = edgeKeys(edges)
  const connectors: SkeletonConnector[] = edges.map((edge, index) => {
    const layout = layoutEdges[keys[index] as string]
    return {
      ...(layout?.id === undefined ? {} : { id: layout.id }),
      type: edge.type,
      from: edge.from,
      to: edge.to,
      ...(edge.text === undefined ? {} : { text: edge.text }),
      ...(edge.bidirectional ? { bidirectional: true } : {}),
      ...(layout?.routing === 'elbow' ? { routing: 'elbow' as const } : {}),
      ...(layout?.stroke === undefined ? {} : { stroke: layout.stroke }),
    }
  })

  const expanded = expandDrawingSkeleton({ direction, boxes, connectors })

  // Re-apply what the skeleton could not carry: stroke widths, connector
  // geometry and anchors, then the shapes Mermaid has no syntax for.
  let edgeIndex = 0
  const shapes: DrawingShape[] = expanded.shapes.map((shape) => {
    if (isNodeShapeType(shape.type)) {
      const layout = layoutNodes[shape.id]
      return layout?.strokeWidth === undefined ? shape : { ...shape, strokeWidth: layout.strokeWidth }
    }
    if (!isConnectorType(shape.type)) return shape
    const layout = layoutEdges[keys[edgeIndex] as string]
    edgeIndex += 1
    if (layout === undefined) return shape
    return {
      ...shape,
      ...(layout.x === undefined ? {} : { x: layout.x }),
      ...(layout.y === undefined ? {} : { y: layout.y }),
      ...(layout.width === undefined ? {} : { width: layout.width }),
      ...(layout.height === undefined ? {} : { height: layout.height }),
      ...(layout.fill === undefined ? {} : { fill: layout.fill }),
      ...(layout.strokeWidth === undefined ? {} : { strokeWidth: layout.strokeWidth }),
      ...(layout.elbow === undefined ? {} : { elbow: layout.elbow }),
      ...(layout.waypoints === undefined ? {} : { waypoints: layout.waypoints }),
      ...(layout.start === undefined || shape.startBinding === undefined ? {} : { startBinding: { id: shape.startBinding.id, ...layout.start } }),
      ...(layout.end === undefined || shape.endBinding === undefined ? {} : { endBinding: { id: shape.endBinding.id, ...layout.end } }),
    }
  })
  for (const loose of annotation?.loose ?? []) shapes.push(loose)
  for (const text of annotation?.texts ?? []) shapes.push(text)

  return normalizeDrawingData({
    ...expanded,
    ...(annotation?.canvasHeight === undefined ? {} : { canvasHeight: annotation.canvasHeight }),
    ...(annotation?.canvasWidth === undefined ? {} : { canvasWidth: annotation.canvasWidth }),
    ...(annotation?.width !== undefined && isBlockWidth(annotation.width) ? { width: annotation.width } : {}),
    ...(title === undefined ? {} : { title }),
    ...(annotation?.description === undefined ? {} : { description: annotation.description }),
    shapes,
  })
}

/**
 * The exporter joins label, text and footer with line breaks so other
 * renderers show all three; `slots` says which were present, so the lines
 * can be handed back to the right ones. No `slots`: everything is `text`.
 * An empty `slots`: the node has no text and the syntax shows its id.
 */
function splitSlots(text: string, slots: readonly LayoutSlot[] | undefined): { text?: string; label?: string; footer?: string } {
  if (slots === undefined) return { text }
  if (slots.length === 0) return {}
  const lines = text.split('\n')
  const label = slots.includes('label') ? lines.shift() : undefined
  const footer = slots.includes('footer') ? lines.pop() : undefined
  return {
    ...(label === undefined ? {} : { label }),
    ...(footer === undefined ? {} : { footer }),
    ...(lines.length === 0 ? {} : { text: lines.join('\n') }),
  }
}
