/** Paragraphs, headings below the title, and block quotes. A paragraph that is only an image becomes a picture, when it was allowed and fetched. */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { pictureOf } from '../export-context.js'
import { asParagraph, inlineRuns } from '../inline-runs.js'
import { text, type BlockWriter, type ContentItem } from './content-item.js'

const HEADING_SCALE: Readonly<Record<number, number>> = { 1: 1.8, 2: 1.5, 3: 1.25, 4: 1.1 }

function onlyImage(node: MarkdownNode): MarkdownNode | undefined {
  const children = (node.children ?? []).filter((child) => !(child.type === 'text' && String(child.value ?? '').trim() === ''))
  return children.length === 1 && children[0]!.type === 'image' ? children[0] : undefined
}

export const writeParagraph: BlockWriter = (node, context) => {
  const image = onlyImage(node)
  if (image === undefined) return text(asParagraph(inlineRuns(node.children, context), { paraSpaceAfter: 8 }))
  const data = pictureOf(context, String(image['url'] ?? ''))
  return data === undefined ? [] : [{ kind: 'image', data, alt: String(image['alt'] ?? '') }]
}

export const writeHeading: BlockWriter = (node, context) => {
  const scale = HEADING_SCALE[Number(node['depth'])] ?? 1
  return text(asParagraph(inlineRuns(node.children, context, { bold: true, fontSize: Math.round(context.theme.fontSize * scale) }), { paraSpaceAfter: 10 }))
}

export const writeBlockquote: BlockWriter = (node, { write }, depth) =>
  (node.children ?? []).flatMap((child): ContentItem[] =>
    write(child, depth + 1).map((item) =>
      item.kind === 'text' ? { kind: 'text', runs: item.runs.map((run) => ({ ...run, options: { ...run.options, italic: true, indentLevel: depth + 1 } })) } : item,
    ),
  )
