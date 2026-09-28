/**
 * `[ ] ` or `[x] ` typed at the start of a list item makes it a task item.
 *
 * `- ` has already turned the line into a list by then, so the marker lands
 * in the first paragraph of an item, not in a top-level block.
 */
import { $isParagraphNode, type TextNode } from 'lexical'
import { $isListItemNode } from '../nodes/blocks.js'

const TASK_MARKER = /^\[([ xX])?\] $/

export function $taskItemShortcut(text: TextNode, offset: number): boolean {
  if (text.getPreviousSibling() !== null) return false
  const paragraph = text.getParent()
  const item = paragraph?.getParent()
  if (!$isParagraphNode(paragraph) || !$isListItemNode(item) || !paragraph.is(item.getFirstChild())) return false
  if (item.getChecked() !== null) return false
  const match = TASK_MARKER.exec(text.getTextContent().slice(0, offset))
  if (match === null) return false
  item.setChecked(match[1]?.toLowerCase() === 'x')
  const [marker, rest] = text.splitText(offset)
  marker?.remove()
  if (rest === undefined) paragraph.select(0, 0)
  else rest.select(0, 0)
  return true
}
