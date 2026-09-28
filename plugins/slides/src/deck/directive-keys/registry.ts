/** Every directive key the dialect knows. A new directive is a new module listed here. */
import { backgroundDirective } from './background.js'
import { classDirective } from './class.js'
import type { DirectiveSpec } from './directive-key.js'
import { footerDirective } from './footer.js'
import { imageDirective } from './image.js'
import { incrementalDirective } from './incremental.js'
import { layoutDirective } from './layout.js'
import { nameDirective } from './name.js'
import { paginateDirective } from './paginate.js'
import { srcDirective } from './src.js'
import { transitionDirective } from './transition.js'

export const DIRECTIVE_KEYS = [
  classDirective,
  backgroundDirective,
  nameDirective,
  layoutDirective,
  imageDirective,
  transitionDirective,
  footerDirective,
  paginateDirective,
  incrementalDirective,
  srcDirective,
] as const

export type DirectiveKey = (typeof DIRECTIVE_KEYS)[number]['key']

const BY_KEY = new Map<string, DirectiveSpec>(DIRECTIVE_KEYS.map((spec) => [spec.key, spec]))

export function isDirectiveKey(key: string): key is DirectiveKey {
  return BY_KEY.has(key)
}

export function directiveSpec(key: DirectiveKey): DirectiveSpec {
  return BY_KEY.get(key)!
}
