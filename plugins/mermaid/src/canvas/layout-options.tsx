/**
 * Ported from @zuilib/text-editor (MIT). The three block-width presets the
 * canvas toolbar offers (compact / comfortable / full), with their icons.
 */
import type { ReactElement } from 'react'
import type { BlockWidth } from '../core/block-width.js'
import type { DiagramLabelKey } from './labels.js'

export type LayoutPreset = 'compact' | 'comfortable' | 'full'

/**
 * The presets with their icons (20×20 viewBox path children, wrapped by the
 * toolbar's own `<svg>`). Each sets the block width:
 *
 * - compact: shrinks to the content
 * - comfortable: the text column
 * - full: the editor container
 */
export const LAYOUT_OPTIONS: ReadonlyArray<{
  preset: LayoutPreset
  /** Key into the diagram labels */
  label: DiagramLabelKey
  icon: ReactElement
  width: BlockWidth
}> = [
  {
    preset: 'compact',
    label: 'layoutCompact',
    width: 'content',
    icon: (
      <>
        <path d="M3 4v12M17 4v12" />
        <path d="M5.5 10h3M11.5 10h3M6.5 7.5L9 10l-2.5 2.5M13.5 7.5L11 10l2.5 2.5" />
      </>
    ),
  },
  {
    preset: 'comfortable',
    label: 'layoutComfortable',
    width: 'text',
    icon: (
      <>
        <path d="M3 4v12M17 4v12" />
        <path d="M6.5 7h7M6.5 10h7M6.5 13h4.5" />
      </>
    ),
  },
  {
    preset: 'full',
    label: 'layoutFull',
    width: 'full',
    icon: (
      <>
        <path d="M3 4v12M17 4v12" />
        <path d="M6 10h8M8.5 7.5L6 10l2.5 2.5M11.5 7.5L14 10l-2.5 2.5" />
      </>
    ),
  },
]

export function layoutPreset(width: BlockWidth): LayoutPreset {
  return width === 'content' ? 'compact' : width === 'text' ? 'comfortable' : 'full'
}
