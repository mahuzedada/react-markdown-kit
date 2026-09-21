/**
 * Inline and leaf nodes.
 *
 * Emphasis, strong, strikethrough and inline code are **not** nodes: they are
 * Lexical text formats, reassembled into nested mdast on the way out. What does
 * need a node is anything with data of its own — a link target, an image, and
 * the reference forms the prior editor never parsed at all (audit G1, G2).
 */
import { createElement, type ReactNode } from 'react'
import {
  $applyNodeReplacement,
  DecoratorNode,
  ElementNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type RangeSelection,
  type SerializedElementNode,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { ReferenceType } from '../mdast/atoms.js'
import { themeClass } from './theme.js'

const VERSION = 1

/* --------------------------------------------------------------------- link */

export type SerializedLinkNode = Spread<{ url: string; title: string | null }, SerializedElementNode>

export class LinkNode extends ElementNode {
  /** @internal */ __url: string
  /** @internal */ __title: string | null

  constructor(url: string, title: string | null, key?: NodeKey) {
    super(key)
    this.__url = url
    this.__title = title
  }

  static override getType(): string {
    return 'rmk-link'
  }

  static override clone(node: LinkNode): LinkNode {
    return new LinkNode(node.__url, node.__title, node.__key)
  }

  static override importJSON(serialized: SerializedLinkNode): LinkNode {
    return new LinkNode(serialized.url, serialized.title)
  }

  override exportJSON(): SerializedLinkNode {
    return {
      ...super.exportJSON(),
      type: LinkNode.getType(),
      version: VERSION,
      url: this.__url,
      title: this.__title,
    }
  }

  getURL(): string {
    return this.getLatest().__url
  }

  getTitle(): string | null {
    return this.getLatest().__title
  }

  setURL(url: string): this {
    const self = this.getWritable()
    self.__url = url
    return self
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('a')
    element.setAttribute('href', this.__url)
    if (this.__title !== null) element.setAttribute('title', this.__title)
    return element
  }

  override updateDOM(previous: LinkNode): boolean {
    return previous.__url !== this.__url || previous.__title !== this.__title
  }

  override isInline(): boolean {
    return true
  }

  override canInsertTextBefore(): boolean {
    return false
  }

  override canInsertTextAfter(): boolean {
    return false
  }

  override insertNewAfter(_selection?: RangeSelection): null {
    return null
  }
}

export const $createLinkNode = (url: string, title: string | null = null): LinkNode =>
  $applyNodeReplacement(new LinkNode(url, title))
export const $isLinkNode = (node: LexicalNode | null | undefined): node is LinkNode =>
  node instanceof LinkNode

/* ----------------------------------------------------------- link reference */

export type SerializedLinkReferenceNode = Spread<
  { identifier: string; label: string | null; referenceType: ReferenceType },
  SerializedElementNode
>

export class LinkReferenceNode extends ElementNode {
  /** @internal */ __identifier: string
  /** @internal */ __label: string | null
  /** @internal */ __referenceType: ReferenceType

  constructor(identifier: string, label: string | null, referenceType: ReferenceType, key?: NodeKey) {
    super(key)
    this.__identifier = identifier
    this.__label = label
    this.__referenceType = referenceType
  }

  static override getType(): string {
    return 'rmk-link-reference'
  }

  static override clone(node: LinkReferenceNode): LinkReferenceNode {
    return new LinkReferenceNode(node.__identifier, node.__label, node.__referenceType, node.__key)
  }

  static override importJSON(serialized: SerializedLinkReferenceNode): LinkReferenceNode {
    return new LinkReferenceNode(serialized.identifier, serialized.label, serialized.referenceType)
  }

  override exportJSON(): SerializedLinkReferenceNode {
    return {
      ...super.exportJSON(),
      type: LinkReferenceNode.getType(),
      version: VERSION,
      identifier: this.__identifier,
      label: this.__label,
      referenceType: this.__referenceType,
    }
  }

  getIdentifier(): string {
    return this.getLatest().__identifier
  }

  getLabel(): string | null {
    return this.getLatest().__label
  }

  getReferenceType(): ReferenceType {
    return this.getLatest().__referenceType
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('a')
    element.setAttribute('data-rmk-reference', this.__identifier)
    return element
  }

  override updateDOM(previous: LinkReferenceNode): boolean {
    return previous.__identifier !== this.__identifier
  }

  override isInline(): boolean {
    return true
  }
}

export const $createLinkReferenceNode = (
  identifier: string,
  label: string | null,
  referenceType: ReferenceType,
): LinkReferenceNode => new LinkReferenceNode(identifier, label, referenceType)
export const $isLinkReferenceNode = (node: LexicalNode | null | undefined): node is LinkReferenceNode =>
  node instanceof LinkReferenceNode

/* -------------------------------------------------------------------- image */

export type SerializedImageNode = Spread<
  { url: string; alt: string | null; title: string | null },
  SerializedLexicalNode
>

export class ImageNode extends DecoratorNode<ReactNode> {
  /** @internal */ __url: string
  /** @internal */ __alt: string | null
  /** @internal */ __title: string | null

  constructor(url: string, alt: string | null, title: string | null, key?: NodeKey) {
    super(key)
    this.__url = url
    this.__alt = alt
    this.__title = title
  }

  static override getType(): string {
    return 'rmk-image'
  }

  static override clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__url, node.__alt, node.__title, node.__key)
  }

  static override importJSON(serialized: SerializedImageNode): ImageNode {
    return new ImageNode(serialized.url, serialized.alt, serialized.title)
  }

  override exportJSON(): SerializedImageNode {
    return {
      type: ImageNode.getType(),
      version: VERSION,
      url: this.__url,
      alt: this.__alt,
      title: this.__title,
    }
  }

  getURL(): string {
    return this.getLatest().__url
  }

  getAlt(): string | null {
    return this.getLatest().__alt
  }

  getTitle(): string | null {
    return this.getLatest().__title
  }

  override getTextContent(): string {
    return this.__alt ?? ''
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('span')
    element.setAttribute('data-rmk-image', '')
    return element
  }

  override updateDOM(): boolean {
    return false
  }

  override isInline(): boolean {
    return true
  }

  override decorate(_editor: LexicalEditor, config: EditorConfig): ReactNode {
    return createElement('img', {
      className: themeClass(config, 'image'),
      src: this.__url,
      alt: this.__alt ?? '',
      ...(this.__title === null ? {} : { title: this.__title }),
    })
  }
}

export const $createImageNode = (
  url: string,
  alt: string | null = null,
  title: string | null = null,
): ImageNode => new ImageNode(url, alt, title)
export const $isImageNode = (node: LexicalNode | null | undefined): node is ImageNode =>
  node instanceof ImageNode

/* ---------------------------------------------------------- image reference */

export type SerializedImageReferenceNode = Spread<
  { identifier: string; label: string | null; referenceType: ReferenceType; alt: string | null },
  SerializedLexicalNode
>

export class ImageReferenceNode extends DecoratorNode<ReactNode> {
  /** @internal */ __identifier: string
  /** @internal */ __label: string | null
  /** @internal */ __referenceType: ReferenceType
  /** @internal */ __alt: string | null

  constructor(
    identifier: string,
    label: string | null,
    referenceType: ReferenceType,
    alt: string | null,
    key?: NodeKey,
  ) {
    super(key)
    this.__identifier = identifier
    this.__label = label
    this.__referenceType = referenceType
    this.__alt = alt
  }

  static override getType(): string {
    return 'rmk-image-reference'
  }

  static override clone(node: ImageReferenceNode): ImageReferenceNode {
    return new ImageReferenceNode(
      node.__identifier,
      node.__label,
      node.__referenceType,
      node.__alt,
      node.__key,
    )
  }

  static override importJSON(serialized: SerializedImageReferenceNode): ImageReferenceNode {
    return new ImageReferenceNode(
      serialized.identifier,
      serialized.label,
      serialized.referenceType,
      serialized.alt,
    )
  }

  override exportJSON(): SerializedImageReferenceNode {
    return {
      type: ImageReferenceNode.getType(),
      version: VERSION,
      identifier: this.__identifier,
      label: this.__label,
      referenceType: this.__referenceType,
      alt: this.__alt,
    }
  }

  getIdentifier(): string {
    return this.getLatest().__identifier
  }

  getLabel(): string | null {
    return this.getLatest().__label
  }

  getReferenceType(): ReferenceType {
    return this.getLatest().__referenceType
  }

  getAlt(): string | null {
    return this.getLatest().__alt
  }

  override getTextContent(): string {
    return this.__alt ?? ''
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('span')
    element.setAttribute('data-rmk-image-reference', this.__identifier)
    return element
  }

  override updateDOM(): boolean {
    return false
  }

  override isInline(): boolean {
    return true
  }

  override decorate(_editor: LexicalEditor, config: EditorConfig): ReactNode {
    return createElement('img', {
      className: themeClass(config, 'image'),
      'data-rmk-reference': this.__identifier,
      alt: this.__alt ?? '',
    })
  }
}

export const $createImageReferenceNode = (
  identifier: string,
  label: string | null,
  referenceType: ReferenceType,
  alt: string | null,
): ImageReferenceNode => new ImageReferenceNode(identifier, label, referenceType, alt)
export const $isImageReferenceNode = (
  node: LexicalNode | null | undefined,
): node is ImageReferenceNode => node instanceof ImageReferenceNode

/* ---------------------------------------------------------- thematic break */

export class ThematicBreakNode extends DecoratorNode<ReactNode> {
  static override getType(): string {
    return 'rmk-thematic-break'
  }

  static override clone(node: ThematicBreakNode): ThematicBreakNode {
    return new ThematicBreakNode(node.__key)
  }

  static override importJSON(): ThematicBreakNode {
    return new ThematicBreakNode()
  }

  override exportJSON(): SerializedLexicalNode {
    return { type: ThematicBreakNode.getType(), version: VERSION }
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('div')
    element.setAttribute('data-rmk-thematic-break', '')
    element.contentEditable = 'false'
    return element
  }

  override updateDOM(): boolean {
    return false
  }

  override isInline(): boolean {
    return false
  }

  override decorate(): ReactNode {
    return createElement('hr')
  }
}

export const $createThematicBreakNode = (): ThematicBreakNode => new ThematicBreakNode()
export const $isThematicBreakNode = (node: LexicalNode | null | undefined): node is ThematicBreakNode =>
  node instanceof ThematicBreakNode
