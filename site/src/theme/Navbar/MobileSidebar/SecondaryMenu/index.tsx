/*
 * Swizzled mobile sidebar secondary menu (the docs sidebar inside the mobile
 * menu): the back button is the zui Button.
 */
import type { ReactNode } from 'react'
import { useThemeConfig } from '@docusaurus/theme-common'
import { useNavbarSecondaryMenu } from '@docusaurus/theme-common/internal'
import Translate from '@docusaurus/Translate'
import Button from '@zuilib/primitives/button'

export default function NavbarMobileSidebarSecondaryMenu(): ReactNode {
  const isPrimaryMenuEmpty = useThemeConfig().navbar.items.length === 0
  const secondaryMenu = useNavbarSecondaryMenu()
  return (
    <>
      {/* With no primary menu there is nothing to go back to. */}
      {!isPrimaryMenuEmpty && (
        <Button
          variant="ghost"
          fullWidth
          track="navbar:menu-back"
          className="mb-1 justify-start"
          onClick={() => secondaryMenu.hide()}
        >
          <Translate
            id="theme.navbar.mobileSidebarSecondaryMenu.backButtonLabel"
            description="The label of the back button to return to main menu, inside the mobile navbar sidebar secondary menu (notably used to display the docs sidebar)"
          >
            ← Back to main menu
          </Translate>
        </Button>
      )}
      {secondaryMenu.content}
    </>
  )
}
