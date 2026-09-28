/**
 * Marker nodes: `???` (speaker notes), `--` (pause), `::right::` (column).
 *
 * Each is a paragraph holding exactly that text. A marker needs its own
 * node type because a paragraph containing `--` would serialize as `\--`;
 * the marker handler writes the bare spelling. A marker glued to the line
 * above (lazy continuation) is part of that paragraph and is reported so
 * the author knows why nothing happened. The kinds and their spellings
 * live in `marker-kinds/`.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { MARKER_KINDS, markerOfSpelling, markerSpec, type MarkerKind } from './marker-kinds/registry.js'

export const SLIDE_MARKER_NODE = 'slideMarker'

export interface SlideMarkerNode extends MarkdownNode {
  readonly type: typeof SLIDE_MARKER_NODE
  readonly kind: MarkerKind
}

export function isSlideMarkerNode(node: MarkdownNode): node is SlideMarkerNode {
  return node.type === SLIDE_MARKER_NODE
}

export function markerSpelling(kind: MarkerKind): string {
  return markerSpec(kind).spelling
}

/** A re-typed marker, or a paragraph that would be re-typed. */
export function markerKind(node: MarkdownNode): MarkerKind | undefined {
  if (isSlideMarkerNode(node)) return node.kind
  const text = paragraphText(node)
  return text === undefined ? undefined : markerOfSpelling(text)
}

/** A paragraph whose last line alone is a marker: lazy continuation swallowed it. */
export function attachedMarker(node: MarkdownNode): MarkerKind | undefined {
  const text = paragraphText(node)
  if (text === undefined) return undefined
  return MARKER_KINDS.find((spec) => text.endsWith(`\n${spec.spelling}`))?.kind
}

/** The concatenated text of a paragraph made only of text nodes; undefined otherwise. */
export function paragraphText(node: MarkdownNode): string | undefined {
  if (node.type !== 'paragraph' || node.children === undefined) return undefined
  let text = ''
  for (const child of node.children) {
    if (child.type !== 'text' || typeof child.value !== 'string') return undefined
    text += child.value
  }
  return text
}
