/**
 * DrawingData → Mermaid `flowchart`. Ported from @zuilib/text-editor (MIT)
 * and extended so the round trip is lossless.
 *
 * The syntax carries what Mermaid can express: nodes with shape brackets and
 * text, edges with labels and direction, colours as `style` lines, and the
 * title as front matter. Everything else a drawing knows (positions, sizes,
 * stroke widths, elbow routing, waypoints, binding sides, free text, loose
 * connectors) goes into one `%% rmk-layout v1 {…}` annotation on the last
 * line (LAYOUT_ANNOTATION.md). Mermaid, GitHub and every other renderer
 * ignore the comment; `mermaid-parse.ts` reads it back.
 *
 * Lines the parser read through without modelling (`classDef`, `click`,
 * comments, directives, front-matter keys) come back in `retained` and are
 * re-emitted verbatim, each exactly once: front-matter lines inside the
 * `---` block after the title, body lines after the statements and before
 * the annotation (docs/MERMAID_PLATFORM.md section 4.3). Ids the parser
 * accepted are written unchanged; only an id that is not a valid Mermaid id
 * is rewritten, and canvas-created ids are always valid.
 *
 * Text is quoted and escaped so the parser reads back exactly what the
 * model held and Mermaid.js accepts the line: `#` becomes `#35;` before
 * any other entity is written (so text that already looks like an entity
 * survives), `&` and `%` become `#38;` and `#37;` (so `&quot;` stays text
 * and `%%{` can never open a directive inside a label), and the title is a
 * JSON-quoted YAML scalar whatever characters it holds.
 */
import {
  isNodeShapeType,
  isConnectorType,
  STROKE_COLORS,
  type NodeShapeType,
  type DrawingData,
  type DrawingShape,
} from './drawing-data.js'
import {
  edgeKeys,
  writeLayoutAnnotation,
  type LayoutAnnotation,
  type LayoutEdge,
  type LayoutNode,
  type LayoutSlot,
} from './layout-annotation.js'
import type { RetainedLine } from './kind.js'
import { isMermaidId, sanitizeMermaidId } from './mermaid-parse.js'
import { writeFrontMatterTitle } from './front-matter.js'

export type MermaidDirection = 'LR' | 'TD'

export type MermaidOptions = Readonly<{
  direction?: MermaidDirection
  /** Leave the `%% rmk-layout` annotation out, for a plain export. Default false. */
  omitLayout?: boolean
  /** Lines the parser read through, re-emitted verbatim in their places. Default none. */
  retained?: readonly RetainedLine[]
}>

const INDENT = '    '
const DEFAULT_STROKE: string = STROKE_COLORS[0]
const DEFAULT_FILL = 'transparent'

/** Export a drawing as a Mermaid `flowchart`. */
export function drawingToMermaid(data: DrawingData, options: MermaidOptions = {}): string {
  const boxes = data.shapes.filter((s) => isNodeShapeType(s.type))
  const boxIds = new Set(boxes.map((s) => s.id))
  const bound = (s: DrawingShape): boolean =>
    s.startBinding !== undefined && boxIds.has(s.startBinding.id) && s.endBinding !== undefined && boxIds.has(s.endBinding.id)
  const edges = data.shapes.filter((s) => isConnectorType(s.type) && bound(s))
  const loose = data.shapes.filter((s) => isConnectorType(s.type) && !bound(s))
  const texts = data.shapes.filter((s) => s.type === 'text')
  const mermaidIds = assignMermaidIds(boxes)
  const mermaidId = (shapeId: string): string => mermaidIds.get(shapeId) ?? shapeId
  const retained = options.retained ?? []
  const frontMatter = retained.filter((line) => line.place === 'frontMatter').map((line) => line.text)
  const body = retained.filter((line) => line.place === 'body').map((line) => line.text)

  const lines = [
    ...(data.title === undefined && frontMatter.length === 0
      ? []
      : ['---', ...(data.title === undefined ? [] : [writeFrontMatterTitle(data.title)]), ...frontMatter, '---']),
    `flowchart ${options.direction ?? autoDirection(edges)}`,
    ...boxes.map((box) => INDENT + nodeLine(box, mermaidId(box.id))),
    ...edges.map((edge) => INDENT + edgeLine(edge, mermaidId)),
    ...boxes.flatMap((box) => {
      const style = styleLine(box, mermaidId(box.id))
      return style ? [INDENT + style] : []
    }),
    ...body,
    ...(options.omitLayout === true
      ? texts.map((t) => `${INDENT}%% note: ${(t.text ?? '').replace(/\s*\n\s*/g, ' ')}`)
      : [INDENT + writeLayoutAnnotation(layoutAnnotation(data, boxes, edges, loose, texts, mermaidId))]),
  ]
  return `${lines.join('\n')}\n`
}

function layoutAnnotation(
  data: DrawingData,
  boxes: readonly DrawingShape[],
  edges: readonly DrawingShape[],
  loose: readonly DrawingShape[],
  texts: readonly DrawingShape[],
  mermaidId: (shapeId: string) => string,
): LayoutAnnotation {
  // Member order here is the canonical order on the wire.
  const nodes: Record<string, LayoutNode> = {}
  for (const box of boxes) {
    const slots = (['label', 'text', 'footer'] as const).filter((slot): slot is LayoutSlot => box[slot] !== undefined)
    nodes[mermaidId(box.id)] = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      strokeWidth: box.strokeWidth,
      // Plain `text` is the default; only a card with more slots needs the list.
      ...(slots.length === 1 && slots[0] === 'text' ? {} : { slots }),
      ...(NODE_SYNTAX_LOSSY.has(box.type as NodeShapeType) ? { type: box.type as 'cloud' | 'actor' } : {}),
    }
  }
  const remap = (shape: DrawingShape): DrawingShape => ({
    ...shape,
    ...(shape.startBinding === undefined ? {} : { startBinding: { ...shape.startBinding, id: mermaidId(shape.startBinding.id) } }),
    ...(shape.endBinding === undefined ? {} : { endBinding: { ...shape.endBinding, id: mermaidId(shape.endBinding.id) } }),
  })
  const keys = edgeKeys(edges.map((edge) => ({ from: mermaidId(edge.startBinding?.id ?? ''), to: mermaidId(edge.endBinding?.id ?? '') })))
  const layoutEdges: Record<string, LayoutEdge> = {}
  edges.forEach((edge, index) => {
    const anchor = (binding: DrawingShape['startBinding']): LayoutEdge['start'] => {
      if (binding === undefined) return undefined
      const { id: _id, ...rest } = binding
      return Object.keys(rest).length === 0 ? undefined : rest
    }
    const start = anchor(edge.startBinding)
    const end = anchor(edge.endBinding)
    layoutEdges[keys[index] as string] = {
      id: edge.id,
      x: edge.x,
      y: edge.y,
      width: edge.width,
      height: edge.height,
      stroke: edge.stroke,
      fill: edge.fill,
      strokeWidth: edge.strokeWidth,
      ...(edge.routing === undefined ? {} : { routing: edge.routing }),
      ...(edge.elbow === undefined ? {} : { elbow: edge.elbow }),
      ...(edge.waypoints === undefined ? {} : { waypoints: edge.waypoints }),
      ...(start === undefined ? {} : { start }),
      ...(end === undefined ? {} : { end }),
    }
  })
  return {
    canvasHeight: data.canvasHeight,
    ...(data.canvasWidth === undefined ? {} : { canvasWidth: data.canvasWidth }),
    ...(data.width === undefined ? {} : { width: data.width }),
    ...(data.description === undefined ? {} : { description: data.description }),
    nodes,
    edges: layoutEdges,
    ...(texts.length === 0 ? {} : { texts }),
    ...(loose.length === 0 ? {} : { loose: loose.map(remap) }),
  }
}

/** Majority of bound connectors running horizontally → LR, otherwise TD */
function autoDirection(edges: readonly DrawingShape[]): MermaidDirection {
  if (edges.length === 0) return 'LR'
  const horizontal = edges.filter((e) => Math.abs(e.width) >= Math.abs(e.height)).length
  return horizontal * 2 >= edges.length ? 'LR' : 'TD'
}

/**
 * Valid ids are written as they are and claimed first, so a rewritten id
 * never displaces one the parser accepted. Invalid ids are sanitised and
 * suffixed `_2`, `_3` until unique.
 */
function assignMermaidIds(boxes: readonly DrawingShape[]): Map<string, string> {
  const ids = new Map<string, string>()
  const used = new Set<string>()
  for (const box of boxes) {
    if (!isMermaidId(box.id) || used.has(box.id)) continue
    used.add(box.id)
    ids.set(box.id, box.id)
  }
  for (const box of boxes) {
    if (ids.has(box.id) && ids.get(box.id) === box.id) continue
    const base = sanitizeMermaidId(box.id)
    let candidate = base
    for (let n = 2; used.has(candidate); n += 1) candidate = `${base}_${n}`
    used.add(candidate)
    ids.set(box.id, candidate)
  }
  return ids
}

/** Bracket per shape. Types with no Mermaid bracket are recorded in the annotation. */
const NODE_SYNTAX: Record<NodeShapeType, readonly [string, string]> = {
  rect: ['[', ']'],
  ellipse: ['([', '])'],
  diamond: ['{', '}'],
  note: ['>', ']'],
  cylinder: ['[(', ')]'],
  cloud: ['((', '))'],
  queue: ['[[', ']]'],
  actor: ['((', '))'],
}
const NODE_SYNTAX_LOSSY: ReadonlySet<NodeShapeType> = new Set<NodeShapeType>(['cloud', 'actor'])

function nodeLine(box: DrawingShape, id: string): string {
  const [open, close] = NODE_SYNTAX[box.type as NodeShapeType]
  const parts = [box.label, box.text, box.footer].filter((part): part is string => part !== undefined)
  const text = parts.length ? parts.map(escapeText).join('<br/>') : box.id
  return `${id}${open}"${text}"${close}`
}

function edgeLine(edge: DrawingShape, mermaidId: (shapeId: string) => string): string {
  const from = mermaidId(edge.startBinding?.id ?? '')
  const to = mermaidId(edge.endBinding?.id ?? '')
  const connector = edge.type === 'line' ? '---' : edge.bidirectional ? '<-->' : '-->'
  const label = edge.text ? `|${pipeLabel(edge.text)}|` : ''
  return `${from} ${connector}${label} ${to}`
}

/** Brackets, braces and parentheses Mermaid takes only inside quotes; the escaped text never holds a quote or a pipe. */
const PIPE_LABEL_NEEDS_QUOTES = /[()[\]{}]/

function pipeLabel(text: string): string {
  const escaped = escapeText(text).replace(/\|/g, '#124;')
  return PIPE_LABEL_NEEDS_QUOTES.test(escaped) ? `"${escaped}"` : escaped
}

function styleLine(box: DrawingShape, id: string): string | null {
  const props: string[] = []
  if (box.fill !== DEFAULT_FILL) props.push(`fill:${box.fill}`)
  if (box.stroke !== DEFAULT_STROKE) props.push(`stroke:${box.stroke}`)
  if (props.length === 0) return null
  // Keep the explicit transparent fill alongside a custom stroke so the
  // node isn't repainted by Mermaid's theme
  if (box.fill === DEFAULT_FILL) props.unshift(`fill:${DEFAULT_FILL}`)
  return `style ${id} ${props.join(',')}`
}

/** Escape user text for a quoted Mermaid string; `#` goes first so no other entity is re-escaped; newlines become `<br/>` */
function escapeText(text: string): string {
  return text
    .replace(/#/g, '#35;')
    .replace(/&/g, '#38;')
    .replace(/%/g, '#37;')
    .replace(/"/g, '#quot;')
    .replace(/</g, '#lt;')
    .replace(/>/g, '#gt;')
    .replace(/\r?\n/g, '<br/>')
}
