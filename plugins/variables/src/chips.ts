/**
 * `variableChips()` (spec 8.18, 8.19) — placeholders as nodes.
 *
 * One extension with three capabilities:
 *
 *   syntax    every well-formed `{{...}}` run in prose becomes a
 *             `variable` node, and serializes back to the exact
 *             text it was authored as;
 *   renderer  the node becomes `<span data-rmk-variable>` so an unresolved
 *             document previews with its placeholders visible as chips;
 *   variables the node is literal, so a chip never reaches the interpolator.
 *
 * The editor capability is added by `@react-markdown-kit/variables/editor`,
 * which wraps this extension under the same name and draws the chips with
 * the adapter from `createVariableAdapter()`.
 *
 * The one hard behavioural rule (spec 8.19, last bullet):
 *
 *   **Preview data never replaces the authored placeholder.** A
 *   `variable` node stores `path`/`formatter`/`argument` and serializes
 *   from those alone. `preview` is display-only and is not an input to
 *   serialization, so changing preview data can never rewrite the saved source.
 */

import type { Element } from 'hast'
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import { mergeFormatters, type VariableFormatter } from './engine/formatters.js'
import { lookupPath } from './engine/path.js'
import { scanPlaceholders } from './engine/placeholder.js'
import type { VariableMeta } from './engine/types.js'

/** The mdast node type this extension introduces. */
export const VARIABLE_NODE = 'variable'

/** What a placeholder says: the node without its `type`. */
export interface VariableValue {
  readonly path: string
  readonly formatter?: string
  readonly argument?: string
  /** Authored placeholder text, byte-for-byte. Serialization uses this; empty for a chip inserted by hand. */
  readonly value: string
}

export interface VariableNode extends MarkdownNode {
  readonly type: typeof VARIABLE_NODE
  readonly path: string
  readonly formatter?: string
  readonly argument?: string
  readonly value: string
}

export interface VariableChipsOptions<TData = unknown> {
  /** Variable metadata (label, group, required) for chips and pickers, keyed by path. */
  readonly variables?: Readonly<Record<string, VariableMeta>>
  /** Sample data for the chip preview. Never written back to the source. */
  readonly previewData?: TData
  /** Locale used for preview formatting only. */
  readonly previewLocale?: string
  readonly previewTimeZone?: string
  /** Extra formatters offered as suggestions and used for preview. */
  readonly formatters?: Readonly<Record<string, VariableFormatter>>
}

/** One well-formed placeholder found in a run of text. */
export interface VariableMatch {
  readonly node: VariableNode
  /** Offset of `{{` inside the scanned string. */
  readonly start: number
  /** Offset just past `}}`. */
  readonly end: number
}

/** Declared variable metadata with its path, for pickers. */
export interface VariableSummary extends VariableMeta {
  readonly path: string
}

/** What an editor needs to draw a chip and a picker. */
export interface VariableAdapter {
  readonly variables: readonly VariableSummary[]
  readonly formatterNames: readonly string[]
  /** Well-formed placeholders in `text`, in order. Malformed ones are left as text. */
  scan(text: string): readonly VariableMatch[]
  /** Chip label, e.g. "Customer name" falling back to the path. */
  label(node: Pick<VariableValue, 'path'>): string
  /** Sample-data preview, or undefined when there is nothing to show. */
  preview(node: Pick<VariableValue, 'path' | 'formatter' | 'argument'>): string | undefined
  /** The authored text to write back. Independent of preview data. */
  serialize(node: VariableValue): string
}

export function createVariableAdapter<TData = unknown>(
  options: VariableChipsOptions<TData> = {},
): VariableAdapter {
  const variables: VariableSummary[] = Object.entries(options.variables ?? {}).map(([path, meta]) => ({ ...meta, path }))
  const formatters = mergeFormatters(options.formatters)
  const locale = options.previewLocale ?? 'en-US'
  const timeZone = options.previewTimeZone ?? 'UTC'

  return {
    variables,
    formatterNames: Object.keys(formatters).sort(),
    scan,
    label(node) {
      const meta = variables.find((variable) => variable.path === node.path)
      return meta?.label ?? node.path
    },
    preview(node) {
      if (options.previewData === undefined) return undefined
      const found = lookupPath(options.previewData, node.path.split('.'))
      if (!found.found || found.value === null || found.value === undefined) return undefined
      if (node.formatter === undefined) return String(found.value)
      const formatter = Object.hasOwn(formatters, node.formatter) ? formatters[node.formatter] : undefined
      if (formatter === undefined) return String(found.value)
      try {
        return formatter(found.value, {
          ...(node.argument === undefined ? {} : { argument: node.argument }),
          locale,
          timeZone,
          path: node.path,
        })
      } catch {
        // A preview is a convenience. A bad sample value must never break the
        // editor, and it must never alter the authored placeholder.
        return undefined
      }
    },
    serialize,
  }
}

export function variableChips<TData = unknown>(
  options: VariableChipsOptions<TData> = {},
): MarkdownExtension {
  void options
  return {
    name: 'variable-chips',
    version: '1',
    contractVersion: 1,
    capabilities: {
      syntax: {
        nodeTypes: [VARIABLE_NODE],
        // Round trip: text -> variable -> identical text.
        toMarkdownExtensions: [
          {
            handlers: { [VARIABLE_NODE]: (node: VariableNode) => serialize(node) },
            // `{` is not Markdown punctuation, so nothing escapes it. Declared
            // anyway so a future serializer change cannot silently break the
            // round trip.
            unsafe: [],
          },
        ],
        transform: (tree) => liftPlaceholders(tree),
      },
      renderer: {
        handlers: {
          [VARIABLE_NODE]: (_state: unknown, node: VariableNode): Element => toChip(node),
        },
      },
      // Resolution runs before syntax transforms, so a chip never reaches the
      // interpolator. Declared literal so any other order is still safe.
      variables: { literalNodeTypes: [VARIABLE_NODE] },
    },
  }
}

export function isVariableNode(node: MarkdownNode): node is VariableNode {
  return node.type === VARIABLE_NODE
}

function serialize(node: VariableValue): string {
  if (node.value.length > 0) return node.value
  const formatter =
    node.formatter === undefined
      ? ''
      : node.argument === undefined
        ? ` | ${node.formatter}`
        : ` | ${node.formatter}:"${node.argument}"`
  return `{{${node.path}${formatter}}}`
}

function scan(text: string): readonly VariableMatch[] {
  return scanPlaceholders(text)
    .filter((binding) => binding.problem === undefined)
    .map((binding) => ({
      start: binding.start,
      end: binding.end,
      node: {
        type: VARIABLE_NODE,
        value: binding.raw,
        path: binding.path,
        ...(binding.formatter === undefined ? {} : { formatter: binding.formatter }),
        ...(binding.argument === undefined ? {} : { argument: binding.argument }),
      },
    }))
}

/* -------------------------------------------------------------- renderer */

function toChip(node: VariableNode): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      dataRmkVariable: node.path,
      ...(node.formatter === undefined ? {} : { dataRmkVariableFormatter: node.formatter }),
    },
    children: [{ type: 'text', value: serialize(node) }],
  }
}

/* ---------------------------------------------------------------- syntax */

/**
 * Replaces `{{...}}` runs inside `text` nodes with `variable` nodes so
 * rich mode can show a chip. Code and inline code are left alone, matching the
 * resolution rules (spec 8.11), so what the editor shows as a variable is
 * exactly what the engine would resolve.
 */
function liftPlaceholders(tree: MarkdownRoot): MarkdownRoot {
  const skip = new Set(['code', 'inlineCode', 'html', 'yaml', 'toml', VARIABLE_NODE])

  const walk = (node: MarkdownNode): void => {
    if (skip.has(node.type)) return
    const children = node.children
    if (!Array.isArray(children)) return
    const next: MarkdownNode[] = []
    let changed = false
    for (const child of children) {
      if (child.type !== 'text' || typeof child.value !== 'string') {
        walk(child)
        next.push(child)
        continue
      }
      const split = splitTextNode(child.value)
      if (split === undefined) {
        next.push(child)
        continue
      }
      changed = true
      next.push(...split)
    }
    if (changed) node.children = next
  }

  walk(tree)
  return tree
}

function splitTextNode(value: string): MarkdownNode[] | undefined {
  const matches = scan(value)
  if (matches.length === 0) return undefined
  const out: MarkdownNode[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start > cursor) out.push({ type: 'text', value: value.slice(cursor, match.start) })
    out.push(match.node)
    cursor = match.end
  }
  if (cursor < value.length) out.push({ type: 'text', value: value.slice(cursor) })
  return out
}
