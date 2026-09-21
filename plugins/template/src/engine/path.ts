/**
 * Data paths (spec 8.10, 11.2).
 *
 * A path is a dotted sequence of plain identifiers, nothing more. There is no
 * bracket syntax, no call syntax, no `this`, no expression. Lookup walks own
 * enumerable properties only, so a value can never reach `Object.prototype`
 * and no getter inherited from a prototype is ever invoked.
 */

import { TEMPLATE_DIAGNOSTIC_CODES } from './diagnostic-codes.js'

/** Segments that would expose the prototype chain. Rejected, never traversed. */
const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
])

const PATH_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z0-9_$]+)*$/

export interface PathProblem {
  readonly code: string
  readonly message: string
}

export type ParsedPath =
  | { readonly ok: true; readonly segments: readonly string[] }
  | { readonly ok: false; readonly problem: PathProblem }

export function parsePath(raw: string): ParsedPath {
  const path = raw.trim()
  if (path.length === 0) {
    return {
      ok: false,
      problem: {
        code: TEMPLATE_DIAGNOSTIC_CODES.invalidPath,
        message: 'Placeholder has no variable path.',
      },
    }
  }
  if (!PATH_PATTERN.test(path)) {
    return {
      ok: false,
      problem: {
        code: TEMPLATE_DIAGNOSTIC_CODES.invalidPath,
        message: `Invalid variable path: ${path}. A path is dot-separated identifiers, for example customer.name.`,
      },
    }
  }
  const segments = path.split('.')
  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      return {
        ok: false,
        problem: {
          code: TEMPLATE_DIAGNOSTIC_CODES.unsafePath,
          message: `Unsafe variable path: ${path}. Segment "${segment}" would traverse the prototype chain.`,
        },
      }
    }
  }
  return { ok: true, segments }
}

export function isForbiddenSegment(segment: string): boolean {
  return FORBIDDEN_SEGMENTS.has(segment)
}

export type PathLookup =
  | { readonly found: true; readonly value: unknown }
  | { readonly found: false }

const NOT_FOUND: PathLookup = { found: false }

/**
 * Reads `segments` off `data`. Own properties only: `Object.hasOwn` is the
 * gate, so neither `toString` nor anything else inherited resolves, and a
 * `Map`/`Set` is treated as a plain value rather than being indexed.
 */
export function lookupPath(data: unknown, segments: readonly string[]): PathLookup {
  let current: unknown = data
  for (const segment of segments) {
    if (isForbiddenSegment(segment)) return NOT_FOUND
    if (current === null || current === undefined) return NOT_FOUND
    if (typeof current !== 'object') return NOT_FOUND
    if (!Object.hasOwn(current, segment)) return NOT_FOUND
    current = (current as Record<string, unknown>)[segment]
  }
  return { found: true, value: current }
}
