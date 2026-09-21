/**
 * The node registry handed to Lexical. One node type per mdast node type, plus
 * the two opaque nodes that catch everything else.
 */
import type { Klass, LexicalNode } from 'lexical'
import {
  BlockquoteNode,
  CodeBlockNode,
  HeadingNode,
  ListItemNode,
  ListNode,
} from './blocks.js'
import {
  ImageNode,
  ImageReferenceNode,
  LinkNode,
  LinkReferenceNode,
  ThematicBreakNode,
} from './inline.js'
import { TableCellNode, TableNode, TableRowNode } from './table.js'
import { OpaqueBlockNode, OpaqueInlineNode } from './opaque.js'

export const MARKDOWN_NODES: readonly Klass<LexicalNode>[] = [
  HeadingNode,
  BlockquoteNode,
  ListNode,
  ListItemNode,
  CodeBlockNode,
  ThematicBreakNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  LinkNode,
  LinkReferenceNode,
  ImageNode,
  ImageReferenceNode,
  OpaqueBlockNode,
  OpaqueInlineNode,
]

export * from './blocks.js'
export * from './inline.js'
export * from './table.js'
export * from './opaque.js'
export { buildNodeTheme } from './theme.js'
