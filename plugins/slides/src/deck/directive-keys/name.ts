/** `name`: the slide's id (`slide-<name>`) for deep links. Unique per deck, so never deck-wide. */
import type { DirectiveSpec } from './directive-key.js'
import { isToken } from './directive-key.js'

export const nameDirective = {
  key: 'name',
  deckWide: false,
  problem: (argument) => (isToken(argument) ? undefined : 'Expected a name made of letters, digits, `-` and `_`.'),
  apply: (properties, argument) => {
    properties.name = argument
  },
} as const satisfies DirectiveSpec<'name'>
