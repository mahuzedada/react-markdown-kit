/**
 * Shared diagnostics contract (CORE-03).
 *
 * One diagnostic shape is used by compilation, template resolution and the
 * editor so an application can surface every problem through one UI path.
 * Codes are stable strings: they are part of the public contract and may only
 * gain new members in a minor release, never change meaning.
 */

export type DiagnosticSeverity = 'info' | 'warning' | 'error'

/** A zero-based offset plus a one-based line/column, matching mdast positions. */
export interface SourcePoint {
  readonly line: number
  readonly column: number
  readonly offset?: number
}

export interface SourceRange {
  readonly start: SourcePoint
  readonly end: SourcePoint
}

export interface MarkdownDiagnostic {
  /** Stable machine-readable code, e.g. `TEMPLATE_REQUIRED_VALUE`. */
  readonly code: string
  readonly severity: DiagnosticSeverity
  /** Human-readable, safe to show a developer. Never contains runtime values. */
  readonly message: string
  /** Dotted data path when the diagnostic is about a value, e.g. `customer.name`. */
  readonly path?: string
  readonly range?: SourceRange
}

/** Template diagnostics are Markdown diagnostics; the alias documents intent. */
export type TemplateDiagnostic = MarkdownDiagnostic

export function diagnostic(
  code: string,
  severity: DiagnosticSeverity,
  message: string,
  extra?: { path?: string; range?: SourceRange },
): MarkdownDiagnostic {
  const base = { code, severity, message }
  if (extra?.path !== undefined && extra.range !== undefined) {
    return { ...base, path: extra.path, range: extra.range }
  }
  if (extra?.path !== undefined) return { ...base, path: extra.path }
  if (extra?.range !== undefined) return { ...base, range: extra.range }
  return base
}

export function hasErrors(list: readonly MarkdownDiagnostic[]): boolean {
  return list.some((d) => d.severity === 'error')
}

/**
 * Thrown for configuration mistakes that cannot produce a valid document:
 * an unknown preset shape, a duplicate extension that cannot be merged, a
 * malformed template definition. Parse-level problems become diagnostics on
 * the document instead, so a caller never has to try/catch ordinary content.
 */
export class MarkdownConfigurationError extends Error {
  override readonly name = 'MarkdownConfigurationError'
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
