import type { ReactNode } from 'react'
import { usePage } from '../app/page-context'
import type { TocItem } from '../app/routes'
import Reading, { LastUpdated } from './Reading'
import Shell from './Shell'

/**
 * The long-form pages at the site root (the funnel, guide and comparison
 * pages in src/pages): the reading column and its table of contents. Each
 * page renders its own structured data.
 */
export default function ArticleLayout({ toc, children }: { readonly toc: readonly TocItem[]; readonly children: ReactNode }): ReactNode {
  const page = usePage()
  return (
    <Shell>
      <Reading toc={toc} footer={page ? <LastUpdated date={page.lastUpdated} /> : null}>
        {children}
      </Reading>
    </Shell>
  )
}
