import { useState, type ReactNode } from 'react'
import Button from '@zuilib/primitives/button'
import Drawer from '@zuilib/primitives/drawer'
import { cn } from '@zuilib/primitives/lib/cn'
import { usePage } from '../app/page-context'
import { FOOTER, NAVBAR, NAVBAR_END, isExternal, type NavLink } from '../app/navigation'
import { ExternalIcon, MenuIcon, MoonIcon, SunIcon } from '../components/icons'
import { useTheme } from '../lib/useTheme'

/*
 * The frame of every page: the navbar, always dark as in Foundry, and the
 * footer. Layouts put their content between the two.
 */

export interface ShellProps {
  readonly children: ReactNode
  /** Classes on the element between navbar and footer, such as a demo's height variable. */
  readonly className?: string
  /** Shown in the mobile menu under the site links: the docs sidebar on a doc. */
  readonly menu?: ReactNode
}

function isActive(route: string | undefined, href: string): boolean {
  if (route === undefined) return false
  return route === href || (href.startsWith('/docs/') && route.startsWith('/docs/'))
}

function NavItem({ link, className }: { readonly link: NavLink; readonly className?: string }): ReactNode {
  const route = usePage()?.route
  const active = isActive(route, link.href)
  return (
    <a
      href={link.href}
      data-zui-tag={`navbar:${link.label.toLowerCase().replace(/\W+/g, '-')}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-(--radius) px-2.5 py-1.5 font-medium whitespace-nowrap no-underline',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {link.label}
      {isExternal(link.href) ? <ExternalIcon className="size-3.5" /> : null}
    </a>
  )
}

function ThemeToggle(): ReactNode {
  const { toggle } = useTheme()
  return (
    <Button variant="ghost" size="icon" track="navbar:theme" onClick={toggle} aria-label="Switch between dark and light mode" title="Switch between dark and light mode">
      {/* Both icons render; `html[data-theme]` picks one, so it is right before hydration too. */}
      <SunIcon className="hidden size-4 [html[data-theme=light]_&]:inline" />
      <MoonIcon className="hidden size-4 [html[data-theme=dark]_&]:inline" />
    </Button>
  )
}

function MobileMenu({ menu }: { readonly menu?: ReactNode }): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" size="icon" track="navbar:menu" className="xl:hidden" onClick={() => setOpen(true)} aria-label="Open the menu">
        <MenuIcon className="size-5" />
      </Button>
      <Drawer track="navbar-menu" open={open} onOpenChange={setOpen} side="start" size="sm">
        <Drawer.Panel>
          <Drawer.Header>
            <Drawer.Title>React Markdown Kit</Drawer.Title>
            <Drawer.Close />
          </Drawer.Header>
          <Drawer.Body>
            <nav className="flex flex-col">
              {[...NAVBAR, ...NAVBAR_END].map((link) => (
                <NavItem key={link.href} link={link} />
              ))}
            </nav>
            {menu ? <div className="mt-4 border-t border-border pt-4">{menu}</div> : null}
          </Drawer.Body>
        </Drawer.Panel>
      </Drawer>
    </>
  )
}

function Navbar({ menu }: { readonly menu?: ReactNode }): ReactNode {
  return (
    <header className="dark sticky top-0 z-40 print:hidden border-b border-border bg-background text-foreground">
      <nav className="flex h-(--navbar-height) items-center gap-1 px-3">
        <MobileMenu menu={menu} />
        <a href="/" data-zui-tag="brand" className="me-3 flex items-center gap-2 font-semibold whitespace-nowrap text-foreground no-underline">
          <img src="/img/logo.svg" alt="" width="28" height="28" />
          React Markdown Kit
        </a>
        <div className="hidden items-center xl:flex">
          {NAVBAR.map((link) => (
            <NavItem key={link.href} link={link} />
          ))}
        </div>
        <div className="ms-auto flex items-center">
          {NAVBAR_END.map((link) => (
            <NavItem key={link.href} link={link} className="hidden xl:inline-flex" />
          ))}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}

function Footer(): ReactNode {
  return (
    <footer className="border-t border-border bg-sidebar text-muted-foreground print:hidden">
      <div className="mx-auto grid max-w-(--width-wide) grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-8 px-4 py-10">
        {FOOTER.map((column) => (
          <div key={column.title}>
            <p className="m-0 mb-3 font-semibold">{column.title}</p>
            <ul className="m-0 list-none space-y-2 p-0">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="inline-flex items-center gap-1 text-sidebar-foreground no-underline hover:text-primary-text">
                    {link.label}
                    {isExternal(link.href) ? <ExternalIcon className="size-3.5" /> : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="m-0 pb-8 text-center text-sm">React Markdown Kit by ZUI. MIT licensed.</p>
    </footer>
  )
}

export default function Shell({ children, className, menu }: ShellProps): ReactNode {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar menu={menu} />
      <div className={cn('flex-1', className)}>{children}</div>
      <Footer />
    </div>
  )
}
