/**
 * Block shortcuts that fire on a space typed at the start of a top-level
 * block: `# `, `> `, `- `, `1. `, `[ ] `, ```` ``` ```` and `---`.
 *
 * Each builds the kit's own node, the same node the matching toolbar command
 * or an import produces, so a typed list and a loaded one save the same
 * Markdown. `children` is what followed the marker on the line.
 */
import { $createParagraphNode, $createTextNode, $isParagraphNode, type ElementNode, type LexicalNode } from 'lexical'
import {
  $createBlockquoteNode,
  $createCodeBlockNode,
  $createHeadingNode,
  $createListItemNode,
  $createListNode,
  $isHeadingNode,
  $isListNode,
} from '../nodes/blocks.js'
import { $createThematicBreakNode } from '../nodes/inline.js'

export interface BlockShortcut {
  /** Matches the line up to and including the typed space. */
  readonly pattern: RegExp
  readonly gfm?: boolean
  /** False when the block cannot take this shortcut; the text is left alone. */
  $apply(block: ElementNode, children: LexicalNode[], match: RegExpExecArray): boolean
}

const HEADING: BlockShortcut = {
  pattern: /^(#{1,6}) $/,
  $apply(block, children, match) {
    if (!$isParagraphNode(block) && !$isHeadingNode(block)) return false
    const heading = $createHeadingNode(match[1]?.length ?? 1).append(...children)
    block.replace(heading)
    heading.select(0, 0)
    return true
  },
}

const BLOCKQUOTE: BlockShortcut = {
  pattern: /^> $/,
  $apply(block, children) {
    if (!$isParagraphNode(block)) return false
    const paragraph = $createParagraphNode().append(...children)
    block.replace($createBlockquoteNode().append(paragraph))
    paragraph.select(0, 0)
    return true
  },
}

/**
 * Wraps the line in a list item. A list of the same kind directly above takes
 * the item instead, since two adjacent lists of one kind read back as one.
 */
function $toListItem(
  block: ElementNode,
  children: LexicalNode[],
  list: { ordered: boolean; start: number; checked: boolean | null },
): boolean {
  if (!$isParagraphNode(block)) return false
  const paragraph = $createParagraphNode().append(...children)
  const item = $createListItemNode(list.checked, false).append(paragraph)
  const previous = block.getPreviousSibling()
  if ($isListNode(previous) && previous.isOrdered() === list.ordered) {
    previous.append(item)
    block.remove()
  } else {
    block.replace($createListNode(list.ordered, list.start, false).append(item))
  }
  paragraph.select(0, 0)
  return true
}

const TASK_LIST: BlockShortcut = {
  pattern: /^\[([ xX])?\] $/,
  gfm: true,
  $apply: (block, children, match) =>
    $toListItem(block, children, { ordered: false, start: 1, checked: match[1]?.toLowerCase() === 'x' }),
}

const BULLET_LIST: BlockShortcut = {
  pattern: /^[-*+] $/,
  $apply: (block, children) => $toListItem(block, children, { ordered: false, start: 1, checked: null }),
}

const ORDERED_LIST: BlockShortcut = {
  pattern: /^(\d{1,9})[.)] $/,
  $apply: (block, children, match) =>
    $toListItem(block, children, { ordered: true, start: Number(match[1]), checked: null }),
}

export const THEMATIC_BREAK_LINE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/

const THEMATIC_BREAK: BlockShortcut = {
  pattern: /^(?:-{3,}|\*{3,}|_{3,}) $/,
  $apply(block, children) {
    if (!$isParagraphNode(block)) return false
    const next = $createParagraphNode().append(...children)
    block.replace($createThematicBreakNode()).insertAfter(next)
    next.select(0, 0)
    return true
  },
}

export const CODE_FENCE_LINE = /^```([\w+#.-]+)?\s*$/

const CODE_FENCE: BlockShortcut = {
  pattern: /^```([\w+#.-]+)? $/,
  $apply(block, children, match) {
    if (!$isParagraphNode(block)) return false
    const code = $createCodeBlockNode(match[1] ?? null, null)
    const text = children.map((child) => child.getTextContent()).join('')
    if (text !== '') code.append($createTextNode(text))
    block.replace(code)
    code.select(0, 0)
    return true
  },
}

/** A rule before the bullet list, so `*** ` is a rule and not a list item. */
export const BLOCK_SHORTCUTS: readonly BlockShortcut[] = [
  THEMATIC_BREAK,
  CODE_FENCE,
  HEADING,
  BLOCKQUOTE,
  TASK_LIST,
  BULLET_LIST,
  ORDERED_LIST,
]
