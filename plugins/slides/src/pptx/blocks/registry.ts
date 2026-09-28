/** The writer for each block type. A type without one (a rule, raw html, a diagram another plugin renders) is left out. */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { writeCode } from './code.js'
import type { BlockWriter, ContentItem, WriterContext } from './content-item.js'
import { writeList } from './list.js'
import { writeBlockquote, writeHeading, writeParagraph } from './prose.js'
import { writeTable } from './table.js'
import type { ExportContext } from '../export-context.js'

const WRITERS: ReadonlyMap<string, BlockWriter> = new Map(
  Object.entries({
    paragraph: writeParagraph,
    heading: writeHeading,
    blockquote: writeBlockquote,
    list: writeList,
    code: writeCode,
    table: writeTable,
  }),
)

export function blockItems(nodes: readonly MarkdownNode[], exportContext: ExportContext): ContentItem[] {
  const context: WriterContext = { ...exportContext, write: (node, depth) => WRITERS.get(node.type)?.(node, context, depth) ?? [] }
  return nodes.flatMap((node) => context.write(node, 0))
}
