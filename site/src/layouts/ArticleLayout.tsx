import type { ReactNode } from 'react'
import { cn } from '@zuilib/primitives/lib/cn'
import Layout from '@theme/Layout'
import TOC from '@theme/TOC'
import { PageMetadata } from '@docusaurus/theme-common'
import type { Props as TOCProps } from '@theme/TOC'

/*
 * The layout of the long-form pages at the site root (the funnel, guide and
 * comparison pages in src/pages): one reading column with the page's table
 * of contents beside it. Every Markdown page there gets it through the
 * swizzled MDXPage; a TSX page can use it directly.
 */

export interface ArticleLayoutProps {
  readonly title?: string
  readonly description?: string
  readonly keywords?: readonly string[]
  readonly image?: string
  readonly toc?: TOCProps['toc']
  /** Front matter `hide_table_of_contents`: the article takes the full width. */
  readonly hideToc?: boolean
  readonly tocMinHeadingLevel?: number
  readonly tocMaxHeadingLevel?: number
  /** Under the article: the last-updated line. */
  readonly footer?: ReactNode
  readonly children: ReactNode
}

export default function ArticleLayout({
  title,
  description,
  keywords,
  image,
  toc = [],
  hideToc = false,
  tocMinHeadingLevel,
  tocMaxHeadingLevel,
  footer,
  children,
}: ArticleLayoutProps): ReactNode {
  return (
    <Layout>
      <PageMetadata title={title} description={description} keywords={keywords ? [...keywords] : undefined} image={image} />
      <main className="container container--fluid margin-vert--lg">
        <div className="row justify-center">
          <div className={cn('col', !hideToc && 'col--8')}>
            <article>{children}</article>
            {footer}
          </div>
          {!hideToc && toc.length > 0 ? (
            <div className="col col--2">
              <TOC toc={toc} minHeadingLevel={tocMinHeadingLevel} maxHeadingLevel={tocMaxHeadingLevel} />
            </div>
          ) : null}
        </div>
      </main>
    </Layout>
  )
}
