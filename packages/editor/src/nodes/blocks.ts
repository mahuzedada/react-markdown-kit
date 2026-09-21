/**
 * Block nodes — one Lexical node type per mdast block type.
 *
 * Deliberately not `@lexical/rich-text` + `@lexical/list`: those model a
 * blockquote as an inline container and a list without `spread`, and the fields
 * they drop (`spread`, `start`, fence `meta`, cell alignment) are exactly the
 * ones docs/AUDIT.md records as lost on save (G6, G11). Every field mdast
 * carries lives on a typed field here, never in a `style` attribute.
 */
import {
  $createParagraphNode,
  ElementNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type RangeSelection,
  type SerializedElementNode,
  type Spread,
} from 'lexical'
import { themeClass } from './theme.js'

const VERSION = 1

/* ------------------------------------------------------------------ heading */

export type SerializedHeadingNode = Spread<{ depth: number }, SerializedElementNode>

export class HeadingNode extends ElementNode {
  /** @internal */
  __depth: number

  constructor(depth: number, key?: NodeKey) {
    super(key)
    this.__depth = Math.min(6, Math.max(1, depth))
  }

  static override getType(): string {
    return 'rmk-heading'
  }

  static override clone(node: HeadingNode): HeadingNode {
    return new HeadingNode(node.__depth, node.__key)
  }

  static override importJSON(serialized: SerializedHeadingNode): HeadingNode {
    return new HeadingNode(serialized.depth)
  }

  override exportJSON(): SerializedHeadingNode {
    return { ...super.exportJSON(), type: HeadingNode.getType(), version: VERSION, depth: this.__depth }
  }

  getDepth(): number {
    return this.getLatest().__depth
  }

  setDepth(depth: number): this {
    const self = this.getWritable()
    self.__depth = Math.min(6, Math.max(1, depth))
    return self
  }

  override createDOM(): HTMLElement {
    return document.createElement(`h${this.__depth}`)
  }

  override updateDOM(previous: HeadingNode): boolean {
    return previous.__depth !== this.__depth
  }

  override insertNewAfter(_selection?: RangeSelection, restoreSelection = true): ElementNode {
    const paragraph = $createParagraphNode()
    this.insertAfter(paragraph, restoreSelection)
    return paragraph
  }

  override collapseAtStart(): boolean {
    const paragraph = $createParagraphNode()
    for (const child of this.getChildren()) paragraph.append(child)
    this.replace(paragraph)
    return true
  }
}

export const $createHeadingNode = (depth: number): HeadingNode => new HeadingNode(depth)
export const $isHeadingNode = (node: LexicalNode | null | undefined): node is HeadingNode =>
  node instanceof HeadingNode

/* --------------------------------------------------------------- blockquote */

export class BlockquoteNode extends ElementNode {
  static override getType(): string {
    return 'rmk-blockquote'
  }

  static override clone(node: BlockquoteNode): BlockquoteNode {
    return new BlockquoteNode(node.__key)
  }

  static override importJSON(): BlockquoteNode {
    return new BlockquoteNode()
  }

  override exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: BlockquoteNode.getType(), version: VERSION }
  }

  override createDOM(): HTMLElement {
    return document.createElement('blockquote')
  }

  override updateDOM(): boolean {
    return false
  }

  override canBeEmpty(): boolean {
    return false
  }

  override insertNewAfter(_selection?: RangeSelection, restoreSelection = true): ElementNode {
    const paragraph = $createParagraphNode()
    this.insertAfter(paragraph, restoreSelection)
    return paragraph
  }
}

export const $createBlockquoteNode = (): BlockquoteNode => new BlockquoteNode()
export const $isBlockquoteNode = (node: LexicalNode | null | undefined): node is BlockquoteNode =>
  node instanceof BlockquoteNode

/* --------------------------------------------------------------------- list */

export type SerializedListNode = Spread<
  { ordered: boolean; start: number; spread: boolean },
  SerializedElementNode
>

export class ListNode extends ElementNode {
  /** @internal */ __ordered: boolean
  /** @internal */ __start: number
  /** @internal */ __spread: boolean

  constructor(ordered: boolean, start: number, spread: boolean, key?: NodeKey) {
    super(key)
    this.__ordered = ordered
    this.__start = start
    this.__spread = spread
  }

  static override getType(): string {
    return 'rmk-list'
  }

  static override clone(node: ListNode): ListNode {
    return new ListNode(node.__ordered, node.__start, node.__spread, node.__key)
  }

  static override importJSON(serialized: SerializedListNode): ListNode {
    return new ListNode(serialized.ordered, serialized.start, serialized.spread)
  }

  override exportJSON(): SerializedListNode {
    return {
      ...super.exportJSON(),
      type: ListNode.getType(),
      version: VERSION,
      ordered: this.__ordered,
      start: this.__start,
      spread: this.__spread,
    }
  }

  isOrdered(): boolean {
    return this.getLatest().__ordered
  }

  /** Explicit numbering, preserved rather than regenerated (audit G11). */
  getStart(): number {
    return this.getLatest().__start
  }

  isSpread(): boolean {
    return this.getLatest().__spread
  }

  setSpread(spread: boolean): this {
    const self = this.getWritable()
    self.__spread = spread
    return self
  }

  override createDOM(): HTMLElement {
    const element = document.createElement(this.__ordered ? 'ol' : 'ul')
    if (this.__ordered && this.__start !== 1) element.setAttribute('start', String(this.__start))
    return element
  }

  override updateDOM(previous: ListNode): boolean {
    return previous.__ordered !== this.__ordered || previous.__start !== this.__start
  }

  override canBeEmpty(): boolean {
    return false
  }
}

export const $createListNode = (ordered: boolean, start = 1, spread = false): ListNode =>
  new ListNode(ordered, start, spread)
export const $isListNode = (node: LexicalNode | null | undefined): node is ListNode =>
  node instanceof ListNode

/* ---------------------------------------------------------------- list item */

export type SerializedListItemNode = Spread<
  { checked: boolean | null; spread: boolean },
  SerializedElementNode
>

export class ListItemNode extends ElementNode {
  /** @internal */ __checked: boolean | null
  /** @internal */ __spread: boolean

  constructor(checked: boolean | null, spread: boolean, key?: NodeKey) {
    super(key)
    this.__checked = checked
    this.__spread = spread
  }

  static override getType(): string {
    return 'rmk-list-item'
  }

  static override clone(node: ListItemNode): ListItemNode {
    return new ListItemNode(node.__checked, node.__spread, node.__key)
  }

  static override importJSON(serialized: SerializedListItemNode): ListItemNode {
    return new ListItemNode(serialized.checked, serialized.spread)
  }

  override exportJSON(): SerializedListItemNode {
    return {
      ...super.exportJSON(),
      type: ListItemNode.getType(),
      version: VERSION,
      checked: this.__checked,
      spread: this.__spread,
    }
  }

  getChecked(): boolean | null {
    return this.getLatest().__checked
  }

  setChecked(checked: boolean | null): this {
    const self = this.getWritable()
    self.__checked = checked
    return self
  }

  isSpread(): boolean {
    return this.getLatest().__spread
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('li')
    if (this.__checked !== null) {
      element.setAttribute('role', 'checkbox')
      element.setAttribute('aria-checked', this.__checked ? 'true' : 'false')
      element.setAttribute('data-rmk-task', this.__checked ? 'checked' : 'unchecked')
    }
    return element
  }

  override updateDOM(previous: ListItemNode): boolean {
    return previous.__checked !== this.__checked
  }

  override insertNewAfter(_selection?: RangeSelection, restoreSelection = true): ElementNode {
    const item = new ListItemNode(this.__checked === null ? null : false, this.__spread)
    const paragraph = $createParagraphNode()
    item.append(paragraph)
    this.insertAfter(item, restoreSelection)
    return paragraph
  }
}

export const $createListItemNode = (checked: boolean | null = null, spread = false): ListItemNode =>
  new ListItemNode(checked, spread)
export const $isListItemNode = (node: LexicalNode | null | undefined): node is ListItemNode =>
  node instanceof ListItemNode

/* --------------------------------------------------------------- code block */

export type SerializedCodeBlockNode = Spread<
  { lang: string | null; meta: string | null },
  SerializedElementNode
>

export class CodeBlockNode extends ElementNode {
  /** @internal */ __lang: string | null
  /** @internal */ __meta: string | null

  constructor(lang: string | null, meta: string | null, key?: NodeKey) {
    super(key)
    this.__lang = lang
    this.__meta = meta
  }

  static override getType(): string {
    return 'rmk-code-block'
  }

  static override clone(node: CodeBlockNode): CodeBlockNode {
    return new CodeBlockNode(node.__lang, node.__meta, node.__key)
  }

  static override importJSON(serialized: SerializedCodeBlockNode): CodeBlockNode {
    return new CodeBlockNode(serialized.lang, serialized.meta)
  }

  override exportJSON(): SerializedCodeBlockNode {
    return {
      ...super.exportJSON(),
      type: CodeBlockNode.getType(),
      version: VERSION,
      lang: this.__lang,
      meta: this.__meta,
    }
  }

  getLang(): string | null {
    return this.getLatest().__lang
  }

  /** Fence info beyond the language. A typed field, never inline CSS (G6). */
  getMeta(): string | null {
    return this.getLatest().__meta
  }

  setLang(lang: string | null): this {
    const self = this.getWritable()
    self.__lang = lang
    return self
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('pre')
    const className = themeClass(config, 'codeBlock')
    if (className !== undefined) element.className = className
    element.setAttribute('data-rmk-code-block', '')
    if (this.__lang !== null) element.setAttribute('data-rmk-lang', this.__lang)
    element.setAttribute('spellcheck', 'false')
    return element
  }

  override updateDOM(previous: CodeBlockNode): boolean {
    return previous.__lang !== this.__lang
  }

  override canBeEmpty(): boolean {
    return true
  }

  /** Enter inserts a newline in code, not a new block. */
  override insertNewAfter(_selection?: RangeSelection, restoreSelection = true): ElementNode {
    const paragraph = $createParagraphNode()
    this.insertAfter(paragraph, restoreSelection)
    return paragraph
  }
}

export const $createCodeBlockNode = (lang: string | null = null, meta: string | null = null): CodeBlockNode =>
  new CodeBlockNode(lang, meta)
export const $isCodeBlockNode = (node: LexicalNode | null | undefined): node is CodeBlockNode =>
  node instanceof CodeBlockNode
