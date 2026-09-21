/**
 * `???` (speaker notes) and `--` (pause) markers.
 *
 * Each is a paragraph holding exactly that text. `--` needs its own node
 * type because a paragraph containing `--` would serialize as `\--`;
 * the marker handler writes the bare spelling. A marker glued to the line
 * above (lazy continuation) is part of that paragraph and is reported so
 * the author knows why nothing happened.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'

export const SLIDE_MARKER_NODE = 'slideMarker'

export type MarkerKind = 'notes' | 'pause'

export interface SlideMarkerNode extends MarkdownNode {
  readonly type: typeof SLIDE_MARKER_NODE
  readonly kind: MarkerKind
}

export function isSlideMarkerNode(node: MarkdownNode): node is SlideMarkerNode {
  return node.type === SLIDE_MARKER_NODE
}

const SPELLING: Readonly<Record<MarkerKind, string>> = { notes: '???', pause: '--' }

export function markerSpelling(kind: MarkerKind): string {
  return SPELLING[kind]
}

/** A re-typed marker, or a paragraph that would be re-typed. */
export function markerKind(node: MarkdownNode): MarkerKind | undefined {
  if (isSlideMarkerNode(node)) return node.kind
  const text = paragraphText(node)
  if (text === '???') return 'notes'
  if (text === '--') return 'pause'
  return undefined
}

/** A paragraph whose last line alone is a marker: lazy continuation swallowed it. */
export function attachedMarker(node: MarkdownNode): MarkerKind | undefined {
  const text = paragraphText(node)
  if (text === undefined) return undefined
  if (text.endsWith('\n???')) return 'notes'
  if (text.endsWith('\n--')) return 'pause'
  return undefined
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
