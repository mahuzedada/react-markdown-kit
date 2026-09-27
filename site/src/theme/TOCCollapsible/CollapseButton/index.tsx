/*
 * Swizzled "On this page" toggle of the mobile table of contents: a
 * full-width zui Button with a chevron that points down while collapsed.
 */
import type { ReactNode } from 'react'
import Translate from '@docusaurus/Translate'
import type { Props } from '@theme/TOCCollapsible/CollapseButton'
import Button from '@zuilib/primitives/button'
import { cn } from '@zuilib/primitives/lib/cn'

export default function TOCCollapsibleCollapseButton({ collapsed, className, ...props }: Props): ReactNode {
  return (
    <Button
      variant="ghost"
      fullWidth
      track="toc-toggle"
      aria-expanded={!collapsed}
      className={cn('justify-between font-normal', className)}
      {...props}
    >
      <Translate
        id="theme.TOCCollapsible.toggleButtonLabel"
        description="The label used by the button on the collapsible TOC component"
      >
        On this page
      </Translate>
      <svg
        viewBox="0 0 24 24"
        className={cn('size-4 transition-transform duration-(--duration-fast)', !collapsed && 'rotate-180')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </Button>
  )
}
