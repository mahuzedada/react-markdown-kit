import type { ComponentType } from 'react'
import pages from 'virtual:pages'
import type { PageEntry, TocItem } from '../../vite/pages'

export type { PageEntry, TocItem }

/** The head of a React page (`src/pages/*.tsx`), exported as `meta`. MDX pages take theirs from front matter. */
export interface PageMeta {
  /** Without the site name, which the head appends. */
  readonly title: string
  readonly description: string
  readonly keywords?: readonly string[]
  /** The social card, a site path such as `/img/social-card-mermaid.png`. */
  readonly image?: string
  /** Extra stylesheets, such as a font a demo draws with. */
  readonly stylesheets?: readonly string[]
}

export interface PageModule {
  readonly default: ComponentType<{ components?: object }>
  readonly meta?: PageMeta
  readonly toc?: readonly TocItem[]
}

const modules = import.meta.glob<PageModule>(['/docs/**/*.mdx', '/src/pages/**/*.{mdx,tsx}'])

export { pages }

/** `/docs/mermaid/` and `/docs/mermaid` are the same page. */
export function findPage(pathname: string): PageEntry | undefined {
  const route = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return pages.find((page) => page.route === route)
}

export function loadPage(page: PageEntry): Promise<PageModule> {
  const load = modules[`/${page.file}`]
  if (load === undefined) throw new Error(`No module for ${page.file}`)
  return load()
}
