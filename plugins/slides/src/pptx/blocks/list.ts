/** Bulleted and numbered lists, nested lists one indent level deeper. Each item's first paragraph carries the bullet. */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { asParagraph, inlineRuns } from '../inline-runs.js'
import type { BlockWriter, ContentItem } from './content-item.js'

export const writeList: BlockWriter = (node, context, depth) => {
  const bullet = node['ordered'] === true ? ({ type: 'number' } as const) : true
  return (node.children ?? []).flatMap((item) => writeItem(item, bullet, context, depth))
}

function writeItem(item: MarkdownNode, bullet: true | { readonly type: 'number' }, context: Parameters<BlockWriter>[1], depth: number): ContentItem[] {
  return (item.children ?? []).flatMap((child, index): ContentItem[] => {
    if (child.type === 'paragraph') {
      const options = { indentLevel: depth, paraSpaceAfter: 4, ...(index === 0 ? { bullet } : {}) }
      return [{ kind: 'text', runs: asParagraph(inlineRuns(child.children, context), options) }]
    }
    return context.write(child, depth + 1)
  })
}
