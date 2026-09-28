/** Every pass a rendered slide block goes through, in order. */
import type { BlockEnhancer } from './block-enhancer.js'
import { codeSteps } from './code-steps.js'
import { incrementalList } from './incremental-list.js'

export const BLOCK_ENHANCERS: readonly BlockEnhancer[] = [incrementalList, codeSteps]
