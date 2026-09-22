/**
 * Mermaid `flowchart` → DrawingData, tolerantly.
 *
 * The subset that becomes a drawing: the header with its direction, node
 * declarations with any of Mermaid's shape brackets, edges with labels
 * (`-->|text|` and `-- text -->`) in every arrow spelling, chains, `&`
 * groups, `style` lines for colours, and the front-matter title.
 *
 * Everything else Mermaid accepts is read through, never rejected
 * (docs/MERMAID_PLATFORM.md section 4.3). Lines the drawing cannot carry
 * (`classDef`, `class`, `click`, comments, directives, `@{ … }` configs,
 * `e1@` edge ids, `~~~` links, front-matter keys other than `title`) come
 * back as `retained` lines the writer re-emits verbatim, so an edit on the
 * canvas keeps them. A statement the parser cannot read at all is a
 * `FLOWCHART_UNKNOWN_STATEMENT` problem and a retained line. Features the
 * drawing flattens (subgraphs, edge styles, exotic brackets, `linkStyle`,
 * style properties other than colours) are named in `lossy` so the editor
 * can warn before the first edit. The only parse error is a fence whose
 * first statement is not a flowchart header.
 *
 * Geometry Mermaid cannot express lives in one `%% rmk-layout v1 {…}`
 * annotation the exporter writes (`layout-annotation.ts`, spec in
 * LAYOUT_ANNOTATION.md). With it, a drawing round-trips without loss;
 * without it, or when it is rejected, the graph is laid out like a skeleton
 * and the rejection is reported as `layoutProblem` and as a
 * `FLOWCHART_LAYOUT_INVALID` problem.
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
import { readFrontMatterTitle, splitFrontMatter } from './front-matter.js'
import { decodeText } from './text.js'
import type { DiagramProblem, RetainedLine } from './kind.js'

export interface FlowchartParse {
  readonly data: DrawingData
  /** Statements the drawing does not model, `invalid` when Mermaid.js rejects them too. */
  readonly problems: readonly DiagramProblem[]
  /** Lines read through without modelling, in source order, for the writer to re-emit. */
  readonly retained: readonly RetainedLine[]
  /** Features an edit cannot preserve, as fixed strings (section 4.3). */
  readonly lossy: readonly string[]
  /** Set when a layout annotation was present but rejected; `data` is then auto-laid out. */
  readonly layoutProblem?: LayoutProblem
}

export type MermaidParse = FlowchartParse | { readonly error: string; readonly line?: number }

/** The `lossy` vocabulary, in the order the list is reported. */
const LOSSY = ['subgraph', 'edge-style', 'shape', 'linkStyle', 'style-property'] as const
type Lossy = (typeof LOSSY)[number]

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

/** Keywords first, `flowchart-elk` before `flowchart` so the suffix is not left over; any Mermaid direction. */
const HEADER = /^(flowchart-elk|flowchart|graph)\b\s*(LR|RL|TB|BT|TD|BR|<|>|\^|v)?\s*;?\s*$/
const DOWN_DIRECTIONS: ReadonlySet<string> = new Set(['TB', 'TD', 'BT', 'v', '^'])
/** A Mermaid id: alphanumerics with single dashes between them, so the token ends before `--`, `-.`, `==`, `~~~`, `@{`, `@-` and `<-`. */
const ID = /^[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/
const TITLE_LINE = /^\s*title:\s*(.+?)\s*$/
const CLASS_SUFFIX = /^:::([A-Za-z0-9_-]+)/

/** Shape openers, longest first, with their closer, our shape type, and whether the writer emits the same bracket. */
const SHAPES: readonly [open: string, close: string, type: NodeShapeType, exact: boolean][] = [
  ['(((', ')))', 'ellipse', false],
  ['([', '])', 'ellipse', true],
  ['[[', ']]', 'queue', true],
  ['[(', ')]', 'cylinder', true],
  ['((', '))', 'ellipse', false],
  ['{{', '}}', 'diamond', false],
  ['[/', '/]', 'rect', false],
  ['[\\', '\\]', 'rect', false],
  ['[/', '\\]', 'rect', false],
  ['[\\', '/]', 'rect', false],
  ['[', ']', 'rect', true],
  ['(', ')', 'rect', false],
  ['{', '}', 'diamond', true],
  ['>', ']', 'note', true],
]

/** `@{ shape: … }` names the drawing can honour; anything else is a rectangle. */
const CONFIG_SHAPES: Readonly<Record<string, NodeShapeType>> = {
  rect: 'rect',
  rounded: 'rect',
  stadium: 'ellipse',
  circle: 'ellipse',
  'dbl-circ': 'ellipse',
  cyl: 'cylinder',
  cylinder: 'cylinder',
  database: 'cylinder',
  db: 'cylinder',
  diamond: 'diamond',
  diam: 'diamond',
  decision: 'diamond',
  question: 'diamond',
  hex: 'diamond',
  hexagon: 'diamond',
  subproc: 'queue',
  subroutine: 'queue',
  'fr-rect': 'queue',
  odd: 'note',
}

/** True when the source is a flowchart this parser can read (header check only). */
export function isMermaidFlowchart(source: string): boolean {
  const { body } = splitFrontMatter(source)
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('%%')) continue
    return HEADER.test(splitStatements(line)[0] ?? '')
  }
  return false
}

export function parseMermaidFlowchart(source: string): MermaidParse {
  return new FlowchartParser(source).parse()
}

class FlowchartParser {
  private readonly out = new ParseOutput()
  private readonly graph = new Graph()
  private direction: 'right' | 'down' = 'right'
  private annotation: LayoutAnnotation | undefined
  private layoutProblem: LayoutProblem | undefined
  private layoutLine: number | undefined
  private seenHeader = false
  private depth = 0
  private readonly title: string | undefined
  private readonly reader: LineReader

  constructor(source: string) {
    const { frontMatter, body, bodyOffset } = splitFrontMatter(source)
    this.title = readFrontMatterTitle(frontMatter)
    retainFrontMatter(frontMatter, this.out)
    this.reader = new LineReader(body, source.slice(0, bodyOffset).split(/\r?\n/).length)
  }

  parse(): MermaidParse {
    for (let logical = this.reader.next(); logical !== undefined; logical = this.reader.next()) {
      const outcome = this.readLine(logical)
      if (outcome === 'error') {
        return { error: `Not a Mermaid flowchart: expected "flowchart" or "graph", got "${logical.text.slice(0, 40)}".`, line: logical.first }
      }
    }
    if (!this.seenHeader) return { error: 'Not a Mermaid flowchart: the block is empty.' }
    if (this.layoutProblem !== undefined) {
      this.out.problem('FLOWCHART_LAYOUT_INVALID', 'invalid', this.layoutProblem.message, this.layoutLine, this.layoutProblem.path)
      return { data: build(this.graph, this.direction, this.title, undefined), ...this.out.result(), layoutProblem: this.layoutProblem }
    }
    return { data: build(this.graph, this.direction, this.title, this.annotation), ...this.out.result() }
  }

  /**
   * One logical line. `kept` means every physical line was retained as
   * written (so a trailing comment went with it); `read` means the line was
   * modelled or consumed, and a trailing comment becomes its own retained
   * line; `error` means the header is missing.
   */
  private readLine(logical: LogicalLine): 'kept' | 'read' | 'error' {
    const { text: line, first } = logical
    if (line === '') return 'read'
    if (line.startsWith('%%')) return this.readComment(logical)

    const { code, comment } = splitTrailingComment(line)
    const outcome = this.readStatements(logical, code)
    if (outcome === 'read' && comment !== undefined) this.out.retainText(first, comment)
    return outcome
  }

  private readComment(logical: LogicalLine): 'kept' | 'read' {
    const read = readLayoutAnnotation(logical.text)
    if (read.kind === 'none') {
      this.out.retain(logical)
      return 'kept'
    }
    // The annotation is the writer's own line: never retained, and only
    // one per block. Rejections keep the graph and drop the geometry.
    if (this.annotation !== undefined || this.layoutProblem !== undefined) {
      this.layoutProblem = { message: 'A block may carry one layout annotation; found more than one.' }
      this.layoutLine = logical.first
      this.annotation = undefined
    } else if (read.kind === 'invalid') {
      this.layoutProblem = read.problem
      this.layoutLine = logical.first
    } else {
      this.annotation = read.annotation
    }
    return 'read'
  }

  private readStatements(logical: LogicalLine, code: string): 'kept' | 'read' | 'error' {
    if (code === '') return 'read'
    let statements = splitStatements(code)
    if (!this.seenHeader) {
      const header = HEADER.exec(statements[0] ?? '')
      if (header === null) return 'error'
      this.seenHeader = true
      this.direction = header[2] !== undefined && DOWN_DIRECTIONS.has(header[2]) ? 'down' : 'right'
      statements = statements.slice(1)
      if (statements.length === 0) return 'read'
    }

    if (/^subgraph\b/.test(code)) {
      this.depth += 1
      this.out.lose('subgraph')
      return 'read'
    }
    if (/^end\s*;?$/.test(code)) {
      this.depth = Math.max(0, this.depth - 1)
      return 'read'
    }
    if (/^direction\b/.test(code) && this.depth > 0) return 'read'
    if (/^(classDef|class|click)\b/.test(code)) {
      this.out.retain(logical)
      return 'kept'
    }
    if (/^linkStyle\b/.test(code)) {
      this.out.lose('linkStyle')
      return 'read'
    }
    if (/^style\b/.test(code)) {
      if (applyStyle(code, this.graph.nodes)) this.out.lose('style-property')
      return 'read'
    }

    // A line is one transaction: if any statement on it cannot be read, the
    // whole line is kept as written and nothing from it enters the model.
    const snapshot = this.graph.snapshot()
    const flags = new StatementFlags()
    const readable = statements.every((statement) => parseStatement(statement, this.graph, flags))
    if (!readable) {
      this.graph.restore(snapshot)
      this.out.retain(logical)
      this.out.problem('FLOWCHART_UNKNOWN_STATEMENT', 'invalid', 'The statement could not be read and is kept as written.', logical.first)
      return 'kept'
    }
    for (const lossy of flags.lossy) this.out.lose(lossy)
    if (flags.retainLine) {
      // The nodes stay in the model; the edges live in the retained line,
      // which Mermaid reads after the node lines the writer emits.
      this.graph.edges.length = snapshot.edgeCount
      this.out.retain(logical)
      for (const message of flags.ignoredMessages()) this.out.problem('FLOWCHART_SYNTAX_IGNORED', 'ignored', message, logical.first)
      return 'kept'
    }
    for (const [id, cls] of flags.classes) this.out.retainText(logical.first, `${logical.indent}class ${id} ${cls}`)
    return 'read'
  }
}

/* -------------------------------------------------------------- collecting */

/** What one line contributes besides nodes and edges. */
class StatementFlags {
  readonly classes: [id: string, cls: string][] = []
  readonly lossy = new Set<Lossy>()
  readonly configIds: string[] = []
  readonly edgeIds: string[] = []
  invisible = false

  get retainLine(): boolean {
    return this.configIds.length > 0 || this.edgeIds.length > 0 || this.invisible
  }

  ignoredMessages(): string[] {
    return [
      ...this.configIds.map((id) => `The @{ } config on "${id}" is kept as written and not drawn.`),
      ...this.edgeIds.map((id) => `The edge id "${id}" is kept as written and not drawn.`),
      ...(this.invisible ? ['The invisible link is kept as written and not drawn.'] : []),
    ]
  }
}

class ParseOutput {
  private readonly problems: DiagramProblem[] = []
  private readonly retained: RetainedLine[] = []
  private readonly lossy = new Set<Lossy>()

  retain(logical: LogicalLine): void {
    logical.lines.forEach((text, index) => this.retained.push({ line: logical.first + index, text, place: 'body' }))
  }

  retainText(line: number, text: string): void {
    this.retained.push({ line, text, place: 'body' })
  }

  retainFrontMatter(line: number, text: string): void {
    this.retained.push({ line, text, place: 'frontMatter' })
  }

  lose(feature: Lossy): void {
    this.lossy.add(feature)
  }

  problem(code: string, severity: DiagramProblem['severity'], message: string, line: number | undefined, path?: string): void {
    this.problems.push({
      code,
      severity,
      message,
      ...(line === undefined ? {} : { line }),
      ...(path === undefined || path === '' ? {} : { path }),
    })
  }

  result(): Pick<FlowchartParse, 'problems' | 'retained' | 'lossy'> {
    return { problems: this.problems, retained: this.retained, lossy: LOSSY.filter((feature) => this.lossy.has(feature)) }
  }
}

/** Front-matter lines other than the title, at their 1-based line numbers (the opening `---` is line 1). */
function retainFrontMatter(frontMatter: string | undefined, out: ParseOutput): void {
  if (frontMatter === undefined) return
  const lines = frontMatter.split(/\r?\n/)
  const titleIndex = lines.findIndex((line) => TITLE_LINE.test(line))
  lines.forEach((text, index) => {
    if (index !== titleIndex && text.trim() !== '') out.retainFrontMatter(index + 2, text)
  })
}

/* ----------------------------------------------------------------- lines */

/** One statement line, joined from several physical lines when a `@{` config or a `%%{` directive runs on. */
interface LogicalLine {
  readonly lines: readonly string[]
  readonly first: number
  /** Trimmed and joined with single spaces. */
  readonly text: string
  /** Leading whitespace of the first physical line, for synthesized lines to sit beside it. */
  readonly indent: string
}

class LineReader {
  private readonly lines: readonly string[]
  private index = 0

  constructor(body: string, private readonly firstLine: number) {
    this.lines = body.split(/\r?\n/)
  }

  next(): LogicalLine | undefined {
    if (this.index >= this.lines.length) return undefined
    const start = this.index
    const raw = this.lines[start] as string
    this.index += 1
    const trimmed = raw.trim()
    const closer = continuationCloser(trimmed)
    if (closer !== undefined) {
      while (this.index < this.lines.length && !closer(this.lines.slice(start, this.index).map((l) => l.trim()).join(' '))) this.index += 1
    }
    const lines = this.lines.slice(start, this.index)
    return {
      lines,
      first: this.firstLine + start,
      text: lines.map((line) => line.trim()).join(' '),
      indent: /^\s*/.exec(raw)?.[0] ?? '',
    }
  }
}

/** Multi-line constructs: a directive runs to `}%%`, a `@{` config to its balancing brace. */
function continuationCloser(trimmed: string): ((joined: string) => boolean) | undefined {
  if (trimmed.startsWith('%%{')) return (joined) => joined.includes('}%%')
  const at = trimmed.indexOf('@{')
  if (at === -1 || trimmed.startsWith('%%')) return undefined
  return (joined) => bracesBalanced(joined.slice(joined.indexOf('@{') + 1))
}

function bracesBalanced(text: string): boolean {
  let depth = 0
  let quoted: string | undefined
  for (const char of text) {
    if (quoted !== undefined) {
      if (char === quoted) quoted = undefined
      continue
    }
    if (char === '"' || char === "'") quoted = char
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return true
    }
  }
  return false
}

/** A `%%` comment after a statement, outside quotes, becomes its own retained line. */
function splitTrailingComment(line: string): { code: string; comment?: string } {
  let quoted = false
  for (let index = 0; index < line.length - 1; index += 1) {
    const char = line[index]
    if (char === '"') quoted = !quoted
    if (!quoted && char === '%' && line[index + 1] === '%') {
      return { code: line.slice(0, index).trim(), comment: line.slice(index) }
    }
  }
  return { code: line }
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

/** Applies fill and stroke; returns true when the line carried a property the drawing has no field for. */
function applyStyle(line: string, nodes: Map<string, ParsedNode>): boolean {
  const match = /^style\s+([A-Za-z0-9_-]+)\s+(.+?)\s*;?$/.exec(line)
  if (match === null) return false
  const node = nodes.get(match[1] as string)
  let extra = false
  for (const declaration of (match[2] as string).split(',')) {
    const [key, value] = declaration.split(':').map((part) => part.trim())
    if (key === 'fill' && value !== undefined) {
      if (node !== undefined) node.fill = value
    } else if (key === 'stroke' && value !== undefined) {
      if (node !== undefined) node.stroke = value
    } else if (key !== undefined && key !== '') {
      extra = true
    }
  }
  return extra
}

/* --------------------------------------------------------------- graph */

class Graph {
  readonly nodes = new Map<string, ParsedNode>()
  readonly edges: ParsedEdge[] = []

  snapshot(): { nodes: Map<string, ParsedNode>; edgeCount: number } {
    return { nodes: new Map([...this.nodes].map(([id, node]) => [id, { ...node }])), edgeCount: this.edges.length }
  }

  restore(snapshot: { nodes: Map<string, ParsedNode>; edgeCount: number }): void {
    this.nodes.clear()
    for (const [id, node] of snapshot.nodes) this.nodes.set(id, node)
    this.edges.length = snapshot.edgeCount
  }
}

/* ---------------------------------------------------------------- parsing */

/**
 * One statement: a group, then any number of (edge, group) pairs. A group is
 * node refs joined by `&`; an edge between groups connects every pair.
 * Returns false when the statement cannot be read.
 */
function parseStatement(statement: string, graph: Graph, flags: StatementFlags): boolean {
  let rest = statement
  const readGroup = (): string[] | undefined => {
    const ids: string[] = []
    for (;;) {
      const node = readNode(rest, graph.nodes, flags)
      if (node === undefined) return undefined
      if (node.id !== undefined) ids.push(node.id)
      rest = node.rest.trimStart()
      if (!rest.startsWith('&')) return ids
      rest = rest.slice(1).trimStart()
    }
  }
  let previous = readGroup()
  if (previous === undefined) return false
  while (rest !== '') {
    const edge = readEdge(rest, flags)
    if (edge === undefined) return false
    rest = edge.rest.trimStart()
    const next = readGroup()
    if (next === undefined) return false
    for (const from of previous) {
      for (const to of next) {
        graph.edges.push({
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
  return true
}

/** A node reference. `id` is absent for an `@{ … }` config that names an edge or a subgraph, not a node. */
function readNode(
  input: string,
  nodes: Map<string, ParsedNode>,
  flags: StatementFlags,
): { id?: string; rest: string } | undefined {
  const id = ID.exec(input)?.[0]
  if (id === undefined) return undefined
  let rest = input.slice(id.length)
  let text: string | undefined
  let type: NodeShapeType | undefined
  let declare = true
  if (rest.startsWith('@{')) {
    const config = readConfig(rest)
    if (config === undefined) return undefined
    flags.configIds.push(id)
    rest = config.rest
    const label = configValue(config.body, 'label')
    const shape = configValue(config.body, 'shape')
    declare = label !== undefined || shape !== undefined || /\b(icon|img)\s*:/.test(config.body)
    if (label !== undefined) text = decodeText(label)
    if (shape !== undefined) type = CONFIG_SHAPES[shape] ?? 'rect'
  } else {
    // Openers are shared between bracket pairs (`[/ /]` and `[/ \]`), so
    // every pair with this opener is tried before the node is given up on.
    let opened = false
    let closed = false
    for (const [open, close, shapeType, exact] of SHAPES) {
      if (!rest.startsWith(open)) continue
      opened = true
      const body = readShapeBody(rest.slice(open.length), close)
      if (body === undefined) continue
      text = decodeText(body.text)
      type = shapeType
      rest = body.rest
      if (!exact) flags.lossy.add('shape')
      closed = true
      break
    }
    if (opened && !closed) return undefined
  }
  const classSuffix = CLASS_SUFFIX.exec(rest)
  if (classSuffix !== null) {
    flags.classes.push([id, classSuffix[1] as string])
    rest = rest.slice(classSuffix[0].length)
  }
  if (!declare) return { rest }
  const existing = nodes.get(id)
  if (existing === undefined) {
    nodes.set(id, { id, text, type: type ?? 'rect' })
  } else if (type !== undefined || text !== undefined) {
    if (text !== undefined) existing.text = text
    if (type !== undefined) existing.type = type
  }
  return { id, rest }
}

/** The `@{ … }` block after an id, up to its balancing brace. */
function readConfig(input: string): { body: string; rest: string } | undefined {
  let depth = 0
  let quoted: string | undefined
  for (let index = 1; index < input.length; index += 1) {
    const char = input[index]
    if (quoted !== undefined) {
      if (char === quoted) quoted = undefined
      continue
    }
    if (char === '"' || char === "'") quoted = char
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return { body: input.slice(2, index), rest: input.slice(index + 1) }
    }
  }
  return undefined
}

/** A `key: value` of a config block; quoted or bare up to the next comma. */
function configValue(body: string, key: string): string | undefined {
  const match = new RegExp(`(?:^|[,{\\s])${key}\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([^,}]*))`).exec(body)
  if (match === null) return undefined
  return (match[1] ?? match[2] ?? match[3] ?? '').trim()
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

/** `e1@` before a link token. */
const EDGE_ID = /^([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*)@(?=[-=.<xo~])/
/** Every link token: optional `<`, `o` or `x` start; dashes, dots, equals or tildes; optional head; optional `|label|`. */
const PLAIN_EDGE = /^([<ox])?(-{2,}[>ox]|-{3,}|-\.+-[>ox]?|={2,}[>ox]|={3,}|~{3,})(?:\s*\|([^|]*)\|)?/
/** `-- text -->`, `-. text .->`, `== text ==>` and their headless forms. */
const LABELLED_EDGE = /^([<ox])?(--|-\.|==)\s*(.+?)\s*(-{2,}[>ox]|-{2,}|\.+-[>ox]?|={2,}[>ox]|={2,})/

function readEdge(
  input: string,
  flags: StatementFlags,
): { type: ConnectorType; text?: string; bidirectional: boolean; rest: string } | undefined {
  const edgeId = EDGE_ID.exec(input)
  if (edgeId !== null) {
    flags.edgeIds.push(edgeId[1] as string)
    input = input.slice(edgeId[0].length)
  }
  const plain = PLAIN_EDGE.exec(input)
  if (plain !== null) {
    return {
      ...edgeType(plain[1], plain[2] as string, false, flags),
      ...(plain[3] === undefined ? {} : { text: decodeText(unquote(plain[3].trim())) }),
      rest: input.slice(plain[0].length),
    }
  }
  const labelled = LABELLED_EDGE.exec(input)
  if (labelled !== null) {
    return {
      ...edgeType(labelled[1], `${labelled[2]}${labelled[4]}`, true, flags),
      text: decodeText(unquote(labelled[3] as string)),
      rest: input.slice(labelled[0].length),
    }
  }
  return undefined
}

/**
 * Arrow or line, one way or both, and which styles the drawing flattens:
 * dotted, thick, invisible, circle and cross heads, and links longer than
 * the minimum (`--->`, `-..->`, `====`).
 */
function edgeType(
  start: string | undefined,
  token: string,
  labelled: boolean,
  flags: StatementFlags,
): { type: ConnectorType; bidirectional: boolean } {
  const head = /[>ox]$/.exec(token)?.[0]
  const arrow = head !== undefined
  if (token.includes('~')) {
    flags.invisible = true
    flags.lossy.add('edge-style')
    return { type: 'line', bidirectional: false }
  }
  const dotted = token.includes('.')
  const thick = token.includes('=')
  const rounded = head === 'o' || head === 'x' || start === 'o' || start === 'x'
  // A labelled link is the opening `--` plus the closer, so both halves count.
  const strokes = token.replace(/[<>ox.]/g, '').length
  const dots = token.replace(/[^.]/g, '').length
  const long = dotted ? dots > (labelled ? 2 : 1) : strokes > (labelled ? 2 : 0) + (arrow ? 2 : 3)
  if (dotted || thick || rounded || long) flags.lossy.add('edge-style')
  return { type: arrow ? 'arrow' : 'line', bidirectional: arrow && start !== undefined }
}

function unquote(value: string): string {
  return /^".*"$/.test(value) ? value.slice(1, -1) : value
}

/* --------------------------------------------------------------- building */

function build(
  graph: Graph,
  direction: 'right' | 'down',
  title: string | undefined,
  annotation: LayoutAnnotation | undefined,
): DrawingData {
  const { nodes, edges } = graph
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

  return roundGeometry(
    normalizeDrawingData({
      ...expanded,
      ...(annotation?.canvasHeight === undefined ? {} : { canvasHeight: annotation.canvasHeight }),
      ...(annotation?.canvasWidth === undefined ? {} : { canvasWidth: annotation.canvasWidth }),
      ...(annotation?.width !== undefined && isBlockWidth(annotation.width) ? { width: annotation.width } : {}),
      ...(title === undefined ? {} : { title }),
      ...(annotation?.description === undefined ? {} : { description: annotation.description }),
      shapes,
    }),
  )
}

/**
 * The annotation writes numbers with two decimals, so a model with longer
 * fractions (the automatic layout produces them) would not survive one
 * write. Rounding here makes every parse a fixed point of write and parse.
 */
function roundGeometry(data: DrawingData): DrawingData {
  return JSON.parse(
    JSON.stringify(data, (_key, value: unknown) =>
      typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 100) / 100 : value,
    ),
  ) as DrawingData
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
