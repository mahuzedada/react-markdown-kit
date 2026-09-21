/**
 * Table nodes (GFM profile).
 *
 * Column alignment is a typed field on the table, matching mdast's `align`
 * array. The prior editor stored alignment and column width in inline `style`
 * attributes, so both were invisible to the serializer (docs/AUDIT.md G6), and
 * re-parsed each cell with stock transformers so custom syntax died inside a
 * cell (G7). Here a cell is just a subtree of the one document.
 */
import {
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from 'lexical'
import { themeClass } from './theme.js'
import type { EditorConfig } from 'lexical'

const VERSION = 1

export type TableAlign = 'left' | 'right' | 'center' | null

export type SerializedTableNode = Spread<{ align: TableAlign[] }, SerializedElementNode>

export class TableNode extends ElementNode {
  /** @internal */ __align: TableAlign[]

  constructor(align: TableAlign[], key?: NodeKey) {
    super(key)
    this.__align = align
  }

  static override getType(): string {
    return 'rmk-table'
  }

  static override clone(node: TableNode): TableNode {
    return new TableNode([...node.__align], node.__key)
  }

  static override importJSON(serialized: SerializedTableNode): TableNode {
    return new TableNode(serialized.align)
  }

  override exportJSON(): SerializedTableNode {
    return { ...super.exportJSON(), type: TableNode.getType(), version: VERSION, align: this.__align }
  }

  getAlign(): TableAlign[] {
    return this.getLatest().__align
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('table')
    const className = themeClass(config, 'table')
    if (className !== undefined) element.className = className
    return element
  }

  override updateDOM(): boolean {
    return false
  }

  override canBeEmpty(): boolean {
    return false
  }
}

export const $createTableNode = (align: TableAlign[]): TableNode => new TableNode(align)
export const $isTableNode = (node: LexicalNode | null | undefined): node is TableNode =>
  node instanceof TableNode

export type SerializedTableRowNode = Spread<{ header: boolean }, SerializedElementNode>

export class TableRowNode extends ElementNode {
  /** @internal */ __header: boolean

  constructor(header: boolean, key?: NodeKey) {
    super(key)
    this.__header = header
  }

  static override getType(): string {
    return 'rmk-table-row'
  }

  static override clone(node: TableRowNode): TableRowNode {
    return new TableRowNode(node.__header, node.__key)
  }

  static override importJSON(serialized: SerializedTableRowNode): TableRowNode {
    return new TableRowNode(serialized.header)
  }

  override exportJSON(): SerializedTableRowNode {
    return { ...super.exportJSON(), type: TableRowNode.getType(), version: VERSION, header: this.__header }
  }

  isHeader(): boolean {
    return this.getLatest().__header
  }

  override createDOM(): HTMLElement {
    return document.createElement('tr')
  }

  override updateDOM(): boolean {
    return false
  }

  override canBeEmpty(): boolean {
    return false
  }
}

export const $createTableRowNode = (header: boolean): TableRowNode => new TableRowNode(header)
export const $isTableRowNode = (node: LexicalNode | null | undefined): node is TableRowNode =>
  node instanceof TableRowNode

export type SerializedTableCellNode = Spread<{ header: boolean }, SerializedElementNode>

export class TableCellNode extends ElementNode {
  /** @internal */ __header: boolean

  constructor(header: boolean, key?: NodeKey) {
    super(key)
    this.__header = header
  }

  static override getType(): string {
    return 'rmk-table-cell'
  }

  static override clone(node: TableCellNode): TableCellNode {
    return new TableCellNode(node.__header, node.__key)
  }

  static override importJSON(serialized: SerializedTableCellNode): TableCellNode {
    return new TableCellNode(serialized.header)
  }

  override exportJSON(): SerializedTableCellNode {
    return { ...super.exportJSON(), type: TableCellNode.getType(), version: VERSION, header: this.__header }
  }

  override createDOM(): HTMLElement {
    return document.createElement(this.__header ? 'th' : 'td')
  }

  override updateDOM(): boolean {
    return false
  }

  override canBeEmpty(): boolean {
    return true
  }
}

export const $createTableCellNode = (header: boolean): TableCellNode => new TableCellNode(header)
export const $isTableCellNode = (node: LexicalNode | null | undefined): node is TableCellNode =>
  node instanceof TableCellNode
