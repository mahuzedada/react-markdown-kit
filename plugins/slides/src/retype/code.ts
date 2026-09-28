/** A fence whose `{…}` line ranges cannot be read is reported; the renderer then shows it without highlights. */
import { readCodeSteps } from '../deck/code-steps.js'
import { slidesDiagnostic } from '../deck/diagnostics.js'
import type { Retyper } from './retyper.js'

export const retypeCode: Retyper = (node, context) => {
  if (readCodeSteps(node['meta']) === 'invalid') context.report(slidesDiagnostic('SLIDES_CODE_STEPS_INVALID', node.position))
  return node
}
