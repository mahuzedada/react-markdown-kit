/**
 * Opaque nodes (spec 7.9, docs/AUDIT.md G3).
 *
 * Any mdast node the bridge has no editing mapping for — raw HTML, a link
 * definition, a footnote definition, front matter, math, a third-party
 * extension's node — becomes one of these. It keeps **both** the mdast subtree
 * and the exact source slice it came from, renders as a non-editable block
 * showing its source, and is written back byte-identically.
 *
 * This is what makes "no silent loss" true: the prior editor degraded anything
 * it did not understand into literal paragraph text, which then got re-escaped
 * on the next save. Here an unsupported construct is never prose, is never
 * re-serialized, and is untouched by an edit to the paragraph beside it.
 */
import { createElement, type ReactNode } from 'react'
import {
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { themeClass } from './theme.js'

export type SerializedOpaqueNode = Spread<
  { readonly mdast: MarkdownNode; readonly source: string },
  SerializedLexicalNode
>

abstract class BaseOpaqueNode extends DecoratorNode<ReactNode> {
  /** @internal */
  __mdast: MarkdownNode
  /** @internal */
  __source: string

  constructor(mdast: MarkdownNode, source: string, key?: NodeKey) {
    super(key)
    this.__mdast = mdast
    this.__source = source
  }

  getMdast(): MarkdownNode {
    return this.getLatest().__mdast
  }

  /** The bytes this node must write back. Never re-serialized from the tree. */
  getSource(): string {
    return this.getLatest().__source
  }

  override getTextContent(): string {
    return this.getSource()
  }

  override isIsolated(): boolean {
    return true
  }

  override updateDOM(): boolean {
    return false
  }
}

export class OpaqueBlockNode extends BaseOpaqueNode {
  static override getType(): string {
    return 'rmk-opaque-block'
  }

  static override clone(node: OpaqueBlockNode): OpaqueBlockNode {
    return new OpaqueBlockNode(node.__mdast, node.__source, node.__key)
  }

  static override importJSON(serialized: SerializedOpaqueNode): OpaqueBlockNode {
    return new OpaqueBlockNode(serialized.mdast, serialized.source)
  }

  override exportJSON(): SerializedOpaqueNode {
    return { type: OpaqueBlockNode.getType(), version: 1, mdast: this.__mdast, source: this.__source }
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div')
    const className = themeClass(config, 'opaque')
    if (className !== undefined) element.className = className
    element.setAttribute('data-rmk-opaque', this.__mdast.type)
    element.contentEditable = 'false'
    return element
  }

  override isInline(): boolean {
    return false
  }

  override decorate(_editor: LexicalEditor, config: EditorConfig): ReactNode {
    return createElement(
      'pre',
      {
        className: themeClass(config, 'opaqueSource'),
        'data-rmk-opaque-type': this.__mdast.type,
        'aria-label': `Preserved ${this.__mdast.type} source`,
      },
      this.__source,
    )
  }
}

export class OpaqueInlineNode extends BaseOpaqueNode {
  static override getType(): string {
    return 'rmk-opaque-inline'
  }

  static override clone(node: OpaqueInlineNode): OpaqueInlineNode {
    return new OpaqueInlineNode(node.__mdast, node.__source, node.__key)
  }

  static override importJSON(serialized: SerializedOpaqueNode): OpaqueInlineNode {
    return new OpaqueInlineNode(serialized.mdast, serialized.source)
  }

  override exportJSON(): SerializedOpaqueNode {
    return { type: OpaqueInlineNode.getType(), version: 1, mdast: this.__mdast, source: this.__source }
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('span')
    const className = themeClass(config, 'inlineOpaque')
    if (className !== undefined) element.className = className
    element.setAttribute('data-rmk-opaque', this.__mdast.type)
    element.contentEditable = 'false'
    return element
  }

  override isInline(): boolean {
    return true
  }

  override decorate(_editor: LexicalEditor, config: EditorConfig): ReactNode {
    return createElement('code', { className: themeClass(config, 'inlineOpaque') }, this.__source)
  }
}

export function $createOpaqueBlockNode(mdast: MarkdownNode, source: string): OpaqueBlockNode {
  return new OpaqueBlockNode(mdast, source)
}

export function $createOpaqueInlineNode(mdast: MarkdownNode, source: string): OpaqueInlineNode {
  return new OpaqueInlineNode(mdast, source)
}

export function $isOpaqueBlockNode(node: LexicalNode | null | undefined): node is OpaqueBlockNode {
  return node instanceof OpaqueBlockNode
}

export function $isOpaqueInlineNode(node: LexicalNode | null | undefined): node is OpaqueInlineNode {
  return node instanceof OpaqueInlineNode
}
