/**
 * Which node types are data rather than prose (spec 8.11).
 *
 * The template plugin never parses on its own: the renderer (or the editor,
 * through the renderer) parses with the application's preset and hands the
 * tree to the plugin's transform. What the engine still owns is the rule for
 * where placeholders are literal.
 */
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'

/** Node types whose `value` is data, not prose, and is never interpolated. */
const BASE_LITERAL_NODE_TYPES: readonly string[] = ['code', 'inlineCode', 'yaml', 'toml']

/** Raw HTML. Placeholders inside stay literal and earn a diagnostic. */
export const HTML_NODE_TYPES: ReadonlySet<string> = new Set(['html'])

/** The base rule plus every sibling extension's `template.literalNodeTypes`. */
export function literalNodeTypesOf(extensions: readonly MarkdownExtension[]): ReadonlySet<string> {
  const literal = new Set(BASE_LITERAL_NODE_TYPES)
  for (const extension of extensions) {
    for (const type of extension.capabilities?.template?.literalNodeTypes ?? []) literal.add(type)
  }
  return literal
}
