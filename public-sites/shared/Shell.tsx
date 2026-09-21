import { useEffect, useState, type ReactNode } from 'react'
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
      <footer className="site-footer">
        <a className="site-brand" href={sites.home}>
          <img src="/logo.svg" alt="" />
          React Markdown Kit
        </a>
        <nav className="site-nav" aria-label="Sites">
          <a href={sites.rendererDemo} aria-current={site === 'renderer' ? 'page' : undefined}>
            Renderer demo
          </a>
          <a href={sites.editorDemo} aria-current={site === 'editor' ? 'page' : undefined}>
            Editor demo
          </a>
          <a href={sites.mermaidDemo} aria-current={site === 'mermaid' ? 'page' : undefined}>
            Mermaid editor
          </a>
          <a href={sites.slidesDemo} aria-current={site === 'slides' ? 'page' : undefined}>
            Slides demo
          </a>
          <a href={sites.docs}>Docs</a>
          <a href={sites.github}>GitHub</a>
          <button type="button" className="site-toggle" onClick={toggle} aria-label="Toggle colour mode">
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </nav>
      </footer>
    </>
  )
}

/** A link into the docs site. Every demo page links out with this. */
export function docsUrl(path: string): string {
  return `${sites.docs}${path}`
}

export { sites }
