/** A GFM table as a PowerPoint table, header row in bold. */
import { inlineRuns } from '../inline-runs.js'
import type { BlockWriter } from './content-item.js'

export const writeTable: BlockWriter = (node, context) => {
  const rows = (node.children ?? []).map((row, rowIndex) =>
    (row.children ?? []).map((cell) => ({
      text: inlineRuns(cell.children, context, rowIndex === 0 ? { bold: true } : {}),
    })),
  )
  return rows.length === 0 ? [] : [{ kind: 'table', rows }]
}
