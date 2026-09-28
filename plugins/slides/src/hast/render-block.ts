/**
 * One mdast block through the renderer's own handlers, so headings, lists,
 * code and every other extension's nodes render exactly as they would
 * outside a deck. `state.one` returns a node, a list or nothing; a `raw`
 * node is fine here, the policy handles it.
 *
 * While a deck streams in, its last block can be a comment that is not
 * closed yet (`<!-- class: cen`): CommonMark reads it as an html block to
 * the end of the input, which would flash as escaped text until the `-->`
 * arrives. That one block renders as nothing, and so does front matter the
 * transform marked pending (`deck/pending.ts`).
 */
import type { ElementContent } from 'hast'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import { isPending } from '../deck/pending.js'

/** The slice of mdast-util-to-hast's state the deck handler uses. */
export interface HastState {
  one(node: MarkdownNode, parent: MarkdownNode | undefined): unknown
}

export type RenderBlock = (block: MarkdownNode) => ElementContent[]

export function blockRenderer(state: HastState, root: MarkdownRoot): RenderBlock {
  const last = root.children[root.children.length - 1]
  return (block) => {
    if (isPending(block) || (block === last && isOpenComment(block))) return []
    const result = state.one(block, root)
    if (result === undefined || result === null) return []
    return (Array.isArray(result) ? result : [result]) as ElementContent[]
  }
}

function isOpenComment(node: MarkdownNode): boolean {
  return node.type === 'html' && typeof node.value === 'string' && node.value.trimStart().startsWith('<!--') && !node.value.includes('-->')
}
