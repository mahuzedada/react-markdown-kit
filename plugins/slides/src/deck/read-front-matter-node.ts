/**
 * The deck's `yaml` node, read as deck settings: `title` and `aspect` for
 * the deck, and every directive key that allows it as the default of every
 * slide. Unknown keys are ignored; a rejected value is reported and left out.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { directiveSpec, isDirectiveKey } from './directive-keys/registry.js'
import type { ReportProblem } from './diagnostics.js'
import { isFrontMatter, parseFrontMatter } from './front-matter.js'
import type { SlideAspect, SlideProperties } from './model.js'
import type { WritableProperties } from './slide-draft.js'

export interface DeckSettings {
  readonly title?: string
  readonly aspect?: SlideAspect
  /** What every slide starts from. */
  readonly defaults: SlideProperties
}

export const NO_DECK_SETTINGS: DeckSettings = { defaults: { classes: [] } }

export function readFrontMatterNode(node: MarkdownNode, report: ReportProblem): DeckSettings {
  const value = typeof node.value === 'string' ? node.value : ''
  // The transform only lifts `key: value` lines; any other yaml came from another parser and has nothing to render.
  if (!isFrontMatter(value)) return NO_DECK_SETTINGS
  const matter = parseFrontMatter(value)
  for (const problem of matter.problems) report('SLIDES_DIRECTIVE_INVALID', node.position, problem)

  const defaults: WritableProperties = { classes: [] }
  for (const [key, argument] of matter.entries) {
    if (!isDirectiveKey(key)) continue
    const spec = directiveSpec(key)
    if (!spec.deckWide) continue
    const problem = spec.problem(argument)
    if (problem === undefined) spec.apply(defaults, argument)
    else report('SLIDES_DIRECTIVE_INVALID', node.position, `Front matter \`${key}\`: ${problem}`)
  }
  return {
    ...(matter.title === undefined ? {} : { title: matter.title }),
    ...(matter.aspect === undefined ? {} : { aspect: matter.aspect }),
    defaults,
  }
}
