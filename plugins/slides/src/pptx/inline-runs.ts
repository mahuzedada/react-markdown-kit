/**
 * Phrasing content (text, emphasis, code, links) as PowerPoint text runs.
 * Formatting accumulates down the tree: a link inside bold text is a bold
 * hyperlink, when the URL policy allows it (plain text otherwise). A node
 * type with no handler contributes its children's runs; one without text of
 * its own (an image, raw html) contributes nothing.
 */
import type PptxGenJS from 'pptxgenjs'
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import type { ExportContext } from './export-context.js'

type RunOptions = PptxGenJS.TextPropsOptions
type RunHandler = (node: MarkdownNode, context: ExportContext, base: RunOptions) => PptxGenJS.TextProps[]

const valueRun = (node: MarkdownNode, options: RunOptions): PptxGenJS.TextProps[] =>
  typeof node.value === 'string' ? [{ text: node.value, options }] : []

const RUN_HANDLERS: ReadonlyMap<string, RunHandler> = new Map(
  Object.entries({
    text: (node, _context, base) => valueRun(node, base),
    inlineCode: (node, context, base) => valueRun(node, { ...base, fontFace: context.theme.codeFont }),
    strong: (node, context, base) => inlineRuns(node.children, context, { ...base, bold: true }),
    emphasis: (node, context, base) => inlineRuns(node.children, context, { ...base, italic: true }),
    delete: (node, context, base) => inlineRuns(node.children, context, { ...base, strike: 'sngStrike' }),
    link: (node, context, base) => {
      const url = context.resolveUrl(String(node['url'] ?? ''), 'link')
      return inlineRuns(node.children, context, url === undefined ? base : { ...base, hyperlink: { url } })
    },
    break: (_node, _context, base) => [{ text: '', options: { ...base, breakLine: true } }],
    image: () => [],
    html: () => [],
  } satisfies Record<string, RunHandler>),
)

export function inlineRuns(nodes: readonly MarkdownNode[] | undefined, context: ExportContext, base: RunOptions = {}): PptxGenJS.TextProps[] {
  return (nodes ?? []).flatMap((node) => (RUN_HANDLERS.get(node.type) ?? childRuns)(node, context, base))
}

const childRuns: RunHandler = (node, context, base) => inlineRuns(node.children, context, base)

/** Ends a paragraph: the last run breaks the line, and the paragraph gets its spacing. */
export function asParagraph(runs: PptxGenJS.TextProps[], paragraph: RunOptions = {}): PptxGenJS.TextProps[] {
  if (runs.length === 0) return []
  return runs.map((run, index) => ({
    ...run,
    options: { ...paragraph, ...run.options, ...(index === runs.length - 1 ? { breakLine: true } : {}) },
  }))
}

/** A heading's plain text, for the slide title. */
export function plainText(nodes: readonly MarkdownNode[] | undefined): string {
  return (nodes ?? []).map((node) => (typeof node.value === 'string' ? node.value : plainText(node.children))).join('')
}
