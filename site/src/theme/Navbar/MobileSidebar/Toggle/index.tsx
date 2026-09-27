/*
 * Swizzled mobile navbar toggle: the zui Button. Infima's `navbar__toggle`
 * display rules sit in a lower layer than the Button's `inline-flex`, so the
 * toggle hides above Infima's 996px breakpoint with its own utilities.
 */
import type { ReactNode } from 'react'
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal'
import { translate } from '@docusaurus/Translate'
import IconMenu from '@theme/Icon/Menu'
import Button from '@zuilib/primitives/button'

export default function MobileSidebarToggle(): ReactNode {
  const { toggle, shown } = useNavbarMobileSidebar()
  return (
    <Button
      variant="ghost"
      size="icon"
      track="navbar:menu"
      className="navbar__toggle hidden text-inherit max-[996px]:inline-flex"
      onClick={toggle}
      aria-label={translate({
        id: 'theme.docs.sidebar.toggleSidebarButtonAriaLabel',
        message: 'Toggle navigation bar',
        description: 'The ARIA label for hamburger menu button of mobile navigation',
      })}
      aria-expanded={shown}
    >
      <IconMenu />
    </Button>
  )
}
