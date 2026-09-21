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

/**
 * The demo is the first thing on the page, so there is no header. Everything
 * that is not the demo (the home page, the other sites, the docs, the colour
 * mode) sits in a footer after it. `index.html` sets the initial `data-theme` before paint;
 * the toggle only reads and updates it.
 */
export function Shell({ site, children }: ShellProps): ReactNode {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(readTheme())
  }, [])

  const toggle = (): void => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <>
      {children}
      <ActivityScope feature="footer">
        <footer className="site-footer">
          <a className="site-brand" href={sites.home} data-zui-tag="brand">
            <img src="/logo.svg" alt="" />
            React Markdown Kit
          </a>
          <nav className="site-nav" aria-label="Sites">
            {SITE_LINKS.map((link) => (
              <Button
                key={link.track}
                as="a"
                href={link.href}
                variant="ghost"
                size="sm"
                track={link.track}
                aria-current={link.site === site ? 'page' : undefined}
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
