/**
 * `src`: another Markdown file whose slides go here. The renderer cannot
 * read files, so `includeDeckFiles` expands it in the source before
 * compiling; one that reaches the reader was not expanded and is reported.
 */
import type { DirectiveSpec } from './directive-key.js'
import { isUrl } from './directive-key.js'

export const srcDirective = {
  key: 'src',
  deckWide: false,
  problem: (argument) => (isUrl(argument) ? undefined : 'Expected one path with no spaces.'),
  apply: () => undefined,
  notice: 'SLIDES_INCLUDE_UNRESOLVED',
} as const satisfies DirectiveSpec<'src'>
