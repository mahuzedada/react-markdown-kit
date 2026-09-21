/**
 * Turning one placeholder into one string (spec 8.7, 8.14, 11.2, 11.4).
 *
 * The output is always a plain string. The caller decides where it goes; it is
 * never handed back as Markdown to reparse. Diagnostics name the path and the
 * formatter, never the value (spec 11.4).
 */

import { diagnostic, type MarkdownDiagnostic, type SourceRange } from '@internal/diagnostics/index.js'
import { TEMPLATE_DIAGNOSTIC_CODES } from './diagnostic-codes.js'
import { lookupPath } from './path.js'
import { TemplateFormatterError, type TemplateFormatter } from './formatters.js'
import type { PlaceholderBinding } from './placeholder.js'
import type { TemplateVariableMeta } from './types.js'

export interface ValueContext {
  readonly data: unknown
  readonly locale: string
  readonly timeZone: string
  readonly formatters: Readonly<Record<string, TemplateFormatter>>
  readonly variables: Readonly<Record<string, TemplateVariableMeta>>
  report(value: MarkdownDiagnostic): void
}

export type ValueOutcome =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false }

const FAILED: ValueOutcome = { ok: false }

export function resolveBinding(
  binding: PlaceholderBinding,
  context: ValueContext,
  range: SourceRange | undefined,
): ValueOutcome {
  const at = (path?: string): { path?: string; range?: SourceRange } => ({
    ...(path === undefined ? {} : { path }),
    ...(range === undefined ? {} : { range }),
  })

  if (binding.problem !== undefined) {
    context.report(
      diagnostic(binding.problem.code, 'error', binding.problem.message, at(binding.path || undefined)),
    )
    return FAILED
  }

  const meta = readMeta(context.variables, binding.path)
  const found = lookupPath(context.data, binding.segments)
  const raw = found.found ? found.value : undefined

  if (raw === undefined || raw === null) {
    if (meta !== undefined && meta.default !== undefined) {
      return applyFormatter(meta.default, binding, context, at(binding.path))
    }
    const optional = meta !== undefined && (meta.required === false || 'default' in meta)
    if (optional) {
      context.report(
        diagnostic(
          TEMPLATE_DIAGNOSTIC_CODES.optionalValueMissing,
          'info',
          `Optional variable ${binding.path} had no value; resolved to empty text.`,
          at(binding.path),
        ),
      )
      return { ok: true, text: '' }
    }
    context.report(
      diagnostic(
        TEMPLATE_DIAGNOSTIC_CODES.requiredValue,
        'error',
        `Missing required variable: ${binding.path}`,
        at(binding.path),
      ),
    )
    return FAILED
  }

  return applyFormatter(raw, binding, context, at(binding.path))
}

function readMeta(
  variables: Readonly<Record<string, TemplateVariableMeta>>,
  path: string,
): TemplateVariableMeta | undefined {
  return Object.hasOwn(variables, path) ? variables[path] : undefined
}

function applyFormatter(
  value: unknown,
  binding: PlaceholderBinding,
  context: ValueContext,
  at: { path?: string; range?: SourceRange },
): ValueOutcome {
  if (binding.formatter === undefined) {
    const text = stringify(value)
    if (text === undefined) {
      context.report(
        diagnostic(
          TEMPLATE_DIAGNOSTIC_CODES.valueNotScalar,
          'error',
          `Variable ${binding.path} is a ${describe(value)}; only strings, numbers, booleans and dates can be written into a document.`,
          at,
        ),
      )
      return FAILED
    }
    return { ok: true, text }
  }

  const formatter = Object.hasOwn(context.formatters, binding.formatter)
    ? context.formatters[binding.formatter]
    : undefined
  if (formatter === undefined) {
    context.report(
      diagnostic(
        TEMPLATE_DIAGNOSTIC_CODES.unknownFormatter,
        'error',
        `Unknown formatter "${binding.formatter}" on ${binding.path}. Register it through the template's formatters option.`,
        at,
      ),
    )
    return FAILED
  }

  try {
    const formatted = formatter(value, {
      ...(binding.argument === undefined ? {} : { argument: binding.argument }),
      locale: context.locale,
      timeZone: context.timeZone,
      path: binding.path,
    })
    // A formatter's output is inserted as text, never reparsed (spec 8.14).
    return { ok: true, text: typeof formatted === 'string' ? formatted : String(formatted) }
  } catch (error) {
    const code =
      error instanceof TemplateFormatterError ? error.code : TEMPLATE_DIAGNOSTIC_CODES.formatterFailed
    const message =
      error instanceof TemplateFormatterError
        ? error.message
        : `Formatter "${binding.formatter}" failed on ${binding.path}.`
    context.report(diagnostic(code, 'error', message, at))
    return FAILED
  }
}

function stringify(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  return undefined
}

function describe(value: unknown): string {
  if (Array.isArray(value)) return 'list'
  if (typeof value === 'function') return 'function'
  if (typeof value === 'number') return 'non-finite number'
  if (typeof value === 'object') return 'object'
  return typeof value
}
