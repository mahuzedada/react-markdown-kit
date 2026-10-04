import { $createParagraphNode, $createTextNode, $getSelection, $isRangeSelection, $insertNodes, $getRoot, type LexicalNode } from 'lexical'
import { $createTableNode, $createTableRowNode, $createTableCellNode, $isTableCellNode, $isTableRowNode, $isTableNode, type TableCellNode, type TableNode, type TableAlign } from './nodes/table.js'

export function $cellOf(node: LexicalNode | null): TableCellNode | null {
  for (let current = node; current !== null; current = current.getParent()) if ($isTableCellNode(current)) return current
  return null
}
export function $activeCell(): TableCellNode | null {
  const selection = $getSelection()
  return $isRangeSelection(selection) ? $cellOf(selection.anchor.getNode()) : null
}
export function $tableOf(cell: TableCellNode): TableNode | null {
  const table = cell.getParent()?.getParent()
  return $isTableNode(table) ? table : null
}
export function $rows(table: TableNode): TableCellNode[][] {
  return table.getChildren().filter($isTableRowNode).map(row => row.getChildren().filter($isTableCellNode))
}
export function $emptyCell(header: boolean): TableCellNode {
  return $createTableCellNode(header).append($createParagraphNode())
}
export function $insertTable(rows: number, columns: number): void {
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 || rows > 100 || columns > 30) throw new RangeError('Tables require 1–100 rows and 1–30 columns.')
  if ($activeCell()) return
  if (!$isRangeSelection($getSelection())) $getRoot().selectEnd()
  const table = $createTableNode(Array.from({ length: columns }, () => null))
  for (let r = 0; r < rows; r++) table.append($createTableRowNode(r === 0).append(...Array.from({length: columns}, () => $emptyCell(r === 0))))
  $insertNodes([table, $createParagraphNode()])
  $rows(table)[0]?.[0]?.selectStart()
}
export type TableAction = 'rowAbove' | 'rowBelow' | 'columnLeft' | 'columnRight' | 'deleteRow' | 'deleteColumn' | 'deleteTable'
export function $tableAction(action: TableAction, cell = $activeCell()): void {
  if (!cell) return
  const table = $tableOf(cell)
  const row = cell.getParent()
  if (!table || !$isTableRowNode(row)) return
  const grid = $rows(table), r = row.getIndexWithinParent(), c = cell.getIndexWithinParent()
  if (action === 'deleteTable' || (action === 'deleteRow' && grid.length === 1) || (action === 'deleteColumn' && grid[0]?.length === 1)) {
    const paragraph = $createParagraphNode()
    table.replace(paragraph); paragraph.selectStart(); return
  }
  if (action === 'rowAbove' || action === 'rowBelow') {
    const next = $createTableRowNode(false).append(...Array.from({length: grid[0]?.length ?? 1}, () => $emptyCell(false)))
    // Keep the existing header at the top, even for 'above' on its row.
    if (action === 'rowAbove' && r > 0) row.insertBefore(next); else row.insertAfter(next)
    $normalizeHeaders(table)
    next.getChildAtIndex(c)?.selectStart()
  } else if (action === 'deleteRow') {
    row.remove(); $normalizeHeaders(table)
    $rows(table)[Math.min(r, grid.length - 2)]?.[c]?.selectStart()
  } else if (action === 'columnLeft' || action === 'columnRight') {
    const index = c + (action === 'columnRight' ? 1 : 0)
    grid.forEach((cells, i) => {
      const added = $emptyCell(i === 0)
      if (action === 'columnLeft') cells[c]?.insertBefore(added); else cells[c]?.insertAfter(added)
    })
    const align = [...table.getAlign()]; align.splice(index, 0, null); table.setAlign(align)
    $rows(table)[r]?.[index]?.selectStart()
  } else {
    grid.forEach(cells => cells[c]?.remove())
    const align = [...table.getAlign()]; align.splice(c, 1); table.setAlign(align)
    $rows(table)[r]?.[Math.min(c, (grid[0]?.length ?? 1) - 2)]?.selectStart()
  }
}
function $normalizeHeaders(table: TableNode): void {
  table.getChildren().filter($isTableRowNode).forEach((row, r) => {
    row.setHeader(r === 0)
    row.getChildren().filter($isTableCellNode).forEach(cell => cell.setHeader(r === 0))
  })
}
export function $alignColumn(align: TableAlign, cell = $activeCell()): void {
  if (!cell) return
  const table = $tableOf(cell)
  if (!table) return
  const values = [...table.getAlign()]; values[cell.getIndexWithinParent()] = align; table.setAlign(values)
}
export function $navigateCell(backward: boolean): boolean {
  const cell = $activeCell(), table = cell && $tableOf(cell)
  if (!cell || !table) return false
  const cells = $rows(table).flat(), index = cells.findIndex(item => item.is(cell))
  if (backward && index === 0) {
    let previous = table.getPreviousSibling()
    if (!previous) { previous = $createParagraphNode(); table.insertBefore(previous) }
    previous.selectEnd()
  } else if (!backward && index === cells.length - 1) {
    $tableAction('rowBelow', cell)
    $rows(table).at(-1)?.[0]?.selectStart()
  }
  else cells[index + (backward ? -1 : 1)]?.selectStart()
  return true
}
/** TSV uses spreadsheet-style quoting, including embedded tabs and line breaks. */
export function parseTableClipboard(text: string): string[][] {
  const rows: string[][] = [[]]; let value = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"' && (quoted || value === '')) {
      if (quoted && text[i + 1] === '"') { value += '"'; i++ } else quoted = !quoted
    } else if (!quoted && (char === '\t' || char === '\n' || char === '\r')) {
      rows[rows.length - 1]!.push(value); value = ''
      if (char !== '\t') { if (char === '\r' && text[i + 1] === '\n') i++; rows.push([]) }
    } else value += char
  }
  rows[rows.length - 1]!.push(value)
  if (rows.length > 1 && rows[rows.length - 1]?.length === 1 && rows[rows.length - 1]?.[0] === '') rows.pop()
  return rows
}
export function serializeTableClipboard(rows: string[][]): string {
  return rows.map(row => row.map(value => /[\t\n\r"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value).join('\t')).join('\n')
}
export function $pasteCells(cell: TableCellNode, values: string[][]): void {
  const table = $tableOf(cell)
  if (!table) return
  const r = cell.getParent()!.getIndexWithinParent(), c = cell.getIndexWithinParent()
  const width = Math.max(...values.map(row => row.length))
  if (r + values.length > 100 || c + width > 30) return
  while (($rows(table)[0]?.length ?? 0) < c + width) $tableAction('columnRight', $rows(table)[0]?.at(-1))
  while ($rows(table).length < r + values.length) $tableAction('rowBelow', $rows(table).at(-1)?.[0])
  const grid = $rows(table)
  values.forEach((row, y) => row.forEach((value, x) => {
    const target = grid[r + y]?.[c + x]
    target?.clear().append($createParagraphNode().append($createTextNode(value)))
  }))
  grid[r + values.length - 1]?.[c + width - 1]?.selectEnd()
}
