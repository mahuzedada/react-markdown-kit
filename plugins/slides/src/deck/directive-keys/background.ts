/** `background`: one URL, rendered as an <img> behind the slide so the URL policy checks it. */
import type { DirectiveSpec } from './directive-key.js'
import { isUrl } from './directive-key.js'

export const backgroundDirective = {
  key: 'background',
  deckWide: true,
  problem: (argument) => (isUrl(argument) ? undefined : 'Expected one URL with no spaces.'),
  apply: (properties, argument) => {
    properties.background = argument
  },
} as const satisfies DirectiveSpec<'background'>
