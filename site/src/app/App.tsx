import type { ReactNode } from 'react'
import { SiteActivity } from '../lib/Activity'
import ArticleLayout from '../layouts/ArticleLayout'
import DocLayout from '../layouts/DocLayout'
import { MDX_COMPONENTS } from '../components/Prose'
import { PageContext } from './page-context'
import type { PageEntry, PageModule } from './routes'

/*
 * One page of the site. A doc and an article are MDX content in their
 * layout; a React page (the home page, a demo) renders its own layout.
 */
export default function App({ page, module }: { readonly page: PageEntry; readonly module: PageModule }): ReactNode {
  const Content = module.default
  const toc = page.hideToc ? [] : (module.toc ?? [])
  return (
    <PageContext.Provider value={page}>
      <SiteActivity site="docs" dev={import.meta.env.DEV}>
        {page.kind === 'doc' ? (
          <DocLayout toc={toc}>
            <Content components={MDX_COMPONENTS} />
          </DocLayout>
        ) : page.kind === 'article' ? (
          <ArticleLayout toc={toc}>
            <Content components={MDX_COMPONENTS} />
          </ArticleLayout>
        ) : (
          <Content />
        )}
      </SiteActivity>
    </PageContext.Provider>
  )
}
