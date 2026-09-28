/** `footer`: a line of plain text at the bottom of the slide. In front matter, on every slide. */
import type { DirectiveSpec } from './directive-key.js'

export const footerDirective = {
  key: 'footer',
  deckWide: true,
  problem: (argument) => (argument.trim() !== '' && !argument.includes('\n') ? undefined : 'Expected one line of text.'),
  apply: (properties, argument) => {
    properties.footer = argument
  },
} as const satisfies DirectiveSpec<'footer'>
