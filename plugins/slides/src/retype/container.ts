/** Lazy continuation glues a marker to the last paragraph of a list or a block quote too. */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { slidesDiagnostic } from '../deck/diagnostics.js'
import { attachedMarker } from '../deck/markers.js'
import type { Retyper } from './retyper.js'

export const retypeContainer: Retyper = (node, context) => {
  const last = lastParagraph(node)
  if (last !== undefined && attachedMarker(last) !== undefined) context.report(slidesDiagnostic('SLIDES_MARKER_ATTACHED', last.position))
  return node
}

/** The paragraph that closes a container: the last child, followed down. */
function lastParagraph(node: MarkdownNode): MarkdownNode | undefined {
  if (node.type === 'paragraph') return node
  const last = node.children?.[node.children.length - 1]
  return last === undefined ? undefined : lastParagraph(last)
}
