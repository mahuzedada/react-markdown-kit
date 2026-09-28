/** `true` or `false`, the only arguments a switch directive takes. */
import { oneOf } from './directive-key.js'

export const flagProblem = oneOf(['true', 'false'])

export function flagValue(argument: string): boolean {
  return argument === 'true'
}
