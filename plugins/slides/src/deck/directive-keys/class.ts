/** `class`: class tokens for `data-rmk-slide-class`. Repeats accumulate, after the deck's own. */
import type { DirectiveSpec } from './directive-key.js'
import { isToken } from './directive-key.js'

/** Tokens split on commas and spaces, or undefined when any token is not a class name. */
export function classTokens(argument: string): readonly string[] | undefined {
  const tokens = argument.split(/[\s,]+/).filter((token) => token !== '')
  if (tokens.length === 0 || !tokens.every(isToken)) return undefined
  return tokens
}

export const classDirective = {
  key: 'class',
  deckWide: true,
  problem: (argument) =>
    classTokens(argument) === undefined ? 'Expected class names made of letters, digits, `-` and `_`, separated by spaces or commas.' : undefined,
  apply: (properties, argument) => {
    properties.classes = [...properties.classes, ...(classTokens(argument) ?? [])]
  },
} as const satisfies DirectiveSpec<'class'>
