/**
 * Shortcuts finished with Enter instead of a space: a rule (`---`), a code
 * fence (```` ```ts ````) and table rows (`| a | b |`).
 *
 * A table is built line by line. The first row line becomes a table with that
 * header, each later row line joins the table above, and a delimiter line
 * (`| :-- | --: |`) right after the header sets the column alignment. The line
 * the caret was on stays behind, empty, below the table, so the next row is
 * typed the same way. Cells keep the text formats already on the line, since
 * `**bold**` has turned bold by the time Enter is pressed.
 */
import {
  $createTextNode,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  INSERT_PARAGRAPH_COMMAND,
  type LexicalEditor,
  type ParagraphNode,
  type TextNode,
} from 'lexical'
import { $createCodeBlockNode } from '../nodes/blocks.js'
import { $createThematicBreakNode } from '../nodes/inline.js'
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableNode,
  $isTableRowNode,
  type TableAlign,
  type TableNode,
  type TableRowNode,
} from '../nodes/table.js'
import type { MarkdownBridge } from '../bridge/session.js'
import { CODE_FENCE_LINE, THEMATIC_BREAK_LINE } from './blocks.js'

const TABLE_ROW_LINE = /^\|.*\|\s*$/
const TABLE_DELIMITER_LINE = /^\|?(?:\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/

export function registerEnterShortcuts(editor: LexicalEditor, bridge: MarkdownBridge): () => void {
  return editor.registerCommand(
    INSERT_PARAGRAPH_COMMAND,
    () => {
      const paragraph = $paragraphEndingAtCaret()
      if (paragraph === null) return false
      const line = paragraph.getTextContent()

      if (THEMATIC_BREAK_LINE.test(line)) {
        paragraph.insertBefore($createThematicBreakNode())
        paragraph.clear().select()
        return true
      }

      const fence = CODE_FENCE_LINE.exec(line)
      if (fence !== null) {
        const code = $createCodeBlockNode(fence[1] ?? null, null)
        paragraph.replace(code)
        code.select()
        return true
      }

      if (bridge.profile === 'gfm' && line.includes('|')) return $tableLine(paragraph, line)
      return false
    },
    COMMAND_PRIORITY_LOW,
  )
}

/** A root-level paragraph of plain text with a collapsed caret at its end. */
function $paragraphEndingAtCaret(): ParagraphNode | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null
  const anchor = selection.anchor.getNode()
  const paragraph = $isParagraphNode(anchor) ? anchor : anchor.getParent()
  if (!$isParagraphNode(paragraph) || !$isRootOrShadowRoot(paragraph.getParent())) return null
  if (!paragraph.getChildren().every($isTextNode)) return null
  const last = paragraph.getLastDescendant()
  const atEnd = $isTextNode(anchor)
    ? anchor.is(last) && selection.anchor.offset === anchor.getTextContentSize()
    : selection.anchor.offset === paragraph.getChildrenSize()
  return atEnd ? paragraph : null
}

function $tableLine(paragraph: ParagraphNode, line: string): boolean {
  const previous = paragraph.getPreviousSibling()
  const table = $isTableNode(previous) ? previous : null

  if (TABLE_DELIMITER_LINE.test(line)) {
    // Only right under a header row; anywhere else it is not a row to add.
    if (table === null || table.getChildrenSize() !== 1) return false
    const align = cellsOf(line).map(alignOf)
    table.setAlign(Array.from({ length: columnsOf(table) }, (_, index) => align[index] ?? null))
    paragraph.clear().select()
    return true
  }
  if (!TABLE_ROW_LINE.test(line)) return false

  const header = table === null
  const row = $createTableRowNode(header)
  for (const cell of cellNodesOf(paragraph)) row.append($createTableCellNode(header).append(...cell))
  if (table === null) {
    const created = $createTableNode(Array<TableAlign>(row.getChildrenSize()).fill(null))
    paragraph.insertBefore(created.append(row))
  } else {
    table.append(row)
    $padColumns(table)
  }
  paragraph.clear().select()
  return true
}

/**
 * The line's text nodes cut at each unescaped pipe, formats kept, with the
 * padding around each cell and the outer pipes dropped. `\|` is a pipe in the
 * cell's text, as it is on load.
 */
function cellNodesOf(paragraph: ParagraphNode): TextNode[][] {
  const cells: TextNode[][] = [[]]
  for (const node of paragraph.getChildren()) {
    if (!$isTextNode(node)) continue
    node.getTextContent().split(/(?<!\\)\|/).forEach((piece, index) => {
      if (index > 0) cells.push([])
      const text = piece.replaceAll('\\|', '|')
      if (text !== '') cells[cells.length - 1]?.push($createTextNode(text).setFormat(node.getFormat()))
    })
  }
  const inner = cells.slice(1, -1)
  for (const cell of inner) {
    const first = cell[0]
    if (first) first.setTextContent(first.getTextContent().trimStart())
    const last = cell[cell.length - 1]
    if (last) last.setTextContent(last.getTextContent().trimEnd())
  }
  return inner.map((cell) => cell.filter((text) => text.getTextContent() !== ''))
}

/** A row wider than the table widens every row, as a loaded ragged table would. */
function $padColumns(table: TableNode): void {
  const rows = table.getChildren().filter($isTableRowNode)
  const width = Math.max(...rows.map((row) => row.getChildrenSize()))
  for (const row of rows) $padRow(row, width)
  const align = table.getAlign()
  if (align.length < width) table.setAlign([...align, ...Array<TableAlign>(width - align.length).fill(null)])
}

function $padRow(row: TableRowNode, width: number): void {
  for (let index = row.getChildrenSize(); index < width; index++) {
    row.append($createTableCellNode(row.isHeader()))
  }
}

function columnsOf(table: TableNode): number {
  const header = table.getFirstChild()
  return $isTableRowNode(header) ? header.getChildrenSize() : 0
}

/** Cells of a row line, split on pipes that are not escaped. */
function cellsOf(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/)
}

function alignOf(cell: string): TableAlign {
  const value = cell.trim()
  const left = value.startsWith(':')
  const right = value.endsWith(':')
  if (left && right) return 'center'
  if (left) return 'left'
  if (right) return 'right'
  return null
}
