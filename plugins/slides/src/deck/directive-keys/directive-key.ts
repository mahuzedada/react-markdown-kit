/**
 * The contract every directive key implements. `<!-- key: argument -->`
 * is validated by `problem` and, when accepted, written onto the slide's
 * properties by `apply`. A key with `deckWide` may also appear in the
 * front matter, where it sets the default for every slide. Registering a
 * spec in `registry.ts` is all a new directive needs: the transform, the
 * reader, the front matter and the editor's chip all look keys up there.
 */
import type { SlidesDiagnosticCode } from '../diagnostics.js'
import type { WritableProperties } from '../slide-draft.js'

export interface DirectiveSpec<Key extends string = string> {
  readonly key: Key
  /** Why the argument is rejected, or undefined when it is accepted. */
  readonly problem: (argument: string) => string | undefined
  /** Front matter may set it as the default of every slide. */
  readonly deckWide: boolean
  /** Writes an accepted argument onto the properties. */
  readonly apply: (properties: WritableProperties, argument: string) => void
  /** Reported each time the directive is read, for a key that does nothing by itself. */
  readonly notice?: SlidesDiagnosticCode
}

const TOKEN = /^[A-Za-z0-9_-]+$/

/** A problem function accepting only the listed values. */
export function oneOf(values: readonly string[]): (argument: string) => string | undefined {
  return (argument) => (values.includes(argument) ? undefined : `Expected one of ${values.map((value) => `\`${value}\``).join(', ')}.`)
}

export function isToken(argument: string): boolean {
  return TOKEN.test(argument)
}

export function isUrl(argument: string): boolean {
  return /^\S+$/.test(argument)
}
