/** `image`: the picture an `image-left` or `image-right` layout shows beside the body. */
import type { DirectiveSpec } from './directive-key.js'
import { isUrl } from './directive-key.js'

export const imageDirective = {
  key: 'image',
  deckWide: false,
  problem: (argument) => (isUrl(argument) ? undefined : 'Expected one URL with no spaces.'),
  apply: (properties, argument) => {
    properties.image = argument
  },
} as const satisfies DirectiveSpec<'image'>
