/**
 * Enter and Backspace inside a list or a blockquote.
 *
 * Both hold paragraphs (mdast's shape), so Lexical's default Enter would only
 * ever add a paragraph inside them. In a list, Enter starts the next item and
 * Enter on an empty item leaves the list; Backspace at the start of an item
 * drops its checkbox first, then lifts it out, the way `- ` went in. In a
 * blockquote, Enter on an empty last line leaves the quote and Backspace at
 * the start of its first line lifts that line out.
 */
import {
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type ParagraphNode,
} from 'lexical'
import { mergeRegister } from '@lexical/utils'
import {
  $createListItemNode,
  $createListNode,
  $isBlockquoteNode,
  $isListItemNode,
  $isListNode,
  type ListItemNode,
  type ListNode,
} from '../nodes/blocks.js'

export function registerBlockKeys(editor: LexicalEditor): () => void {
  return mergeRegister(
    editor.registerCommand(INSERT_PARAGRAPH_COMMAND, $enter, COMMAND_PRIORITY_LOW),
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        if (!$backspace()) return false
        event?.preventDefault()
        return true
      },
      COMMAND_PRIORITY_LOW,
    ),
  )
}

function $enter(): boolean {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false
  const paragraph = $caretParagraph()
  const item = paragraph?.getParent()
  if (paragraph == null) return false
  if ($isBlockquoteNode(item)) {
    if (!selection.isCollapsed() || paragraph.getTextContent() !== '' || !paragraph.is(item.getLastChild())) return false
    item.insertAfter(paragraph)
    paragraph.select()
    return true
  }
  if (!$isListItemNode(item)) return false

  if (item.getChildrenSize() === 1 && paragraph.getTextContent() === '' && selection.isCollapsed()) {
    $liftItem(item)
    paragraph.select()
    return true
  }

  // Enter has happened once insertParagraph runs; returning false would let
  // the default handler insert a second paragraph.
  const created = selection.insertParagraph()
  if (created === null || !item.is(created.getParent())) return true
  const moved = [created, ...created.getNextSiblings()]
  const next = $createListItemNode(item.getChecked() === null ? null : false, item.isSpread())
  next.append(...moved)
  item.insertAfter(next)
  created.selectStart()
  return true
}

function $backspace(): boolean {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed() || selection.anchor.offset !== 0) return false
  const paragraph = $caretParagraph()
  const item = paragraph?.getParent()
  if (paragraph == null || !paragraph.is(item?.getFirstChild())) return false
  const first = paragraph.getFirstDescendant()
  const anchor = selection.anchor.getNode()
  if (!anchor.is(paragraph) && !anchor.is(first)) return false

  if ($isBlockquoteNode(item)) {
    item.insertBefore(paragraph)
    if (item.getChildrenSize() === 0) item.remove()
    paragraph.selectStart()
    return true
  }
  if (!$isListItemNode(item)) return false

  if (item.getChecked() !== null) {
    item.setChecked(null)
    return true
  }
  $liftItem(item)
  paragraph.selectStart()
  return true
}

function $caretParagraph(): ParagraphNode | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return null
  let node: LexicalNode | null = selection.anchor.getNode()
  while (node !== null && !$isParagraphNode(node)) node = node.getParent()
  return node
}

/**
 * Moves an item out of its list. The items after it stay a list of their own
 * (numbering carries on). A nested item becomes an item of the parent list; a
 * top-level one becomes plain blocks.
 */
function $liftItem(item: ListItemNode): void {
  const list = item.getParent()
  if (!$isListNode(list)) return
  const rest = item.getNextSiblings()
  const index = item.getIndexWithinParent()
  const tail = rest.length === 0 ? null : $listLike(list, list.getStart() + index + 1).append(...rest)
  const owner = list.getParent()

  if ($isListItemNode(owner)) {
    if (tail !== null) item.append(tail)
    owner.insertAfter(item)
  } else {
    let last: LexicalNode = list
    for (const child of item.getChildren()) {
      last.insertAfter(child)
      last = child
    }
    if (tail !== null) last.insertAfter(tail)
    item.remove()
  }
  if (list.getChildrenSize() === 0) list.remove()
}

function $listLike(list: ListNode, start: number): ListNode {
  return $createListNode(list.isOrdered(), list.isOrdered() ? start : 1, list.isSpread())
}
