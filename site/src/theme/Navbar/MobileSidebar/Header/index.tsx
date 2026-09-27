/*
 * Swizzled mobile sidebar header: the close button is the zui Button.
 */
import type { ReactNode } from 'react'
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal'
import { translate } from '@docusaurus/Translate'
import NavbarColorModeToggle from '@theme/Navbar/ColorModeToggle'
import IconClose from '@theme/Icon/Close'
import NavbarLogo from '@theme/Navbar/Logo'
import Button from '@zuilib/primitives/button'

function CloseButton(): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar()
  return (
    <Button
      variant="ghost"
      size="icon"
      track="navbar:menu-close"
      className="ml-auto"
      aria-label={translate({
        id: 'theme.docs.sidebar.closeSidebarButtonAriaLabel',
        message: 'Close navigation bar',
        description: 'The ARIA label for close button of mobile sidebar',
      })}
      onClick={() => mobileSidebar.toggle()}
    >
      <IconClose color="var(--ifm-color-emphasis-600)" />
    </Button>
  )
}

export default function NavbarMobileSidebarHeader(): ReactNode {
  return (
    <div className="navbar-sidebar__brand">
      <NavbarLogo />
      <NavbarColorModeToggle className="margin-right--md" />
      <CloseButton />
    </div>
  )
}
