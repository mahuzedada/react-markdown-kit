/** A heading's plain text: its `text` and `inlineCode` descendants, nothing else. */
import type { MarkdownNode } from '@internal/document-contracts/index.js'

export function headingText(node: MarkdownNode): string {
  let text = ''
  const walk = (current: MarkdownNode): void => {
    if ((current.type === 'text' || current.type === 'inlineCode') && typeof current.value === 'string') text += current.value
    for (const child of current.children ?? []) walk(child)
  }
  walk(node)
  return text.trim()
}

export function isHeading(node: MarkdownNode): boolean {
  return node.type === 'heading'
}
