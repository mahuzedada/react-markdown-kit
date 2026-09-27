import { useEffect, useState, type ReactNode } from 'react'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import sites from './sites.json'

type Theme = 'light' | 'dark'
type Site = 'home' | 'renderer' | 'editor' | 'mermaid' | 'slides'

const STORAGE_KEY = 'theme'

function readTheme(): Theme {
  return document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable; the attribute alone is enough for this visit.
  }
}

const SITE_LINKS: readonly { label: string; href: string; track: string; site?: Site }[] = [
  { label: 'Renderer demo', href: sites.rendererDemo, track: 'renderer', site: 'renderer' },
  { label: 'Editor demo', href: sites.editorDemo, track: 'editor', site: 'editor' },
  { label: 'Mermaid editor', href: sites.mermaidDemo, track: 'mermaid', site: 'mermaid' },
  { label: 'Slides demo', href: sites.slidesDemo, track: 'slides', site: 'slides' },
  { label: 'Docs', href: sites.docs, track: 'docs' },
  { label: 'GitHub', href: sites.github, track: 'github' },
]

export interface ShellProps {
  readonly site: Site
  readonly children: ReactNode
}

export interface ThemeState {
  readonly theme: Theme
  readonly toggle: () => void
}

/**
 * The colour mode, read from `<html data-theme>` after mount (index.html sets
 * it before paint) and written back with the choice remembered. Any control
 * on a page can toggle it: the footer here, or a page's own header.
 */
export function useTheme(): ThemeState {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(readTheme())
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const toggle = (): void => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return { theme, toggle }
}

export function Shell({ site, children }: ShellProps): ReactNode {
  const { theme, toggle } = useTheme()

  return (
    <>
      {children}
      <ActivityScope feature="footer">
        <footer className="mx-auto flex print:hidden max-w-(--container-width-md) flex-wrap items-center gap-x-4 gap-y-3 border-t border-border px-4 pt-5 pb-10">
          <a className="flex items-center gap-2 font-semibold whitespace-nowrap text-foreground no-underline" href={sites.home} data-zui-tag="brand">
            <img src="/logo.svg" alt="" className="size-6" />
            React Markdown Kit
          </a>
          <nav className="ml-auto flex flex-wrap items-center gap-1" aria-label="Sites">
            {SITE_LINKS.map((link) => (
              <Button
                key={link.track}
                as="a"
                href={link.href}
                variant="ghost"
                size="sm"
                track={link.track}
                aria-current={link.site === site ? 'page' : undefined}
                className="aria-[current=page]:font-semibold aria-[current=page]:text-primary-text"
              >
                {link.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" track="theme" onClick={toggle} aria-label="Toggle colour mode">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
          </nav>
        </footer>
      </ActivityScope>
    </>
  )
}

/** A link into the docs site. Every demo page links out with this. */
export function docsUrl(path: string): string {
  return `${sites.docs}${path}`
}

export { sites }
