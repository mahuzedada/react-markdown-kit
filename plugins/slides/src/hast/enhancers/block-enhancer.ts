/**
 * The contract for a pass over one rendered block of a slide. An enhancer
 * may add attributes to the block's elements and take reveal steps from
 * the slide's counter. It mutates the hast it is given, which is the
 * block's own fresh output. Registering one in `registry.ts` is all a new
 * kind of reveal needs.
 */
import type { ElementContent } from 'hast'
import type { SlideModel } from '../../deck/model.js'
import type { FragmentCounter } from '../fragment-counter.js'

export interface EnhanceContext {
  readonly slide: SlideModel
  readonly counter: FragmentCounter
}

export type BlockEnhancer = (block: ElementContent, context: EnhanceContext) => void
