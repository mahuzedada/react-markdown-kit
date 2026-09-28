/**
 * What a slide block becomes in PowerPoint: text paragraphs (which flow
 * together into one text box), a picture, or a table. A block writer turns
 * one mdast block into items; `registry.ts` maps block types to writers, so
 * supporting a new block type is a new writer.
 */
import type PptxGenJS from 'pptxgenjs'
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import type { ExportContext } from '../export-context.js'

export type ContentItem =
  | { readonly kind: 'text'; readonly runs: PptxGenJS.TextProps[] }
  | { readonly kind: 'image'; readonly data: string; readonly alt: string }
  | { readonly kind: 'table'; readonly rows: PptxGenJS.TableRow[] }

export interface WriterContext extends ExportContext {
  /** Writes a nested block (a list item's paragraphs, a quote's content). */
  readonly write: (node: MarkdownNode, depth: number) => ContentItem[]
}

export type BlockWriter = (node: MarkdownNode, context: WriterContext, depth: number) => ContentItem[]

export function text(runs: PptxGenJS.TextProps[]): ContentItem[] {
  return runs.length === 0 ? [] : [{ kind: 'text', runs }]
}
