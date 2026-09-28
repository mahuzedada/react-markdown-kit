/** `incremental`: `true` reveals each item of the slide's root-level lists one step at a time. */
import type { DirectiveSpec } from './directive-key.js'
import { flagProblem, flagValue } from './flag.js'

export const incrementalDirective = {
  key: 'incremental',
  deckWide: true,
  problem: flagProblem,
  apply: (properties, argument) => {
    properties.incremental = flagValue(argument)
  },
} as const satisfies DirectiveSpec<'incremental'>
