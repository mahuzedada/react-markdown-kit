/** A paragraph that spells a marker becomes a `slideMarker`; one whose last line does is reported as attached. */
import { slidesDiagnostic } from '../deck/diagnostics.js'
import { SLIDE_MARKER_NODE, attachedMarker, markerKind, type SlideMarkerNode } from '../deck/markers.js'
import { positionOf, type Retyper } from './retyper.js'

export const retypeParagraph: Retyper = (node, context) => {
  const kind = markerKind(node)
  if (kind !== undefined) {
    const marker: SlideMarkerNode = { type: SLIDE_MARKER_NODE, kind, ...positionOf(node) }
    return marker
  }
  if (attachedMarker(node) !== undefined) context.report(slidesDiagnostic('SLIDES_MARKER_ATTACHED', node.position))
  return node
}
