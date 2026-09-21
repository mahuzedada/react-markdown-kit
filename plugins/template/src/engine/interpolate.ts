/**
 * Safe structural interpolation (spec 8.11, 8.12) — the security keystone.
 *
 * The rule, stated once:
 *
 *   **A resolved value only ever becomes the `value` of an mdast `text` node,
 *   or the `url`/`title`/`alt` field of a node that already exists.**
 *
 * It is never concatenated into source text that is later parsed. That is why
 * a value of `**Administrator**` renders as the literal characters, why a
 * value containing `|` cannot split a table cell, why `# ` cannot become a
 * heading and why `<script>` cannot become an element: by the time the value
 * exists, the structure of the document is already fixed and the value has
 * nowhere structural to go.
 *
 * Three consequences follow, all deliberate:
 *   - `code` and `inlineCode` values are never scanned (spec 8.11).
 *   - raw `html` nodes are never interpolated; a placeholder there stays
 *     literal and earns a diagnostic, because an HTML attribute context has
 *     escaping rules this engine does not own.
 *   - a URL binding must be the *complete* destination. Partial interpolation
 *     would need encoding decisions v1 does not make (spec 8.12).
 */

import { diagnostic, type MarkdownDiagnostic, type SourceRange } from '@internal/diagnostics/index.js'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import { TEMPLATE_DIAGNOSTIC_CODES } from './diagnostic-codes.js'
import { HTML_NODE_TYPES } from './parse.js'
import {
  escapedOccurrences,
  mightContainPlaceholder,
  scanPlaceholders,
  type PlaceholderBinding,
} from './placeholder.js'
import { isSafeDestination } from './url-policy.js'
import { resolveBinding, type ValueContext } from './values.js'

export interface InterpolationContext extends ValueContext {
  readonly literalNodeTypes: ReadonlySet<string>
  /** Authored source, used only to detect `\{{` escapes. Optional. */
  readonly source: string | undefined
}

/**
 * Constructs that cannot represent a line break at all. An ATX heading is one
 * line and a GFM table cell is one line, so a `\n` left inside one produces a
 * document that `toMarkdown` cannot serialize faithfully: the continuation
 * line loses its `#` prefix and becomes a separate block. Line breaks in a
 * *value* are therefore collapsed to a space in these contexts. Authored text
 * is never touched, and a paragraph keeps its soft breaks.
 */
const SINGLE_LINE_NODE_TYPES: ReadonlySet<string> = new Set(['heading', 'tableCell'])

/** Nodes carrying a destination that a complete binding may fill. */
const DESTINATION_NODE_TYPES: ReadonlySet<string> = new Set(['link', 'image', 'definition'])
/** Nodes carrying plain-text attributes that interpolate like prose. */
const TEXT_ATTRIBUTE_NODE_TYPES: ReadonlySet<string> = new Set([
  'link',
  'image',
  'definition',
  'imageReference',
])

export function interpolateTree(tree: MarkdownRoot, context: InterpolationContext): void {
  walk(tree, context, false)
}

function walk(node: MarkdownNode, context: InterpolationContext, singleLine: boolean): void {
  if (context.literalNodeTypes.has(node.type)) return

  if (HTML_NODE_TYPES.has(node.type)) {
    reportHtmlPlaceholders(node, context)
    return
  }

  if (DESTINATION_NODE_TYPES.has(node.type)) resolveDestination(node, context)
  if (TEXT_ATTRIBUTE_NODE_TYPES.has(node.type)) resolveTextAttributes(node, context)

  const children = node.children
  if (!Array.isArray(children)) return

  const inline = singleLine || SINGLE_LINE_NODE_TYPES.has(node.type)
  let changed = false
  const next: MarkdownNode[] = []
  for (const child of children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      const replacement = interpolateTextNode(child, context, inline)
      if (replacement !== child) changed = true
      next.push(replacement)
      continue
    }
    walk(child, context, inline)
    next.push(child)
  }
  if (changed) node.children = next
}

/**
 * Flattens every line break in an inserted value to a space. Applied to data
 * only; authored text keeps every break the author wrote.
 *
 * This is a security boundary, not formatting. A placeholder always sits in
 * inline context, but `toMarkdown` will happily write a value's newline as a
 * real line break, and **every dangerous block construct needs only
 * line-start position to form** — a table row, a list bullet, an ATX heading,
 * a fence, a thematic break. A blank line is not required.
 *
 * So a value of `"\n| x | y |\n| --- | --- |\n| 1 | 2 |"` in a paragraph
 * resolved to a safe single-paragraph document, serialized to Markdown with
 * those breaks intact, and then re-parsed as GFM into `[paragraph, table]`.
 * The attacker's table materialized one hop downstream, in exactly the
 * persist-then-render pipeline this package exists to serve.
 *
 * An earlier version collapsed only blank-line *runs*, which left single
 * newlines alive and the hole open. Flattening unconditionally closes it:
 * after this, no character of a value can ever reach column one.
 *
 * Every character of the value survives; only newlines become spaces. A value
 * that genuinely needs line structure is a block-level feature, not something
 * inline data should smuggle through.
 */
function forContext(text: string, _singleLine: boolean): string {
  return text.replace(/\r\n?|\n/g, ' ')
}

/**
 * Rewrites one `text` node. The result is a single `text` node whose value is
 * literal characters: literal segments and resolved values concatenated. No
 * segment is ever reparsed, so nothing in a value can become structure.
 */
function interpolateTextNode(
  node: MarkdownNode,
  context: InterpolationContext,
  singleLine: boolean,
): MarkdownNode {
  const value = node.value as string
  const bindings = scanPlaceholders(value)
  if (bindings.length === 0) return node

  const escaped = escapedOccurrences(value, rawSlice(node, context.source), bindings.length)
  const range = rangeOf(node)

  let out = ''
  let cursor = 0
  let touched = false
  bindings.forEach((binding, index) => {
    out += value.slice(cursor, binding.start)
    cursor = binding.end
    if (escaped[index] === true) {
      // Authored as `\{{x}}`; CommonMark already ate the backslash.
      out += binding.raw
      return
    }
    touched = true
    const outcome = resolveBinding(binding, context, range)
    out += outcome.ok ? forContext(outcome.text, singleLine) : ''
  })
  out += value.slice(cursor)

  if (!touched && out === value) return node
  // Positions describe the authored template, not the resolved document, so
  // they are dropped rather than left lying about a span that no longer exists.
  return { type: 'text', value: out }
}

function resolveDestination(node: MarkdownNode, context: InterpolationContext): void {
  const url = node.url
  if (typeof url !== 'string' || !mightContainPlaceholder(url)) return
  const bindings = scanPlaceholders(url)
  if (bindings.length === 0) return

  const range = rangeOf(node)
  const first = bindings[0] as PlaceholderBinding
  const complete = bindings.length === 1 && first.start === 0 && first.end === url.length
  if (!complete) {
    context.report(
      diagnostic(
        TEMPLATE_DIAGNOSTIC_CODES.partialUrl,
        'error',
        `Partial URL interpolation is not supported in v1: ${url.slice(0, 80)}. Bind the complete destination and build the URL in the application.`,
        range === undefined ? undefined : { range },
      ),
    )
    return
  }

  const outcome = resolveBinding(first, context, range)
  if (!outcome.ok) return

  if (!isSafeDestination(outcome.text)) {
    context.report(
      diagnostic(
        TEMPLATE_DIAGNOSTIC_CODES.unsafeUrl,
        'error',
        `Variable ${first.path} resolved to a destination with an unsafe protocol.`,
        {
          path: first.path,
          ...(range === undefined ? {} : { range }),
        },
      ),
    )
    return
  }
  node.url = outcome.text
}

/** `alt` and `title` are plain-text attributes: partial interpolation is safe. */
function resolveTextAttributes(node: MarkdownNode, context: InterpolationContext): void {
  for (const field of ['alt', 'title'] as const) {
    const current = node[field]
    if (typeof current !== 'string' || !mightContainPlaceholder(current)) continue
    node[field] = interpolatePlainText(current, node, context)
  }
}

function interpolatePlainText(
  value: string,
  node: MarkdownNode,
  context: InterpolationContext,
): string {
  const bindings = scanPlaceholders(value)
  if (bindings.length === 0) return value
  const range = rangeOf(node)
  let out = ''
  let cursor = 0
  for (const binding of bindings) {
    out += value.slice(cursor, binding.start)
    cursor = binding.end
    const outcome = resolveBinding(binding, context, range)
    // `alt` and `title` are single-line attributes in every Markdown form.
    out += outcome.ok ? forContext(outcome.text, true) : ''
  }
  return out + value.slice(cursor)
}

function reportHtmlPlaceholders(node: MarkdownNode, context: InterpolationContext): void {
  const value = node.value
  if (typeof value !== 'string' || !mightContainPlaceholder(value)) return
  const range = rangeOf(node)
  context.report(
    diagnostic(
      TEMPLATE_DIAGNOSTIC_CODES.placeholderInHtml,
      'warning',
      'A placeholder inside raw HTML is left literal. Move it into Markdown prose or build the HTML in the application.',
      range === undefined ? undefined : { range },
    ),
  )
}

function rangeOf(node: MarkdownNode): SourceRange | undefined {
  const position = node.position
  if (position === undefined) return undefined
  return { start: position.start, end: position.end }
}

function rawSlice(node: MarkdownNode, source: string | undefined): string | undefined {
  if (source === undefined) return undefined
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (typeof start !== 'number' || typeof end !== 'number') return undefined
  return source.slice(start, end)
}
