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
 * style properties other than colours, markdown strings) are named in
 * `lossy` so the editor can warn before the first edit. The only parse
 * error is a fence whose first statement is not a flowchart header.
 *
 * Problems are `invalid` only where Mermaid.js itself rejects the fence
 * (checked against Mermaid 11): a statement it cannot read, an unquoted
 * label holding brackets, braces, parentheses, quotes or pipes, an empty
 * label, a keyword such as `end` used as a node id, a `%%` comment after a
 * statement, and an `end` without a subgraph. Where Mermaid accepts the
 * text but the drawing does not use it, the problem is `ignored`.
 *
 * Geometry Mermaid cannot express lives in one `%% rmk-layout v1 {…}`
 * annotation the exporter writes (`layout-annotation.ts`, spec in
 * LAYOUT_ANNOTATION.md). With it, a drawing round-trips without loss;
 * without it, or when it is rejected, the graph is laid out like a skeleton
 * and the rejection is reported as `layoutProblem` and as a
 * `FLOWCHART_LAYOUT_INVALID` problem. The annotation line is read wherever
 * it appears, even after a statement or inside an unreadable run of lines,
 * and is never retained: the writer emits exactly one.
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
  type LayoutRead,
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

export const FLOWCHART_PROBLEM_CODES = {
  unknownStatement: 'FLOWCHART_UNKNOWN_STATEMENT',
  syntaxIgnored: 'FLOWCHART_SYNTAX_IGNORED',
  layoutInvalid: 'FLOWCHART_LAYOUT_INVALID',
  labelNeedsQuotes: 'FLOWCHART_LABEL_NEEDS_QUOTES',
  labelEmpty: 'FLOWCHART_LABEL_EMPTY',
  reservedId: 'FLOWCHART_RESERVED_ID',
  trailingComment: 'FLOWCHART_TRAILING_COMMENT',
} as const

/** The `lossy` vocabulary, in the order the list is reported. */
const LOSSY = ['subgraph', 'edge-style', 'shape', 'linkStyle', 'style-property', 'markdown-string'] as const
type Lossy = (typeof LOSSY)[number]

interface Problem {
  readonly code: string
  readonly message: string
}

const UNKNOWN_STATEMENT: Problem = {
  code: FLOWCHART_PROBLEM_CODES.unknownStatement,
  message: 'The statement could not be read and is kept as written.',
}

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
/** The keyword followed by something that is not a direction: the slip the error names. */
const HEADER_MISTYPED = /^(flowchart-elk|flowchart|graph)\b\s+(\S+)\s*;?\s*$/
const DOWN_DIRECTIONS: ReadonlySet<string> = new Set(['TB', 'TD', 'BT', 'v', '^'])
/** The `direction` statement takes the spelled-out directions, case-sensitive; `direction` alone is a node id. */
const DIRECTION_STATEMENT = /^direction\s+(TB|TD|BT|LR|RL)\b/
const DIRECTION_ATTEMPT = /^direction\s+\w+\s*;?$/
const TITLE_LINE = /^\s*title:\s*(.+?)\s*$/
const CLASS_SUFFIX = /^:::([A-Za-z0-9_-]+)/

/**
 * Ids Mermaid's lexer reads as keywords wherever they appear, so a node can
 * never carry them (`A --> end` is a parse error; `End` and `END` are fine).
 * `direction` and `default` are keywords only at the start of a statement
 * and are accepted as ids, so they are not here.
 */
export const RESERVED_IDS: ReadonlySet<string> = new Set(['end', 'subgraph', 'graph', 'flowchart', 'style', 'classDef', 'class', 'click', 'linkStyle'])

/**
 * A Mermaid id: Unicode letters, digits and `_`, with a single `-`, `.` or
 * `:` between them (`my-box`, `api.gateway`, `svc:4`, `Пользователь`), so
 * the token ends before `--`, `-.`, `==`, `~~~`, `@{`, `@-`, `<-` and `:::`.
 */
const ID_CHAR = '[\\p{L}\\p{N}_]'
const ID = new RegExp(`^${ID_CHAR}+(?:[-.:]${ID_CHAR}+)*`, 'u')
const WHOLE_ID = new RegExp(`^${ID_CHAR}+(?:[-.:]${ID_CHAR}+)*$`, 'u')

/** True when the writer can emit `id` unchanged: the parser reads it back as the same id. */
export function isMermaidId(id: string): boolean {
  return WHOLE_ID.test(id) && !RESERVED_IDS.has(id)
}

/** The closest valid id: other characters become `_`, an empty result is `n_`, a keyword gets a trailing `_`. */
export function sanitizeMermaidId(id: string): string {
  const cleaned = id.replace(/[^\p{L}\p{N}_]/gu, '_')
  if (cleaned === '') return 'n_'
  return RESERVED_IDS.has(cleaned) ? `${cleaned}_` : cleaned
}

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

/** `kept`: every physical line was retained; `read`: modelled or consumed; an error means the header is missing. */
type Outcome = 'kept' | 'read' | { readonly error: string }

/** A `style` line, applied once every node is known (Mermaid applies them in any order). */
interface StyleLine {
  readonly ids: readonly string[]
  readonly fill?: string
  readonly stroke?: string
  /** A property the drawing has no field for. */
  readonly extra: boolean
  readonly logical: LogicalLine
}

class FlowchartParser {
  private readonly out = new ParseOutput()
  private readonly graph = new Graph()
  private readonly styles: StyleLine[] = []
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
      if (typeof outcome !== 'string') return { error: outcome.error, line: logical.first }
    }
    if (!this.seenHeader) return { error: 'Not a Mermaid flowchart: the block is empty.' }
    this.applyStyles()
    if (this.layoutProblem !== undefined) {
      this.out.problem(FLOWCHART_PROBLEM_CODES.layoutInvalid, 'invalid', this.layoutProblem.message, this.layoutLine, this.layoutProblem.path)
      return { data: build(this.graph, this.direction, this.title, undefined), ...this.out.result(), layoutProblem: this.layoutProblem }
    }
    return { data: build(this.graph, this.direction, this.title, this.annotation), ...this.out.result() }
  }

  /**
   * One logical line. A `%%` comment after a statement is a Mermaid parse
   * error, so it is reported; the statement is still read and the comment
   * becomes its own retained line (or, for an annotation, the layout), so
   * the written source is valid.
   */
  private readLine(logical: LogicalLine): Outcome {
    const { text: line, first } = logical
    if (line === '') return 'read'
    if (line.startsWith('%%')) return this.readComment(logical)

    const { code, comment } = splitTrailingComment(line)
    if (comment === undefined) return this.readStatements(logical, code)
    const last = first + logical.lines.length - 1
    this.out.problem(FLOWCHART_PROBLEM_CODES.trailingComment, 'invalid', 'Mermaid reads a %% comment only on a line of its own; this one is kept on its own line.', last)
    const outcome = this.readStatements(withoutTrailingComment(logical, comment), code)
    this.readCommentText(comment, last)
    return outcome
  }

  private readComment(logical: LogicalLine): Outcome {
    const read = readLayoutAnnotation(logical.text)
    if (read.kind === 'none') {
      this.retain(logical)
      return 'kept'
    }
    this.readAnnotation(read, logical.first)
    return 'read'
  }

  private readCommentText(comment: string, line: number): void {
    const read = readLayoutAnnotation(comment)
    if (read.kind === 'none') this.out.retainText(line, comment)
    else this.readAnnotation(read, line)
  }

  /** The annotation is the writer's own line: never retained, and only one per block. Rejections keep the graph and drop the geometry. */
  private readAnnotation(read: Exclude<LayoutRead, { kind: 'none' }>, line: number): void {
    if (this.annotation !== undefined || this.layoutProblem !== undefined) {
      this.layoutProblem = { message: 'A block may carry one layout annotation; found more than one.' }
      this.layoutLine = line
      this.annotation = undefined
    } else if (read.kind === 'invalid') {
      this.layoutProblem = read.problem
      this.layoutLine = line
    } else {
      this.annotation = read.annotation
    }
  }

  /** Retains every physical line except an annotation, which is read instead: the writer emits its own. */
  private retain(logical: LogicalLine): void {
    logical.lines.forEach((text, index) => {
      const line = logical.first + index
      const read = readLayoutAnnotation(text)
      if (read.kind === 'none') this.out.retainText(line, text)
      else this.readAnnotation(read, line)
    })
  }

  private unknown(logical: LogicalLine, problem: Problem = UNKNOWN_STATEMENT): 'kept' {
    this.retain(logical)
    this.out.problem(problem.code, 'invalid', problem.message, logical.first)
    return 'kept'
  }

  private readStatements(logical: LogicalLine, code: string): Outcome {
    if (code === '') return 'read'
    let statements = splitStatements(code)
    if (!this.seenHeader) {
      const header = HEADER.exec(statements[0] ?? '')
      if (header === null) return { error: headerError(statements[0] ?? '', logical.text) }
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
      // Mermaid rejects an `end` that closes nothing.
      if (this.depth === 0) return this.unknown(logical)
      this.depth -= 1
      return 'read'
    }
    if (DIRECTION_ATTEMPT.test(code)) return this.readDirection(logical, code)
    if (/^(classDef|class|click)\b/.test(code)) {
      this.retain(logical)
      return 'kept'
    }
    if (/^linkStyle\b/.test(code)) {
      this.out.lose('linkStyle')
      return 'read'
    }
    if (/^style\b/.test(code)) {
      const style = readStyle(code)
      if (style === undefined) return this.unknown(logical)
      this.styles.push({ ...style, logical })
      return 'read'
    }

    // A line is one transaction: if any statement on it cannot be read, the
    // whole line is kept as written and nothing from it enters the model.
    const snapshot = this.graph.snapshot()
    const flags = new StatementFlags()
    const readable = statements.every((statement) => parseStatement(statement, this.graph, flags))
    if (!readable) {
      this.graph.restore(snapshot)
      return this.unknown(logical, flags.failure ?? UNKNOWN_STATEMENT)
    }
    for (const lossy of flags.lossy) this.out.lose(lossy)
    // Labels Mermaid rejects stay in the model: the writer quotes them.
    for (const problem of flags.labelProblems) this.out.problem(problem.code, 'invalid', problem.message, logical.first)
    if (flags.retainLine) {
      // The nodes stay in the model; the edges live in the retained line,
      // which Mermaid reads after the node lines the writer emits.
      this.graph.edges.length = snapshot.edgeCount
      this.retain(logical)
      for (const message of flags.ignoredMessages()) this.out.problem(FLOWCHART_PROBLEM_CODES.syntaxIgnored, 'ignored', message, logical.first)
      return 'kept'
    }
    for (const [id, cls] of flags.classes) this.out.retainText(logical.first, `${logical.indent}class ${id} ${cls}`)
    return 'read'
  }

  /**
   * Inside a subgraph the direction is the subgraph's (flattened, nothing
   * to keep). At top level Mermaid accepts it anywhere: before the first
   * node it is the diagram's direction; after one it is kept as written.
   */
  private readDirection(logical: LogicalLine, code: string): Outcome {
    if (this.depth > 0) return 'read'
    const match = DIRECTION_STATEMENT.exec(code)
    if (match === null) return this.unknown(logical)
    if (this.graph.nodes.size === 0 && this.graph.edges.length === 0) {
      this.direction = DOWN_DIRECTIONS.has(match[1] as string) ? 'down' : 'right'
      return 'read'
    }
    this.retain(logical)
    this.out.problem(FLOWCHART_PROBLEM_CODES.syntaxIgnored, 'ignored', 'The direction statement after the first node is kept as written and not applied.', logical.first)
    return 'kept'
  }

  /** Colours go onto the nodes that exist; a line naming a node that never appears is kept as written. */
  private applyStyles(): void {
    for (const style of this.styles) {
      const missing = style.ids.filter((id) => !this.graph.nodes.has(id))
      for (const id of style.ids) {
        const node = this.graph.nodes.get(id)
        if (node === undefined) continue
        if (style.fill !== undefined) node.fill = style.fill
        if (style.stroke !== undefined) node.stroke = style.stroke
      }
      if (missing.length > 0) {
        this.retain(style.logical)
        this.out.problem(FLOWCHART_PROBLEM_CODES.syntaxIgnored, 'ignored', `The style line for "${missing[0]}" names no node in the diagram and is kept as written.`, style.logical.first)
      } else if (style.extra) {
        this.out.lose('style-property')
      }
    }
  }
}

/** The keyword was right but the direction was not: name the direction, since the keyword error would mislead. */
function headerError(statement: string, line: string): string {
  const mistyped = HEADER_MISTYPED.exec(statement)
  if (mistyped !== null) {
    return `Unknown direction "${mistyped[2]}" after "${mistyped[1]}"; Mermaid directions are TB, TD, BT, LR, RL (case-sensitive).`
  }
  return `Not a Mermaid flowchart: expected "flowchart" or "graph", got "${line.slice(0, 40)}".`
}

/* -------------------------------------------------------------- collecting */

/** What one line contributes besides nodes and edges. */
class StatementFlags {
  readonly classes: [id: string, cls: string][] = []
  readonly lossy = new Set<Lossy>()
  readonly configIds: string[] = []
  readonly edgeIds: string[] = []
  /** Labels Mermaid rejects as written; the node or edge is modelled and the writer quotes them. */
  readonly labelProblems: Problem[] = []
  /** Why the statement could not be read, when a reason more specific than "unknown" is known. */
  failure: Problem | undefined
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

  /** Retained lines in source order: a `style` line retained at the end of the parse sorts back to its place. */
  result(): Pick<FlowchartParse, 'problems' | 'retained' | 'lossy'> {
    const retained = [...this.retained].sort((a, b) => a.line - b.line)
    return { problems: this.problems, retained, lossy: LOSSY.filter((feature) => this.lossy.has(feature)) }
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

/**
 * One statement line, joined from several physical lines when a `%%{`
 * directive, a `@{` config or a quoted label runs on. Lines joined for a
 * quoted label keep their breaks as `\n`, so a label spanning lines reads
 * as a label with line breaks.
 */
interface LogicalLine {
  readonly lines: readonly string[]
  readonly first: number
  /** Trimmed and joined. */
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
    const continuation = continuationOf(raw.trim())
    const separator = continuation?.separator ?? ' '
    const joined = (): string => this.lines.slice(start, this.index).map((l) => l.trim()).join(separator)
    if (continuation !== undefined) {
      while (this.index < this.lines.length && !continuation.closes(joined())) {
        // A comment or blank line never sits inside a config or a label,
        // so an unclosed one stops here instead of swallowing the rest of
        // the fence (and the writer's annotation with it).
        const next = (this.lines[this.index] as string).trim()
        if (continuation.bounded && (next === '' || next.startsWith('%%'))) break
        this.index += 1
      }
    }
    const lines = this.lines.slice(start, this.index)
    return {
      lines,
      first: this.firstLine + start,
      text: lines.map((line) => line.trim()).join(separator),
      indent: /^\s*/.exec(raw)?.[0] ?? '',
    }
  }
}

interface Continuation {
  readonly closes: (joined: string) => boolean
  readonly separator: string
  /** Stops at a blank or `%%` line. Directives are not bounded: `}%%` is their own closer. */
  readonly bounded: boolean
}

/** Multi-line constructs: a directive runs to `}%%`, a `@{` config to its balancing brace, a quoted label to its closing quote. */
function continuationOf(trimmed: string): Continuation | undefined {
  if (trimmed.startsWith('%%{')) return { closes: (joined) => joined.includes('}%%'), separator: ' ', bounded: false }
  if (trimmed.startsWith('%%')) return undefined
  if (trimmed.includes('@{')) {
    return { closes: (joined) => bracesBalanced(joined.slice(joined.indexOf('@{') + 1)), separator: ' ', bounded: true }
  }
  if (quoteCount(trimmed) % 2 === 1) return { closes: (joined) => quoteCount(joined) % 2 === 0, separator: '\n', bounded: true }
  return undefined
}

function quoteCount(text: string): number {
  return text.replace(/[^"]/g, '').length
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

/** A `%%` comment after a statement, outside quotes. */
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

/** The same logical line with the trailing comment cut off its last physical line, so retaining it keeps only the code. */
function withoutTrailingComment(logical: LogicalLine, comment: string): LogicalLine {
  const lines = [...logical.lines]
  const last = lines[lines.length - 1] as string
  const at = last.lastIndexOf(comment)
  lines[lines.length - 1] = at === -1 ? last : last.slice(0, at).trimEnd()
  return { ...logical, lines, text: splitTrailingComment(logical.text).code }
}

const ENTITY = /^#\w+;/

/**
 * `;` separates statements, except inside quotes, inside a `|label|` and
 * as the end of a `#NN;` entity, which is how Mermaid reads `|a;b|` and
 * `A[a#59;b]` and how the writer's own `#124;` pipe escape comes back.
 */
function splitStatements(line: string): string[] {
  const out: string[] = []
  let current = ''
  let quoted = false
  let piped = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] as string
    if (char === '#' && !quoted) {
      const entity = ENTITY.exec(line.slice(index))
      if (entity !== null) {
        current += entity[0]
        index += entity[0].length - 1
        continue
      }
    }
    if (char === '"') quoted = !quoted
    else if (char === '|' && !quoted) piped = !piped
    if (char === ';' && !quoted && !piped) {
      out.push(current)
      current = ''
      continue
    }
    current += char
  }
  out.push(current)
  return out.map((s) => s.trim()).filter((s) => s !== '')
}

/** `style id[,id…] prop:value[,prop:value…]`, as Mermaid reads it; undefined when it is not one. */
function readStyle(line: string): Omit<StyleLine, 'logical'> | undefined {
  const match = /^style\s+(\S+)\s+(.+?)\s*;?$/.exec(line)
  if (match === null) return undefined
  const ids = (match[1] as string).split(',')
  if (!ids.every((id) => WHOLE_ID.test(id))) return undefined
  let fill: string | undefined
  let stroke: string | undefined
  let extra = false
  for (const declaration of (match[2] as string).split(',')) {
    const [key, value] = declaration.split(':').map((part) => part.trim())
    if (key === 'fill' && value !== undefined) fill = value
    else if (key === 'stroke' && value !== undefined) stroke = value
    else if (key !== undefined && key !== '') extra = true
  }
  return { ids, ...(fill === undefined ? {} : { fill }), ...(stroke === undefined ? {} : { stroke }), extra }
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
    if (edge.label !== undefined) flags.labelProblems.push(edgeLabelProblem(edge.label, previous[0] ?? ''))
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
  if (RESERVED_IDS.has(id)) {
    flags.failure = { code: FLOWCHART_PROBLEM_CODES.reservedId, message: `"${id}" is a Mermaid keyword and cannot name a node; the line is kept as written.` }
    return undefined
  }
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
      const issue = labelIssue(body.raw, body.quoted, SHAPE_LABEL_REJECTS)
      if (issue !== undefined) flags.labelProblems.push(nodeLabelProblem(issue, id))
      text = labelText(body.raw, body.quoted, flags)
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

/** The text between a shape's brackets: `raw` is what stood between the quotes, or between the brackets untrimmed. */
function readShapeBody(input: string, close: string): { raw: string; quoted: boolean; rest: string } | undefined {
  if (input.startsWith('"')) {
    const end = input.indexOf('"', 1)
    if (end === -1) return undefined
    const after = input.slice(end + 1)
    if (!after.startsWith(close)) return undefined
    return { raw: input.slice(1, end), quoted: true, rest: after.slice(close.length) }
  }
  const end = input.indexOf(close)
  if (end === -1) return undefined
  return { raw: input.slice(0, end), quoted: false, rest: input.slice(end + close.length) }
}

/* ---------------------------------------------------------------- labels */

type LabelIssue = 'empty' | 'needs-quotes'

/** Characters Mermaid's lexer refuses in an unquoted bracket label. */
const SHAPE_LABEL_REJECTS = /[()[\]{}"|]/
/** The same for an unquoted `|label|`; the pipe itself ends the label. */
const PIPE_LABEL_REJECTS = /[()[\]{}"]/
/** In `-- text -->` Mermaid takes brackets and parentheses; only a quote breaks it. */
const DASH_LABEL_REJECTS = /"/

/** Mermaid rejects an empty label (`A[]`, `A[""]`, `|` `|`) and an unquoted one holding delimiters; `A[ ]` is fine. */
function labelIssue(raw: string, quoted: boolean, rejects: RegExp): LabelIssue | undefined {
  if (raw === '') return 'empty'
  if (!quoted && rejects.test(raw)) return 'needs-quotes'
  return undefined
}

function nodeLabelProblem(issue: LabelIssue, id: string): Problem {
  return issue === 'empty'
    ? { code: FLOWCHART_PROBLEM_CODES.labelEmpty, message: `The label of "${id}" is empty; Mermaid needs text or a space between the brackets.` }
    : { code: FLOWCHART_PROBLEM_CODES.labelNeedsQuotes, message: `Mermaid rejects the label of "${id}" as written; wrap it in quotes.` }
}

function edgeLabelProblem(issue: LabelIssue, from: string): Problem {
  return issue === 'empty'
    ? { code: FLOWCHART_PROBLEM_CODES.labelEmpty, message: `The label on the link from "${from}" is empty; Mermaid needs text or a space between the pipes.` }
    : { code: FLOWCHART_PROBLEM_CODES.labelNeedsQuotes, message: `Mermaid rejects the label on the link from "${from}" as written; wrap it in quotes.` }
}

/**
 * Label text as the drawing shows it. A quoted label is taken as written
 * (line breaks from a label spanning lines included); an unquoted one is
 * trimmed as Mermaid trims it. A markdown string (`` "`…`" ``) loses its
 * backticks and its `**bold**`, `*italic*` and `_italic_` markers, which
 * the drawing cannot show, so it is named in `lossy`.
 */
function labelText(raw: string, quoted: boolean, flags: StatementFlags): string {
  if (!quoted) return decodeText(raw.trim())
  if (raw.length >= 2 && raw.startsWith('`') && raw.endsWith('`')) {
    flags.lossy.add('markdown-string')
    return decodeText(stripMarkdown(raw.slice(1, -1)))
  }
  return decodeText(raw)
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^\p{L}\p{N}_])_([^_\n]+)_(?![\p{L}\p{N}_])/gu, '$1$2')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
}

/** A label between pipes or dashes: quoted text may hold `|` and `--`; the caller has matched the quotes. */
function edgeLabel(raw: string, rejects: RegExp, flags: StatementFlags): { text: string; issue?: LabelIssue } {
  const trimmed = raw.trim()
  const quoted = /^"[^"]*"$/s.test(trimmed)
  const issue = labelIssue(raw, quoted, rejects)
  const text = quoted ? labelText(trimmed.slice(1, -1), true, flags) : decodeText(trimmed)
  return issue === undefined ? { text } : { text, issue }
}

/* ----------------------------------------------------------------- edges */

/** `e1@` before a link token. */
const EDGE_ID = /^([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*)@(?=[-=.<xo~])/
/** Every link token: optional `<`, `o` or `x` start; dashes, dots, equals or tildes; optional head; optional `|label|`, whose quoted text may hold a pipe. */
const PLAIN_EDGE = /^([<ox])?(-{2,}[>ox]|-{3,}|-\.+-[>ox]?|={2,}[>ox]|={3,}|~{3,})(?:\s*\|("[^"]*"|[^|]*)\|)?/
/** `-- text -->`, `-. text .->`, `== text ==>` and their headless forms; quoted text may hold the closer. */
const LABELLED_EDGE = /^([<ox])?(--|-\.|==)\s*("[^"]*"|.+?)\s*(-{2,}[>ox]|-{2,}|\.+-[>ox]?|={2,}[>ox]|={2,})/

function readEdge(
  input: string,
  flags: StatementFlags,
): { type: ConnectorType; text?: string; bidirectional: boolean; rest: string; label?: LabelIssue } | undefined {
  const edgeId = EDGE_ID.exec(input)
  if (edgeId !== null) {
    flags.edgeIds.push(edgeId[1] as string)
    input = input.slice(edgeId[0].length)
  }
  const plain = PLAIN_EDGE.exec(input)
  if (plain !== null) {
    const label = plain[3] === undefined ? undefined : edgeLabel(plain[3], PIPE_LABEL_REJECTS, flags)
    return {
      ...edgeType(plain[1], plain[2] as string, false, flags),
      ...(label === undefined ? {} : { text: label.text }),
      ...(label?.issue === undefined ? {} : { label: label.issue }),
      rest: input.slice(plain[0].length),
    }
  }
  const labelled = LABELLED_EDGE.exec(input)
  if (labelled !== null) {
    const label = edgeLabel(labelled[3] as string, DASH_LABEL_REJECTS, flags)
    return {
      ...edgeType(labelled[1], `${labelled[2]}${labelled[4]}`, true, flags),
      text: label.text,
      ...(label.issue === undefined ? {} : { label: label.issue }),
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
