/**
 * `layout`: how a slide is arranged. Each layout's facts live in its spec:
 * whether the body is centred, whether it uses the inverse surface, and
 * which side an image layout gives its picture. The stylesheet draws them
 * from `data-rmk-slide-layout`; the PowerPoint export reads the specs.
 * `two-cols` splits the body at `::right::` (any layout does); `image-left`
 * and `image-right` place the `image` directive's picture.
 */
import type { DirectiveSpec } from './directive-key.js'
import { oneOf } from './directive-key.js'

export interface LayoutSpec {
  readonly centered: boolean
  readonly inverse: boolean
  readonly imageSide?: 'left' | 'right'
}

export const LAYOUT_SPECS = {
  default: { centered: false, inverse: false },
  cover: { centered: true, inverse: false },
  section: { centered: true, inverse: true },
  center: { centered: true, inverse: false },
  'two-cols': { centered: false, inverse: false },
  'image-left': { centered: false, inverse: false, imageSide: 'left' },
  'image-right': { centered: false, inverse: false, imageSide: 'right' },
  quote: { centered: true, inverse: false },
  fact: { centered: true, inverse: false },
} as const satisfies Record<string, LayoutSpec>

export type SlideLayout = keyof typeof LAYOUT_SPECS

export const SLIDE_LAYOUTS = Object.keys(LAYOUT_SPECS) as readonly SlideLayout[]

export function layoutSpec(layout: SlideLayout | undefined): LayoutSpec {
  return LAYOUT_SPECS[layout ?? 'default']
}

export const layoutDirective = {
  key: 'layout',
  deckWide: true,
  problem: oneOf(SLIDE_LAYOUTS),
  apply: (properties, argument) => {
    properties.layout = argument as SlideLayout
  },
} as const satisfies DirectiveSpec<'layout'>
