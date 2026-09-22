/**
 * Diagnostic codes and their messages (docs/MERMAID_PLATFORM.md section 5),
 * in one place so the codes stay stable and the wording stays consistent.
 * Messages name a kind, a line number or a keyword at most, never author
 * content: the `error` string of a parse error goes into the node, not here.
 */
import { diagnostic, type DiagnosticSeverity, type MarkdownDiagnostic, type SourceRange } from '@internal/diagnostics/index.js'

export const DIAGRAM_DIAGNOSTIC_CODES = {
  /** A registered kind returned a parse error. The fence is shown as source. */
  invalid: 'DIAGRAM_INVALID',
  /** The fence does not start with a Mermaid keyword. */
  kindUnknown: 'DIAGRAM_KIND_UNKNOWN',
  /** A Mermaid keyword no registered kind renders. The fence is shown as source. */
  kindUnsupported: 'DIAGRAM_KIND_UNSUPPORTED',
  /** The `%% rmk-layout` annotation was rejected and the diagram auto-laid out. */
  layoutInvalid: 'DIAGRAM_LAYOUT_INVALID',
  /** A statement Mermaid.js itself would reject. */
  syntaxInvalid: 'DIAGRAM_SYNTAX_INVALID',
  /** A statement Mermaid.js accepts that the kind does not model. */
  syntaxIgnored: 'DIAGRAM_SYNTAX_IGNORED',
} as const

export type DiagramDiagnosticCode = (typeof DIAGRAM_DIAGNOSTIC_CODES)[keyof typeof DIAGRAM_DIAGNOSTIC_CODES]

/** What a message may name. Each code reads the members it needs. */
export interface DiagramDiagnosticDetail {
  /** The kind's label ('Flowchart') for DIAGRAM_INVALID, its name ('classDiagram') for DIAGRAM_KIND_UNSUPPORTED. */
  readonly kind?: string
  /** 1-based line inside the fence body. */
  readonly line?: number
  /** The expected keyword spelling, for DIAGRAM_KIND_UNKNOWN. */
  readonly hint?: string
  /** A problem's message, or the layout validator's. */
  readonly message?: string
  /** The layout validator's path, for DIAGRAM_LAYOUT_INVALID only. */
  readonly path?: string
}

const SEVERITY: Readonly<Record<DiagramDiagnosticCode, DiagnosticSeverity>> = {
  DIAGRAM_INVALID: 'warning',
  DIAGRAM_KIND_UNKNOWN: 'warning',
  DIAGRAM_KIND_UNSUPPORTED: 'info',
  DIAGRAM_LAYOUT_INVALID: 'warning',
  DIAGRAM_SYNTAX_INVALID: 'warning',
  DIAGRAM_SYNTAX_IGNORED: 'info',
}

const MESSAGE: Readonly<Record<DiagramDiagnosticCode, (detail: DiagramDiagnosticDetail) => string>> = {
  DIAGRAM_INVALID: ({ kind, line }) =>
    `The ${kind ?? 'mermaid'} block could not be read and is shown as source${atLine(line)}.`,
  DIAGRAM_KIND_UNKNOWN: ({ hint }) =>
    hint === undefined
      ? 'The mermaid block does not start with a Mermaid diagram keyword.'
      : `The mermaid block does not start with a Mermaid diagram keyword. Mermaid keywords are case-sensitive; expected \`${hint}\`.`,
  DIAGRAM_KIND_UNSUPPORTED: ({ kind }) => `${kind ?? 'These'} diagrams are shown as source.`,
  DIAGRAM_LAYOUT_INVALID: ({ message }) =>
    `The layout annotation was ignored and the diagram auto-laid out${message === undefined ? '' : `: ${message}`}`,
  DIAGRAM_SYNTAX_INVALID: ({ line, message }) => lineMessage(line, message),
  DIAGRAM_SYNTAX_IGNORED: ({ line, message }) => lineMessage(line, message),
}

export function diagramDiagnostic(
  code: DiagramDiagnosticCode,
  range: SourceRange | undefined,
  detail: DiagramDiagnosticDetail = {},
): MarkdownDiagnostic {
  const path = code === 'DIAGRAM_LAYOUT_INVALID' && detail.path !== undefined && detail.path !== '' ? detail.path : undefined
  return diagnostic(code, SEVERITY[code], MESSAGE[code](detail), {
    ...(path === undefined ? {} : { path }),
    ...(range === undefined ? {} : { range }),
  })
}

function atLine(line: number | undefined): string {
  return line === undefined ? '' : ` (line ${line})`
}

function lineMessage(line: number | undefined, message: string | undefined): string {
  const body = message ?? 'A statement could not be read.'
  return line === undefined ? body : `Line ${line}: ${body}`
}
