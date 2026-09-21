/**
 * The mdast node a break the author inserted exports as.
 *
 * CommonMark gives `---` and `***` the same `thematicBreak`, and the writer
 * identifies a `thematicBreak` by its type alone: the bytes are not part of
 * the canonical key, which is what lets an untouched break align with its
 * original and be written from the source. The flip side is that a fresh
 * break of one kind aligns just as well with an original of the other, and
 * an aligned block is written with the original's bytes: New slide before a
 * `***` rule wrote `***` twice, and inserting a break where a rule had just
 * been deleted wrote the file back unchanged. A break with no source bytes
 * is exported as this node instead. Its identity is its own spelling, so it
 * never aligns with anything and is always written as `---` or `***`.
 *
 * The node only exists between an insert and the next load, in
 * `getDocument()`. The `/editor` entry gives it a toMarkdown handler and
 * folds it back into `thematicBreak` before the deck root is rendered, so a
 * document read out of the editor still serializes and renders as a deck.
 */
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import { BREAK_DATA_KEY, type BreakKind } from '../deck/breaks.js'

export const SLIDE_BREAK_NODE = 'slideBreak'

export interface SlideBreakMdastNode extends MarkdownNode {
  readonly type: typeof SLIDE_BREAK_NODE
  readonly kind: BreakKind
}

const SPELLING: Readonly<Record<BreakKind, string>> = { slide: '---', rule: '***' }

/** What a fresh break of this kind writes. */
export function breakSpellingOf(kind: BreakKind): string {
  return SPELLING[kind]
}

export function isSlideBreakMdastNode(node: MarkdownNode): node is SlideBreakMdastNode {
  return node.type === SLIDE_BREAK_NODE
}

/** The export of a break with no bytes to write back. */
export function freshBreak(kind: BreakKind): SlideBreakMdastNode {
  return { type: SLIDE_BREAK_NODE, kind }
}

/** The export of an imported break: the `thematicBreak` the transform would produce for its kind. */
export function thematicBreak(kind: BreakKind): MarkdownNode {
  return kind === 'rule' ? { type: 'thematicBreak', data: { [BREAK_DATA_KEY]: { rule: true } } } : { type: 'thematicBreak' }
}

export function slideBreakToMarkdown(node: SlideBreakMdastNode): string {
  return breakSpellingOf(node.kind)
}

/** The tree with every fresh break folded back into the `thematicBreak` the deck reader splits on. */
export function restoreSlideBreaks(root: MarkdownRoot): MarkdownRoot {
  if (!root.children.some(isSlideBreakMdastNode)) return root
  return { ...root, children: root.children.map((node) => (isSlideBreakMdastNode(node) ? thematicBreak(node.kind) : node)) }
}
