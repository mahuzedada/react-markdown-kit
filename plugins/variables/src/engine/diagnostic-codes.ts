/**
 * Stable variable diagnostic codes (spec 8.7, 11.4).
 *
 * Codes are part of the public contract: new members may be added in a minor
 * release, existing members never change meaning. Messages name the *path*
 * and never the runtime value, so a diagnostic is safe to log (spec 11.4).
 */

export const VARIABLE_DIAGNOSTIC_CODES = {
  /** A required variable had no value in the supplied data. */
  requiredValue: 'VARIABLE_REQUIRED_VALUE',
  /** A declared-optional variable had no value; resolved to empty text. */
  optionalValueMissing: 'VARIABLE_OPTIONAL_VALUE_MISSING',
  /** The value was an object, array or function: nothing sensible to print. */
  valueNotScalar: 'VARIABLE_VALUE_NOT_SCALAR',
  /** Placeholder syntax the v1 grammar does not accept. */
  malformedPlaceholder: 'VARIABLE_MALFORMED_PLACEHOLDER',
  /** A path segment was `__proto__`, `constructor` or `prototype` (spec 11.2). */
  unsafePath: 'VARIABLE_UNSAFE_PATH',
  /** A path that is not a dotted sequence of plain identifiers. */
  invalidPath: 'VARIABLE_INVALID_PATH',
  /**
   * The author wrote a placeholder that Markdown itself dissolved, so it never
   * reached the engine intact. `{{__proto__.x}}` is the canonical case: the
   * `__ __` pair is strong emphasis, so the run is split before any variable
   * code sees it.
   */
  placeholderNotParsed: 'VARIABLE_PLACEHOLDER_NOT_PARSED',
  /** No formatter is registered under that name. */
  unknownFormatter: 'VARIABLE_UNKNOWN_FORMATTER',
  /** The formatter needs an argument that was not supplied (e.g. currency). */
  formatterArgumentRequired: 'VARIABLE_FORMATTER_ARGUMENT_REQUIRED',
  /** The value is the wrong type for the formatter (e.g. currency of a Date). */
  formatterValueType: 'VARIABLE_FORMATTER_VALUE_TYPE',
  /** A formatter threw. */
  formatterFailed: 'VARIABLE_FORMATTER_FAILED',
  /** A placeholder was only part of a URL; v1 binds complete URLs (spec 8.12). */
  partialUrl: 'VARIABLE_PARTIAL_URL',
  /** A bound destination used a protocol outside the safe set. */
  unsafeUrl: 'VARIABLE_UNSAFE_URL',
  /** A placeholder sits inside raw HTML, where it stays literal. */
  placeholderInHtml: 'VARIABLE_PLACEHOLDER_IN_HTML',
  /** The Standard Schema validator rejected the data. */
  schemaInvalid: 'VARIABLE_SCHEMA_INVALID',
  /** The validator returned a Promise; `resolve` is synchronous (spec 17.6). */
  schemaAsync: 'VARIABLE_SCHEMA_ASYNC',
} as const

export type VariableDiagnosticCode =
  (typeof VARIABLE_DIAGNOSTIC_CODES)[keyof typeof VARIABLE_DIAGNOSTIC_CODES]
