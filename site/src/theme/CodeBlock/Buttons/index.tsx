/*
 * Swizzled code block button group: the stock one styles `button` from an
 * unlayered CSS module, which would beat the zui Button's classes. The group
 * shows on hover or keyboard focus, and always on touch screens.
 */
import type { ReactNode } from 'react'
import BrowserOnly from '@docusaurus/BrowserOnly'
import CopyButton from '@theme/CodeBlock/Buttons/CopyButton'
import WordWrapButton from '@theme/CodeBlock/Buttons/WordWrapButton'
import type { Props } from '@theme/CodeBlock/Buttons'
import { cn } from '@zuilib/primitives/lib/cn'

export default function CodeBlockButtons({ className }: Props): ReactNode {
  return (
    <BrowserOnly>
      {() => (
        <div
          className={cn(
            'absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity duration-(--duration-fast)',
            '[.theme-code-block:hover_&]:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100',
            className,
          )}
        >
          <WordWrapButton />
          <CopyButton />
        </div>
      )}
    </BrowserOnly>
  )
}
