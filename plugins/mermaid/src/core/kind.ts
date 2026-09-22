/**
 * The diagram kind contract (docs/MERMAID_PLATFORM.md section 4.1).
 *
 * One Mermaid diagram type is one `DiagramKind`: it says which keywords it
 * answers to, parses a fence body into a plain JSON model, and optionally
 * renders that model as static SVG and writes it back as canonical source.
 * `parse` never throws: the only error is a fence whose first statement is
 * not the kind's header. Everything else the kind cannot model is a problem
 * plus a retained line, so an edit re-emits what the parser read through.
 */
import type { Element } from 'hast'

export interface DiagramProblem {
  /** SCREAMING_SNAKE, prefixed with the kind name upper-cased: FLOWCHART_…, SEQUENCE_DIAGRAM_…. Unique within the kind. */
  readonly code: string
  /** 'ignored': Mermaid.js accepts the statement, this kind does not model it. 'invalid': Mermaid.js rejects the fence or throws at render. */
  readonly severity: 'ignored' | 'invalid'
  /** Names a line number and an identifier at most; never a full line of author content. */
  readonly message: string
  /** 1-based line inside the fence body. */
  readonly line?: number
  /** JSON path inside an annotation or payload, when the problem is about a value. */
  readonly path?: string
}

export interface RetainedLine {
  /** 1-based line inside the fence body. */
  readonly line: number
  /** The line, byte for byte. */
  readonly text: string
  /** Where `write` re-emits it: 'frontMatter' inside the leading --- block, 'body' after the statements. */
  readonly place: 'frontMatter' | 'body'
}

export interface DiagramParse<Model> {
  readonly model: Model
  readonly problems: readonly DiagramProblem[]
  /** Lines read through without modelling, in source order. Handed back to `write` unchanged. */
  readonly retained: readonly RetainedLine[]
  /** Features the kind's editor cannot preserve on edit, as fixed strings. Empty for kinds without `write`. */
  readonly lossy: readonly string[]
}

export interface DiagramParseError {
  readonly error: string
  readonly line?: number
}

export interface DiagramRenderOptions {
  readonly fallbackTitle: string
}

export interface DiagramWriteOptions {
  readonly retained: readonly RetainedLine[]
}

export interface DiagramKind<Model = unknown> {
  /** Mermaid keyword id: 'flowchart', 'sequenceDiagram'. Unique per registry. */
  readonly name: string
  /** Detection keywords: ['flowchart', 'graph']. */
  readonly keywords: readonly string[]
  /** Human label: 'Flowchart'. */
  readonly label: string
  /** SVG path data for the insert button, 24x24 viewBox. */
  readonly icon?: string
  /** Source inserted by the editor's insert command. Valid Mermaid. */
  readonly starter: string
  parse(source: string): DiagramParse<Model> | DiagramParseError
  /** Static SVG as hast. Absent means support level 'source'. */
  render?(model: Model, options: DiagramRenderOptions): Element
  /** Canonical source for `model`. Absent means no editor writes the model; the source editor writes text. */
  write?(model: Model, options: DiagramWriteOptions): string
}
