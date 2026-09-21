/**
 * Standard Schema support (spec 8.5).
 *
 * The interface is declared here rather than imported, so the package has no
 * runtime dependency on `@standard-schema/spec`, on Zod, or on any other
 * validator. Detection is structural: anything carrying a `~standard` property
 * with a `validate` function is accepted, which is exactly what the standard
 * promises.
 */

import { diagnostic, type MarkdownDiagnostic } from '@internal/diagnostics/index.js'
import { TEMPLATE_DIAGNOSTIC_CODES } from './diagnostic-codes.js'

export interface StandardSchemaPathSegment {
  readonly key: PropertyKey
}

export interface StandardSchemaIssue {
  readonly message: string
  readonly path?: readonly (PropertyKey | StandardSchemaPathSegment)[] | undefined
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly StandardSchemaIssue[] }

export interface StandardSchemaProps<Input = unknown, Output = Input> {
  readonly version: 1
  readonly vendor: string
  readonly validate: (value: unknown) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>
  readonly types?: { readonly input: Input; readonly output: Output } | undefined
}

/** Structural shape of any Standard Schema validator. */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaProps<Input, Output>
}

/** The data type a validator produces, when it declares one. */
export type InferSchemaOutput<TSchema> = TSchema extends StandardSchema<unknown, infer Output>
  ? Output
  : never

export function isStandardSchema(value: unknown): value is StandardSchema {
  if (typeof value !== 'object' || value === null) return false
  const props = (value as { '~standard'?: unknown })['~standard']
  if (typeof props !== 'object' || props === null) return false
  return typeof (props as StandardSchemaProps).validate === 'function'
}

export type SchemaValidation =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly diagnostics: readonly MarkdownDiagnostic[] }

/**
 * Runs a validator synchronously. `resolve` is synchronous by contract (spec
 * 8.6, 17.6): a validator that returns a Promise is a configuration mismatch
 * reported as a diagnostic rather than silently awaited.
 */
export function validateWithSchema(schema: StandardSchema, data: unknown): SchemaValidation {
  const outcome = schema['~standard'].validate(data)
  if (isThenable(outcome)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          TEMPLATE_DIAGNOSTIC_CODES.schemaAsync,
          'error',
          'The schema validated asynchronously. resolve() is synchronous; use a synchronous validator.',
        ),
      ],
    }
  }
  if (outcome.issues === undefined) return { ok: true, data: outcome.value }
  return {
    ok: false,
    diagnostics: outcome.issues.map((issue) => {
      const path = issuePath(issue)
      return diagnostic(
        TEMPLATE_DIAGNOSTIC_CODES.schemaInvalid,
        'error',
        issue.message,
        path === undefined ? undefined : { path },
      )
    }),
  }
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function issuePath(issue: StandardSchemaIssue): string | undefined {
  if (issue.path === undefined || issue.path.length === 0) return undefined
  return issue.path
    .map((segment) =>
      typeof segment === 'object' && segment !== null
        ? String((segment as StandardSchemaPathSegment).key)
        : String(segment),
    )
    .join('.')
}
