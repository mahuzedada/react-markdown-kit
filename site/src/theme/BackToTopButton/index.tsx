/*
 * Swizzled back-to-top button: the zui Button, round and fixed to the
 * bottom-right corner. It scales in after 300px of scrolling.
 */
import type { ReactNode } from 'react'
import { translate } from '@docusaurus/Translate'
import { ThemeClassNames } from '@docusaurus/theme-common'
import { useBackToTopButton } from '@docusaurus/theme-common/internal'
import Button from '@zuilib/primitives/button'
import { cn } from '@zuilib/primitives/lib/cn'

export default function BackToTopButton(): ReactNode {
  const { shown, scrollToTop } = useBackToTopButton({ threshold: 300 })
  return (
    <Button
      variant="outline"
      size="icon"
      track="back-to-top"
      className={cn(
        ThemeClassNames.common.backToTopButton,
        'fixed right-5 bottom-5 z-[calc(var(--ifm-z-index-fixed)-1)] size-12 rounded-full shadow-md',
        'invisible scale-0 opacity-0 transition-[opacity,scale,visibility] duration-(--duration-fast)',
        shown && 'visible scale-100 opacity-100',
      )}
      aria-label={translate({
        id: 'theme.BackToTopButton.buttonAriaLabel',
        message: 'Scroll back to top',
        description: 'The ARIA label for the back to top button',
      })}
      onClick={scrollToTop}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m18 15-6-6-6 6" />
      </svg>
    </Button>
  )
}
