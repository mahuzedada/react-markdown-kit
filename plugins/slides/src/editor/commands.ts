/**
 * The three Lexical commands of the deck editor. Each is handled by the
 * plugin `slides()` on the `/editor` entry registers, and is a no-op
 * without it; an application dispatches them on `getNativeEditor()`.
 */
import { createCommand, type LexicalCommand } from 'lexical'
import type { DirectiveKey } from '../deck/directives.js'
import type { MarkerKind } from '../deck/markers.js'

/** Insert a `---` slide break at the selection and put the caret on the new slide. */
export const INSERT_SLIDE_COMMAND: LexicalCommand<undefined> = createCommand('INSERT_SLIDE_COMMAND')

/** Insert a `???` (notes) or `--` (pause) marker at the selection. */
export const INSERT_SLIDE_MARKER_COMMAND: LexicalCommand<{ readonly kind: MarkerKind }> =
  createCommand('INSERT_SLIDE_MARKER_COMMAND')

/**
 * Insert a `<!-- key: argument -->` chip at the selection. An empty
 * `argument` opens the chip for editing; abandoning it empty removes it.
 */
export const INSERT_SLIDE_DIRECTIVE_COMMAND: LexicalCommand<{ readonly key: DirectiveKey; readonly argument: string }> =
  createCommand('INSERT_SLIDE_DIRECTIVE_COMMAND')
