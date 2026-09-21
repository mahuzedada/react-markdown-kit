/**
 * Which kind of `thematicBreak` a node is.
 *
 * CommonMark gives `---`, `***` and `___` the same node, so the spelling has
 * to come from the source. Only dashes split slides; the other two are
 * rules inside a slide. Without source the transform's annotation decides,
 * and without either every break is a slide break.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'

export type BreakKind = 'slide' | 'rule'

/** The annotation the transform leaves so the renderer can tell without source. */
export const BREAK_DATA_KEY = 'rmkSlides'

export function breakSpelling(node: MarkdownNode, source?: string): BreakKind {
  const spelling = sliceSource(node, source)
  if (spelling !== undefined) return /^[-\s]+$/.test(spelling) ? 'slide' : 'rule'
  const data = node['data']
  if (typeof data === 'object' && data !== null) {
    const annotation = (data as Record<string, unknown>)[BREAK_DATA_KEY]
    if (typeof annotation === 'object' && annotation !== null && (annotation as { rule?: unknown }).rule === true) return 'rule'
  }
  return 'slide'
}

/** The node's bytes, when both the source and numeric offsets are available. */
export function sliceSource(node: MarkdownNode, source: string | undefined): string | undefined {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (source === undefined || start === undefined || end === undefined) return undefined
  return source.slice(start, end)
}
