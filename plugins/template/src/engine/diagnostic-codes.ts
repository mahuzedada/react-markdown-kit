/**
 * Stable template diagnostic codes (spec 8.7, 11.4).
 *
 * Codes are part of the public contract: new members may be added in a minor
 * release, existing members never change meaning. Messages name the *path*
 * and never the runtime value, so a diagnostic is safe to log (spec 11.4).
 */

export const TEMPLATE_DIAGNOSTIC_CODES = {
  /** A required variable had no value in the supplied data. */
  requiredValue: 'TEMPLATE_REQUIRED_VALUE',
  /** A declared-optional variable had no value; resolved to empty text. */
  optionalValueMissing: 'TEMPLATE_OPTIONAL_VALUE_MISSING',
  /** The value was an object, array or function: nothing sensible to print. */
  valueNotScalar: 'TEMPLATE_VALUE_NOT_SCALAR',
  /** Placeholder syntax the v1 grammar does not accept. */
  malformedPlaceholder: 'TEMPLATE_MALFORMED_PLACEHOLDER',
  /** A path segment was `__proto__`, `constructor` or `prototype` (spec 11.2). */
  unsafePath: 'TEMPLATE_UNSAFE_PATH',
  /** A path that is not a dotted sequence of plain identifiers. */
  invalidPath: 'TEMPLATE_INVALID_PATH',
  /**
   * The author wrote a placeholder that Markdown itself dissolved, so it never
   * reached the engine intact. `{{__proto__.x}}` is the canonical case: the
   * `__ __` pair is strong emphasis, so the run is split before any template
   * code sees it.
   */
  placeholderNotParsed: 'TEMPLATE_PLACEHOLDER_NOT_PARSED',
  /** No formatter is registered under that name. */
  unknownFormatter: 'TEMPLATE_UNKNOWN_FORMATTER',
  /** The formatter needs an argument that was not supplied (e.g. currency). */
  formatterArgumentRequired: 'TEMPLATE_FORMATTER_ARGUMENT_REQUIRED',
  /** The value is the wrong type for the formatter (e.g. currency of a Date). */
  formatterValueType: 'TEMPLATE_FORMATTER_VALUE_TYPE',
  /** A formatter threw. */
  formatterFailed: 'TEMPLATE_FORMATTER_FAILED',
  /** A placeholder was only part of a URL; v1 binds complete URLs (spec 8.12). */
  partialUrl: 'TEMPLATE_PARTIAL_URL',
  /** A bound destination used a protocol outside the safe set. */
  unsafeUrl: 'TEMPLATE_UNSAFE_URL',
  /** A bound destination resolved to something that is not a string. */
  urlValueType: 'TEMPLATE_URL_VALUE_TYPE',
  /** A placeholder sits inside raw HTML, where it stays literal. */
  placeholderInHtml: 'TEMPLATE_PLACEHOLDER_IN_HTML',
  /** The requested locale was not authored; a fallback source was used. */
  localeFallback: 'TEMPLATE_LOCALE_FALLBACK',
  /** The requested locale was not authored and the policy forbids falling back. */
  localeMissing: 'TEMPLATE_LOCALE_MISSING',
  /** The Standard Schema validator rejected the data. */
  schemaInvalid: 'TEMPLATE_SCHEMA_INVALID',
  /** The validator returned a Promise; `resolve` is synchronous (spec 17.6). */
  schemaAsync: 'TEMPLATE_SCHEMA_ASYNC',
} as const

export type TemplateDiagnosticCode =
  (typeof TEMPLATE_DIAGNOSTIC_CODES)[keyof typeof TEMPLATE_DIAGNOSTIC_CODES]
