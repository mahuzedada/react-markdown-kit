/**
 * Placeholder grammar (spec 8.10).
 *
 *   {{customer.name}}
 *   {{revenue | currency:"USD"}}
 *
 * That is the whole language. No expressions, no calls, no conditions, no
 * loops (spec 8.15 defers those behind a structural grammar).
 *
 * Scanning happens over the *value of a parsed node*, never over the raw
 * document, which is what keeps interpolation structural (spec 8.11).
 */

import { TEMPLATE_DIAGNOSTIC_CODES } from './diagnostic-codes.js'
import { parsePath, type PathProblem } from './path.js'

export interface PlaceholderBinding {
  /** The full `{{...}}` text as it appeared. */
  readonly raw: string
  /** Dotted path, normalized (whitespace trimmed). */
  readonly path: string
  readonly segments: readonly string[]
  readonly formatter?: string
  readonly argument?: string
  /** Offset of `{{` inside the scanned string. */
  readonly start: number
  /** Offset just past `}}` inside the scanned string. */
  readonly end: number
  /** Set when the placeholder is syntactically unusable. */
  readonly problem?: PathProblem
}

const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g
const FORMATTER_PATTERN = /^([A-Za-z_][A-Za-z0-9_-]*)(?:\s*:\s*([\s\S]+))?$/

/** True when the string could possibly contain a placeholder. Cheap pre-filter. */
export function mightContainPlaceholder(value: string): boolean {
  return value.includes('{{')
}

export function scanPlaceholders(value: string): PlaceholderBinding[] {
  if (!mightContainPlaceholder(value)) return []
  const bindings: PlaceholderBinding[] = []
  PLACEHOLDER_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PLACEHOLDER_PATTERN.exec(value)) !== null) {
    bindings.push(parseBinding(match[0], match[1] ?? '', match.index))
  }
  return bindings
}

function parseBinding(raw: string, inner: string, start: number): PlaceholderBinding {
  const end = start + raw.length

  // GFM requires a literal `|` inside a table cell to be written `\|`, so a
  // formatter in a table cell is authored `{{amount \| currency:"USD"}}`. The
  // parser unescapes that, meaning the TREE already reads `|` while the raw
  // SOURCE still carries the backslash. Normalizing here lets both the
  // tree walk and the source audit read the same expression, which is what
  // makes a formatted value usable in a table at all.
  const expression = inner.replace(/\\\|/g, '|')

  const pipe = expression.indexOf('|')
  const pathPart = pipe === -1 ? expression : expression.slice(0, pipe)
  const formatterPart = pipe === -1 ? undefined : expression.slice(pipe + 1).trim()

  const path = parsePath(pathPart)
  if (!path.ok) {
    return { raw, path: pathPart.trim(), segments: [], start, end, problem: path.problem }
  }

  const base = {
    raw,
    path: pathPart.trim(),
    segments: path.segments,
    start,
    end,
  } as const

  if (formatterPart === undefined) return base

  const parsed = FORMATTER_PATTERN.exec(formatterPart)
  if (parsed === null) {
    return {
      ...base,
      problem: {
        code: TEMPLATE_DIAGNOSTIC_CODES.malformedPlaceholder,
        message: `Malformed formatter in ${raw}. Expected {{path | name}} or {{path | name:"argument"}}.`,
      },
    }
  }

  const name = parsed[1] as string
  const argument = parsed[2] === undefined ? undefined : unquote(parsed[2].trim())
  return argument === undefined
    ? { ...base, formatter: name }
    : { ...base, formatter: name, argument }
}

function unquote(value: string): string {
  const first = value.charAt(0)
  if ((first === '"' || first === "'") && value.length >= 2 && value.endsWith(first)) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Which occurrences the author escaped with a leading backslash (spec 8.11).
 *
 * CommonMark consumes the backslash of `\{{x}}` during parsing, so by the time
 * we see a `text` node its value is indistinguishable from an unescaped
 * placeholder. The node's own source span still carries the backslash, so we
 * align the two occurrence lists positionally: escapes only ever *remove*
 * characters, never reorder or drop a `{{...}}` run, so occurrence *i* in the
 * value is occurrence *i* in the raw slice.
 *
 * When the counts disagree (a placeholder body that itself contained an escape
 * or a character reference) we fail open to "not escaped" rather than guess.
 */
export function escapedOccurrences(
  value: string,
  rawSlice: string | undefined,
  occurrences: number,
): readonly boolean[] {
  const none = new Array<boolean>(occurrences).fill(false)
  if (rawSlice === undefined || rawSlice === value) return none
  if (!rawSlice.includes('\\')) return none

  const rawStarts: number[] = []
  PLACEHOLDER_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PLACEHOLDER_PATTERN.exec(rawSlice)) !== null) rawStarts.push(match.index)
  if (rawStarts.length !== occurrences) return none

  return rawStarts.map((start) => {
    let backslashes = 0
    for (let at = start - 1; at >= 0 && rawSlice.charAt(at) === '\\'; at -= 1) backslashes += 1
    return backslashes % 2 === 1
  })
}
