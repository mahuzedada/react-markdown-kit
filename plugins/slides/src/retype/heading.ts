/** A depth-2 setext heading: dashes under text made a heading where the author probably meant a break or a pause. */
import { sliceSource } from '../deck/breaks.js'
import { slidesDiagnostic } from '../deck/diagnostics.js'
import type { Retyper } from './retyper.js'

const SETEXT_UNDERLINE = /(?:^|\n) {0,3}-{2,}[ \t]*$/

export const retypeHeading: Retyper = (node, context) => {
  if (node['depth'] !== 2) return node
  const spelling = sliceSource(node, context.source)
  if (spelling !== undefined && SETEXT_UNDERLINE.test(spelling)) context.report(slidesDiagnostic('SLIDES_SETEXT_HEADING', node.position))
  return node
}
