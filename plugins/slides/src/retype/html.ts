/** `<!-- key: value -->` becomes a `slideDirective` when the key is known and the argument accepted. */
import { slidesDiagnostic } from '../deck/diagnostics.js'
import { isDirectiveKey } from '../deck/directive-keys/registry.js'
import { SLIDE_DIRECTIVE_NODE, directiveProblem, matchDirective, type SlideDirectiveNode } from '../deck/directives.js'
import { positionOf, type Retyper } from './retyper.js'

export const retypeHtml: Retyper = (node, context) => {
  if (typeof node.value !== 'string') return node
  const match = matchDirective(node.value)
  if (match === undefined) return node
  if (!isDirectiveKey(match.key)) {
    context.report(slidesDiagnostic('SLIDES_DIRECTIVE_UNKNOWN', node.position))
    return node
  }
  const problem = directiveProblem(match.key, match.argument)
  if (problem !== undefined) {
    context.report(slidesDiagnostic('SLIDES_DIRECTIVE_INVALID', node.position, problem))
    return node
  }
  const directive: SlideDirectiveNode = { type: SLIDE_DIRECTIVE_NODE, key: match.key, argument: match.argument, ...positionOf(node) }
  return directive
}
