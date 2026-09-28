/**
 * Blocks still being written. A deck that streams in (from a model, a
 * socket) is re-rendered at every prefix, and a prefix can end inside the
 * front matter: `---` and some `key: value` lines with no closing fence
 * yet. Those blocks are marked pending by the transform so the renderer
 * leaves them out instead of flashing them as a slide of text. The mark is
 * `data`, which the serializer and the editor ignore.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { BREAK_DATA_KEY } from './breaks.js'

export function markPending(node: MarkdownNode): MarkdownNode {
  const data = typeof node['data'] === 'object' && node['data'] !== null ? (node['data'] as Record<string, unknown>) : {}
  const own = typeof data[BREAK_DATA_KEY] === 'object' && data[BREAK_DATA_KEY] !== null ? (data[BREAK_DATA_KEY] as Record<string, unknown>) : {}
  return { ...node, data: { ...data, [BREAK_DATA_KEY]: { ...own, pending: true } } }
}

export function isPending(node: MarkdownNode): boolean {
  const data = node['data']
  if (typeof data !== 'object' || data === null) return false
  const own = (data as Record<string, unknown>)[BREAK_DATA_KEY]
  return typeof own === 'object' && own !== null && (own as { pending?: unknown }).pending === true
}
