/**
 * The placeholders that survived parsing (spec 8.10).
 *
 * The source audit compares these with the `{{...}}` runs in the authored
 * source: a run the parser dissolved is missing here, and is reported.
 */

import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import { HTML_NODE_TYPES } from './parse.js'
import { mightContainPlaceholder, scanPlaceholders, type PlaceholderBinding } from './placeholder.js'

/** Every placeholder in prose, destinations, alt text, titles and raw HTML. */
export function collectPlaceholders(tree: MarkdownRoot, literalNodeTypes: ReadonlySet<string>): PlaceholderBinding[] {
  const found: PlaceholderBinding[] = []

  const scan = (value: unknown): void => {
    if (typeof value === 'string' && mightContainPlaceholder(value)) found.push(...scanPlaceholders(value))
  }

  const walk = (node: MarkdownNode): void => {
    if (literalNodeTypes.has(node.type)) return
    if (HTML_NODE_TYPES.has(node.type)) {
      scan(node.value)
      return
    }
    if (node.type === 'link' || node.type === 'definition' || node.type === 'image') scan(node.url)
    if (node.type === 'image' || node.type === 'imageReference') scan(node.alt)
    scan(node.title)

    if (node.type === 'text') {
      scan(node.value)
      return
    }
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child)
  }

  walk(tree)
  return found
}
