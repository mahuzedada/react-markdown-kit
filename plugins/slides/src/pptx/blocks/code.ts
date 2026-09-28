/** A code block, one line per paragraph in the code font. Fragments and highlight steps are for the browser; the export shows the code whole. */
import { text, type BlockWriter } from './content-item.js'

export const writeCode: BlockWriter = (node, { theme }) => {
  const lines = String(node.value ?? '').split('\n')
  return text(
    lines.map((line, index) => ({
      text: line === '' ? ' ' : line,
      options: { fontFace: theme.codeFont, fontSize: Math.round(theme.fontSize * 0.75), breakLine: true, ...(index === lines.length - 1 ? { paraSpaceAfter: 8 } : {}) },
    })),
  )
}
