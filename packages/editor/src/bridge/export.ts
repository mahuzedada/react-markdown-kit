/**
 * Lexical -> mdast.
 *
 * The inverse of `import.ts`, and deliberately total: every Lexical node the
 * bridge can produce has a case here, and anything else falls back to its text
 * content rather than disappearing.
 */
import {
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isTabNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type TextNode,
} from 'lexical'
import { $getRoot } from 'lexical'
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import {
  atomsToMdast,
  mergeTextAtoms,
  type InlineAtom,
  type InlineMark,
} from '../mdast/atoms.js'
import type { OutgoingBlock } from '../mdast/compose.js'
import {
  $isBlockquoteNode,
  $isCodeBlockNode,
  $isHeadingNode,
  $isListItemNode,
  $isListNode,
} from '../nodes/blocks.js'
import {
  $isImageNode,
  $isImageReferenceNode,
  $isLinkNode,
  $isLinkReferenceNode,
  $isThematicBreakNode,
} from '../nodes/inline.js'
import { $isTableCellNode, $isTableNode, $isTableRowNode } from '../nodes/table.js'
import { $isOpaqueBlockNode, $isOpaqueInlineNode } from '../nodes/opaque.js'
import { NO_ADAPTERS, blockAdapterFor, inlineAdapterFor, type NodeAdapters } from './adapters.js'

export interface ReadBlocksResult {
  readonly blocks: readonly Omit<OutgoingBlock, 'key'>[]
  /** Verbatim source for opaque nodes, keyed by the mdast object they hold. */
  readonly rawByNode: WeakMap<MarkdownNode, string>
}

/** Must run inside `editor.read` or `editor.update`. */
export function $readBlocks(adapters: NodeAdapters = NO_ADAPTERS): ReadBlocksResult {
  const rawByNode = new WeakMap<MarkdownNode, string>()
  const blocks: Omit<OutgoingBlock, 'key'>[] = []
  for (const child of $getRoot().getChildren()) {
    const block = blockToMdast(child, rawByNode, adapters)
    if (block !== null) blocks.push(block)
  }
  return { blocks, rawByNode }
}

function blockToMdast(
  node: LexicalNode,
  rawByNode: WeakMap<MarkdownNode, string>,
  adapters: NodeAdapters,
): Omit<OutgoingBlock, 'key'> | null {
  if ($isOpaqueBlockNode(node)) {
    const mdast = node.getMdast()
    const source = node.getSource()
    rawByNode.set(mdast, source)
    return { node: mdast, raw: source }
  }
  const adapter = blockAdapterFor(node, adapters.blocks)
  if (adapter !== undefined) {
    const out = adapter.$export(node)
    if (out.raw !== null) rawByNode.set(out.node, out.raw)
    return { node: out.node, raw: out.raw }
  }
  const mdast = blockNodeToMdast(node, rawByNode, adapters)
  return mdast === null ? null : { node: mdast, raw: null }
}

function blockNodeToMdast(
  node: LexicalNode,
  rawByNode: WeakMap<MarkdownNode, string>,
  adapters: NodeAdapters,
): MarkdownNode | null {
  const adapter = blockAdapterFor(node, adapters.blocks)
  if (adapter !== undefined) {
    const out = adapter.$export(node)
    if (out.raw !== null) rawByNode.set(out.node, out.raw)
    return out.node
  }
  if ($isOpaqueBlockNode(node)) {
    const mdast = node.getMdast()
    rawByNode.set(mdast, node.getSource())
    return mdast
  }
  if ($isThematicBreakNode(node)) return { type: 'thematicBreak' }
  if ($isHeadingNode(node)) {
    return {
      type: 'heading',
      depth: node.getDepth(),
      children: atomsToMdast(inlineAtomsOf(node, rawByNode, adapters)),
    }
  }
  if ($isCodeBlockNode(node)) {
    const lang = node.getLang()
    const meta = node.getMeta()
    return {
      type: 'code',
      ...(lang === null ? {} : { lang }),
      ...(meta === null ? {} : { meta }),
      value: node.getTextContent(),
    }
  }
  if ($isBlockquoteNode(node)) {
    return { type: 'blockquote', children: childBlocks(node, rawByNode, adapters) }
  }
  if ($isListNode(node)) {
    return {
      type: 'list',
      ordered: node.isOrdered(),
      ...(node.isOrdered() ? { start: node.getStart() } : {}),
      spread: node.isSpread(),
      children: childBlocks(node, rawByNode, adapters),
    }
  }
  if ($isListItemNode(node)) {
    const checked = node.getChecked()
    return {
      type: 'listItem',
      ...(checked === null ? {} : { checked }),
      spread: node.isSpread(),
      children: childBlocks(node, rawByNode, adapters),
    }
  }
  if ($isTableNode(node)) {
    return {
      type: 'table',
      align: node.getAlign(),
      children: node.getChildren().flatMap((row) => {
        const mdast = blockNodeToMdast(row, rawByNode, adapters)
        return mdast === null ? [] : [mdast]
      }),
    }
  }
  if ($isTableRowNode(node)) {
    return {
      type: 'tableRow',
      children: node.getChildren().flatMap((cell) => {
        const mdast = blockNodeToMdast(cell, rawByNode, adapters)
        return mdast === null ? [] : [mdast]
      }),
    }
  }
  if ($isTableCellNode(node)) {
    return { type: 'tableCell', children: atomsToMdast(inlineAtomsOf(node, rawByNode, adapters)) }
  }
  if ($isParagraphNode(node) || $isElementNode(node)) {
    const children = atomsToMdast(inlineAtomsOf(node as ElementNode, rawByNode, adapters))
    // An empty paragraph has no Markdown spelling; Lexical keeps one around as
    // the caret's home, so dropping it is what keeps an empty document empty.
    if (children.length === 0) return null
    return { type: 'paragraph', children }
  }
  const text = node.getTextContent()
  return text === '' ? null : { type: 'paragraph', children: [{ type: 'text', value: text }] }
}

function childBlocks(
  node: ElementNode,
  rawByNode: WeakMap<MarkdownNode, string>,
  adapters: NodeAdapters,
): MarkdownNode[] {
  const out: MarkdownNode[] = []
  for (const child of node.getChildren()) {
    const mdast = blockNodeToMdast(child, rawByNode, adapters)
    if (mdast !== null) out.push(mdast)
  }
  return out
}

function inlineAtomsOf(
  node: ElementNode,
  rawByNode: WeakMap<MarkdownNode, string>,
  adapters: NodeAdapters,
): InlineAtom[] {
  return mergeTextAtoms(collectAtoms(node.getChildren(), rawByNode, adapters))
}

function collectAtoms(
  nodes: readonly LexicalNode[],
  rawByNode: WeakMap<MarkdownNode, string>,
  adapters: NodeAdapters,
): InlineAtom[] {
  const out: InlineAtom[] = []
  for (const node of nodes) {
    const inline = inlineAdapterFor(node, adapters.inlines)
    if (inline !== undefined) {
      // The adapter's spelling is the atom's identity, so an untouched
      // paragraph still compares equal and is written back from its bytes.
      const out_ = inline.$export(node)
      rawByNode.set(out_.node, out_.raw)
      out.push({ kind: 'opaque', nodeType: out_.node.type, source: out_.raw, mdast: out_.node })
      continue
    }
    if ($isOpaqueInlineNode(node)) {
      const mdast = node.getMdast()
      const source = node.getSource()
      rawByNode.set(mdast, source)
      out.push({ kind: 'opaque', nodeType: mdast.type, source, mdast })
      continue
    }
    if ($isLineBreakNode(node)) {
      out.push({ kind: 'break', marks: [] })
      continue
    }
    if ($isTabNode(node)) {
      out.push({ kind: 'text', value: '\t', marks: [] })
      continue
    }
    if ($isTextNode(node)) {
      out.push({ kind: 'text', value: node.getTextContent(), marks: marksOfText(node) })
      continue
    }
    if ($isImageNode(node)) {
      out.push({ kind: 'image', url: node.getURL(), alt: node.getAlt(), title: node.getTitle() })
      continue
    }
    if ($isImageReferenceNode(node)) {
      out.push({
        kind: 'imageReference',
        identifier: node.getIdentifier(),
        label: node.getLabel(),
        referenceType: node.getReferenceType(),
        alt: node.getAlt(),
      })
      continue
    }
    if ($isLinkNode(node)) {
      out.push({
        kind: 'link',
        url: node.getURL(),
        title: node.getTitle(),
        children: mergeTextAtoms(collectAtoms(node.getChildren(), rawByNode, adapters)),
      })
      continue
    }
    if ($isLinkReferenceNode(node)) {
      out.push({
        kind: 'linkReference',
        identifier: node.getIdentifier(),
        label: node.getLabel(),
        referenceType: node.getReferenceType(),
        children: mergeTextAtoms(collectAtoms(node.getChildren(), rawByNode, adapters)),
      })
      continue
    }
    if ($isElementNode(node)) {
      out.push(...collectAtoms(node.getChildren(), rawByNode, adapters))
      continue
    }
    const text = node.getTextContent()
    if (text !== '') out.push({ kind: 'text', value: text, marks: [] })
  }
  return out
}

function marksOfText(node: TextNode): InlineMark[] {
  const marks: InlineMark[] = []
  if (node.hasFormat('strikethrough')) marks.push('delete')
  if (node.hasFormat('bold')) marks.push('strong')
  if (node.hasFormat('italic')) marks.push('emphasis')
  if (node.hasFormat('code')) marks.push('code')
  return marks
}
