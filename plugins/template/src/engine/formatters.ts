/**
 * Formatters (spec 8.14).
 *
 * Built-ins cover `number`, `currency`, `percent`, `date`, `time` and
 * `datetime` using the platform `Intl` APIs. Two deliberate rules:
 *
 *   1. Currency is explicit. `{{revenue | currency:"USD"}}`. A locale never
 *      implies a currency, because "fr-FR" says nothing about whether the
 *      amount is euros.
 *   2. Time zone is explicit and defaults to UTC, so the same data renders the
 *      same document on a laptop and on a build server. Pass `timeZone` to
 *      `resolve` for anything else.
 *
 * A formatter returns a *string*, and that string is inserted as text. It is
 * never reparsed as Markdown (spec 8.14), so a custom formatter cannot widen
 * the injection surface.
 */

import { TEMPLATE_DIAGNOSTIC_CODES } from './diagnostic-codes.js'

export interface TemplateFormatterContext {
  /** The argument after the colon, already unquoted. */
  readonly argument?: string
  /** BCP-47 tag used for `Intl`. */
  readonly locale: string
  /** IANA time zone used for date/time formatting. */
  readonly timeZone: string
  /** The variable path, for diagnostics. Never the value. */
  readonly path: string
}

export type TemplateFormatter = (value: unknown, context: TemplateFormatterContext) => string

/**
 * Thrown by a formatter to produce a specific diagnostic code. Anything else a
 * formatter throws becomes `TEMPLATE_FORMATTER_FAILED`.
 */
export class TemplateFormatterError extends Error {
  override readonly name = 'TemplateFormatterError'
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const DATE_STYLES = new Set(['full', 'long', 'medium', 'short'])
const CURRENCY_CODE = /^[A-Za-z]{3}$/

function asNumber(value: unknown, path: string, formatter: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  throw new TemplateFormatterError(
    TEMPLATE_DIAGNOSTIC_CODES.formatterValueType,
    `Formatter "${formatter}" needs a finite number at ${path}.`,
  )
}

function asDate(value: unknown, path: string, formatter: string): Date {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value)
        : typeof value === 'string'
          ? new Date(value)
          : undefined
  if (date === undefined || Number.isNaN(date.getTime())) {
    throw new TemplateFormatterError(
      TEMPLATE_DIAGNOSTIC_CODES.formatterValueType,
      `Formatter "${formatter}" needs a Date, an epoch number or an ISO string at ${path}.`,
    )
  }
  return date
}

function fractionDigits(argument: string | undefined): Intl.NumberFormatOptions {
  if (argument === undefined || argument === '') return {}
  const digits = Number(argument)
  if (!Number.isInteger(digits) || digits < 0 || digits > 20) {
    throw new TemplateFormatterError(
      TEMPLATE_DIAGNOSTIC_CODES.formatterArgumentRequired,
      `Expected a fraction-digit count between 0 and 20, got "${argument}".`,
    )
  }
  return { minimumFractionDigits: digits, maximumFractionDigits: digits }
}

function dateStyle(argument: string | undefined, formatter: string): 'full' | 'long' | 'medium' | 'short' {
  const style = argument ?? 'medium'
  if (!DATE_STYLES.has(style)) {
    throw new TemplateFormatterError(
      TEMPLATE_DIAGNOSTIC_CODES.formatterArgumentRequired,
      `Formatter "${formatter}" accepts full, long, medium or short; got "${style}".`,
    )
  }
  return style as 'full' | 'long' | 'medium' | 'short'
}

export const builtinFormatters: Readonly<Record<string, TemplateFormatter>> = Object.freeze({
  number(value, { argument, locale, path }) {
    return new Intl.NumberFormat(locale, fractionDigits(argument)).format(
      asNumber(value, path, 'number'),
    )
  },

  currency(value, { argument, locale, path }) {
    if (argument === undefined || argument === '') {
      throw new TemplateFormatterError(
        TEMPLATE_DIAGNOSTIC_CODES.formatterArgumentRequired,
        `Formatter "currency" needs an explicit ISO 4217 code, for example {{${path} | currency:"USD"}}. A locale never implies a currency.`,
      )
    }
    if (!CURRENCY_CODE.test(argument)) {
      throw new TemplateFormatterError(
        TEMPLATE_DIAGNOSTIC_CODES.formatterArgumentRequired,
        `Formatter "currency" expects a three-letter ISO 4217 code, got "${argument}".`,
      )
    }
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: argument.toUpperCase(),
    }).format(asNumber(value, path, 'currency'))
  },

  percent(value, { argument, locale, path }) {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      ...fractionDigits(argument),
    }).format(asNumber(value, path, 'percent'))
  },

  date(value, { argument, locale, timeZone, path }) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: dateStyle(argument, 'date'),
      timeZone,
    }).format(asDate(value, path, 'date'))
  },

  time(value, { argument, locale, timeZone, path }) {
    return new Intl.DateTimeFormat(locale, {
      timeStyle: dateStyle(argument, 'time'),
      timeZone,
    }).format(asDate(value, path, 'time'))
  },

  datetime(value, { argument, locale, timeZone, path }) {
    const style = dateStyle(argument, 'datetime')
    return new Intl.DateTimeFormat(locale, {
      dateStyle: style,
      timeStyle: style === 'full' || style === 'long' ? 'long' : style,
      timeZone,
    }).format(asDate(value, path, 'datetime'))
  },
})

/**
 * Built-ins first, then extension-contributed, then template config, then
 * per-call. Later wins, so an application can replace `date` with its own
 * house style without forking the package.
 */
export function mergeFormatters(
  ...layers: readonly (Readonly<Record<string, TemplateFormatter>> | undefined)[]
): Readonly<Record<string, TemplateFormatter>> {
  const merged: Record<string, TemplateFormatter> = { ...builtinFormatters }
  for (const layer of layers) {
    if (layer === undefined) continue
    for (const [name, formatter] of Object.entries(layer)) {
      if (typeof formatter === 'function') merged[name] = formatter
    }
  }
  return merged
}
