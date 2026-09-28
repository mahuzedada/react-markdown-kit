/** `paginate`: `true` shows the slide number in the footer. `false` on one slide hides a deck-wide `true`. */
import type { DirectiveSpec } from './directive-key.js'
import { flagProblem, flagValue } from './flag.js'

export const paginateDirective = {
  key: 'paginate',
  deckWide: true,
  problem: flagProblem,
  apply: (properties, argument) => {
    properties.paginate = flagValue(argument)
  },
} as const satisfies DirectiveSpec<'paginate'>
