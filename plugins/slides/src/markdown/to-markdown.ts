/**
 * Writing the two re-typed nodes back.
 *
 * A custom handler's output is not escaped, which is the point: a paragraph
 * holding `--` would come out as `\--`. Front matter serializes through
 * `frontmatterToMarkdown`. A thematic break has its own handler too: the
 * built-in one writes every break as `---`, which would turn a `***` rule
 * inside a slide into a slide break, so an annotated rule writes `***`.
 * Consecutive directives are joined with no blank line, the way they are
 * usually written.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { breakSpelling } from '../deck/breaks.js'
import { isSlideDirectiveNode, type SlideDirectiveNode } from '../deck/directives.js'
import { markerSpelling, type SlideMarkerNode } from '../deck/markers.js'

export function thematicBreakToMarkdown(node: MarkdownNode): string {
  return breakSpelling(node) === 'rule' ? '***' : '---'
}

export function slideMarkerToMarkdown(node: SlideMarkerNode): string {
  return markerSpelling(node.kind)
}

export function slideDirectiveToMarkdown(node: SlideDirectiveNode): string {
  return `<!-- ${node.key}: ${node.argument} -->`
}

/** No blank line between two directives; every other pair keeps the default. */
export function joinDirectives(left: MarkdownNode, right: MarkdownNode): number | undefined {
  return isSlideDirectiveNode(left) && isSlideDirectiveNode(right) ? 0 : undefined
}
