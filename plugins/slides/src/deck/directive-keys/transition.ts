/** `transition`: how the slide enters in present mode. CSS only, and off under reduced motion. */
import type { DirectiveSpec } from './directive-key.js'
import { oneOf } from './directive-key.js'

export const SLIDE_TRANSITIONS = ['none', 'fade', 'slide', 'zoom'] as const

export type SlideTransition = (typeof SLIDE_TRANSITIONS)[number]

export const transitionDirective = {
  key: 'transition',
  deckWide: true,
  problem: oneOf(SLIDE_TRANSITIONS),
  apply: (properties, argument) => {
    properties.transition = argument as SlideTransition
  },
} as const satisfies DirectiveSpec<'transition'>
