import type { ReactNode } from 'react'
import { cn } from '@zuilib/primitives/lib/cn'
import { usePage } from '../app/page-context'
import { DOCS_ORDER, DOCS_SIDEBAR, type SidebarItem } from '../app/navigation'
import { pages, type PageEntry, type TocItem } from '../app/routes'
import { ArticleJsonLd, BreadcrumbJsonLd } from '../components/JsonLd'
import Reading, { LastUpdated } from './Reading'
import Shell from './Shell'

/*
 * The pages under /docs: the docs sidebar, the reading column with its table
 * of contents, the previous and next doc, and TechArticle structured data
 * with a one-crumb trail (docs/SEO_WORKPLAN.md, milestone A item 6).
 */

function doc(id: string): PageEntry {
  const found = pages.find((page) => page.route === `/docs/${id}`)
  if (found === undefined) throw new Error(`The docs sidebar names docs/${id}.mdx, which does not exist`)
  return found
}

const label = (page: PageEntry): string => page.sidebarLabel ?? page.title ?? page.route

function SidebarLink({ id, current }: { readonly id: string; readonly current: string }): ReactNode {
  const page = doc(id)
  const active = page.route === current
  return (
    <a
      href={page.route}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'block rounded-(--radius) px-2.5 py-1.5 no-underline',
        active ? 'bg-primary/12 font-medium text-primary-text' : 'text-sidebar-foreground hover:bg-sidebar-accent',
      )}
    >
      {label(page)}
    </a>
  )
}

function Sidebar({ current }: { readonly current: string }): ReactNode {
  const item = (entry: SidebarItem): ReactNode =>
    typeof entry === 'string' ? (
      <li key={entry}>
        <SidebarLink id={entry} current={current} />
      </li>
    ) : (
      <li key={entry.label}>
        {/* Groups are always open: a label over its links. */}
        <span className="document-directory-group">{entry.label}</span>
        <ul className="m-0 list-none p-0 ps-3">{entry.items.map((id) => item(id))}</ul>
      </li>
    )
  return (
    <nav aria-label="Docs">
      <ul className="m-0 list-none space-y-0.5 p-0">{DOCS_SIDEBAR.map(item)}</ul>
    </nav>
  )
}

function Pager({ current }: { readonly current: string }): ReactNode {
  const index = DOCS_ORDER.findIndex((id) => doc(id).route === current)
  const previous = index > 0 ? doc(DOCS_ORDER[index - 1]) : undefined
  const next = index >= 0 && index < DOCS_ORDER.length - 1 ? doc(DOCS_ORDER[index + 1]) : undefined
  const card = (page: PageEntry, direction: 'Previous' | 'Next'): ReactNode => (
    <a
      href={page.route}
      className={cn('block border-t border-border py-3 no-underline', direction === 'Next' && 'text-end')}
    >
      <span className="block text-sm text-muted-foreground">{direction}</span>
      <span className="font-medium text-primary-text">{label(page)}</span>
    </a>
  )
  return (
    <nav aria-label="Docs pages" className="mt-12 grid grid-cols-2 gap-4">
      <div>{previous ? card(previous, 'Previous') : null}</div>
      <div>{next ? card(next, 'Next') : null}</div>
    </nav>
  )
}

export default function DocLayout({ toc, children }: { readonly toc: readonly TocItem[]; readonly children: ReactNode }): ReactNode {
  const page = usePage() as PageEntry
  const sidebar = <Sidebar current={page.route} />
  return (
    <Shell menu={sidebar}>
          <Reading
            toc={toc}
            footer={
              <>
                <LastUpdated date={page.lastUpdated} />
                <Pager current={page.route} />
              </>
            }
          >
            {children}
          </Reading>
      <BreadcrumbJsonLd trail={[{ name: label(page), path: page.route }]} />
      <ArticleJsonLd headline={page.title ?? label(page)} description={page.description ?? ''} path={page.route} />
    </Shell>
  )
}
