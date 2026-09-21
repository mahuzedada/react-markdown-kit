/**
 * Authoring audit (spec 8.10, 11.2).
 *
 * Interpolation walks the *parsed tree*, which is what makes it safe. But that
 * means a placeholder the Markdown parser dissolved is invisible to it:
 *
 *   {{__proto__.x}}
 *
 * CommonMark reads the `__ ... __` pair as strong emphasis, so by the time the
 * engine looks at the tree there is no `{{...}}` run left to reject — just the
 * stray text `{{`, a `strong` node, and `.x}}`. Nothing resolves and nothing is
 * polluted, but the author gets mangled output and no explanation.
 *
 * So the authored source is **audited** as well as parsed. This is a read-only
 * validation pass: it scans for `{{...}}` runs and reports the ones that are
 * unusable. It never substitutes anything and its output never feeds the
 * parser, so the structural-interpolation guarantee is untouched.
 *
 * Two regions are excluded, matching the resolution rules exactly (spec 8.11):
 * spans belonging to literal nodes (code, inline code, raw HTML, frontmatter),
 * and occurrences the author escaped with a backslash.
 */

import { diagnostic, type MarkdownDiagnostic, type SourceRange } from '@internal/diagnostics/index.js'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import { TEMPLATE_DIAGNOSTIC_CODES } from './diagnostic-codes.js'
import { HTML_NODE_TYPES } from './parse.js'
import { scanPlaceholders, type PlaceholderBinding } from './placeholder.js'

interface Span {
  readonly start: number
  readonly end: number
}

/**
 * Diagnostics knowable from the authored source alone. Cached with the parsed
 * tree, because like the tree it depends only on template identity (spec 11.3).
 */
export function auditSource(
  source: string,
  tree: MarkdownRoot,
  literalNodeTypes: ReadonlySet<string>,
  treePlaceholders: readonly PlaceholderBinding[],
): MarkdownDiagnostic[] {
  const literal = literalSpans(tree, literalNodeTypes)
  const lines = lineStarts(source)
  // Match on the NORMALIZED placeholder, not the raw one. A formatter inside a
  // GFM table cell is authored `{{amount \| currency:"USD"}}` because GFM
  // requires a literal pipe in a cell to be escaped, and the parser unescapes
  // it. So the source and the tree legitimately differ by that backslash, and
  // comparing raw text would report a placeholder that resolved perfectly well
  // as "consumed by Markdown syntax".
  const survived = new Set(treePlaceholders.map((binding) => normalizePlaceholder(binding.raw)))
  const diagnostics: MarkdownDiagnostic[] = []

  for (const binding of scanPlaceholders(source)) {
    if (isEscaped(source, binding.start)) continue
    if (literal.some((span) => binding.start >= span.start && binding.end <= span.end)) continue

    const range = toRange(source, lines, binding.start, binding.end)
    const at = {
      ...(binding.path === '' ? {} : { path: binding.path }),
      range,
    }

    if (binding.problem !== undefined) {
      diagnostics.push(diagnostic(binding.problem.code, 'error', binding.problem.message, at))
      continue
    }
    if (!survived.has(normalizePlaceholder(binding.raw))) {
      diagnostics.push(
        diagnostic(
          TEMPLATE_DIAGNOSTIC_CODES.placeholderNotParsed,
          'error',
          `The placeholder ${binding.raw} was consumed by Markdown syntax before it could be resolved. Rename the variable or escape the surrounding punctuation.`,
          at,
        ),
      )
    }
  }
  return diagnostics
}

/** Drops the GFM cell escape so a source placeholder and its parsed twin compare equal. */
function normalizePlaceholder(raw: string): string {
  return raw.replace(/\\\|/g, '|')
}

/** Source spans whose contents are data, not prose, and are never resolved. */
function literalSpans(tree: MarkdownRoot, literalNodeTypes: ReadonlySet<string>): Span[] {
  const spans: Span[] = []
  const walk = (node: MarkdownNode): void => {
    const isLiteral = literalNodeTypes.has(node.type) || HTML_NODE_TYPES.has(node.type)
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (isLiteral && typeof start === 'number' && typeof end === 'number') {
      spans.push({ start, end })
      return
    }
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child)
  }
  walk(tree)
  return spans
}

function isEscaped(source: string, start: number): boolean {
  let backslashes = 0
  for (let at = start - 1; at >= 0 && source.charAt(at) === '\\'; at -= 1) backslashes += 1
  return backslashes % 2 === 1
}

function lineStarts(source: string): number[] {
  const starts = [0]
  for (let at = 0; at < source.length; at += 1) {
    if (source.charAt(at) === '\n') starts.push(at + 1)
  }
  return starts
}

function toRange(source: string, lines: readonly number[], start: number, end: number): SourceRange {
  return { start: point(lines, start), end: point(lines, end) }
}

function point(lines: readonly number[], offset: number): { line: number; column: number; offset: number } {
  let low = 0
  let high = lines.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if ((lines[mid] as number) <= offset) low = mid
    else high = mid - 1
  }
  return { line: low + 1, column: offset - (lines[low] as number) + 1, offset }
}
