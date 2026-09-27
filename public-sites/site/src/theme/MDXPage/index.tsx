/*
 * Swizzled MDX page: every Markdown page in src/pages renders through
 * ArticleLayout, the site's layout for long-form pages. Same markup as the
 * stock MDXPage, which this replaces.
 */
import type { ReactNode } from 'react'
import { cn } from '@zuilib/primitives/lib/cn'
import { HtmlClassNameProvider, ThemeClassNames } from '@docusaurus/theme-common'
import MDXContent from '@theme/MDXContent'
import ContentVisibility from '@theme/ContentVisibility'
import EditMetaRow from '@theme/EditMetaRow'
import type { Props } from '@theme/MDXPage'
import ArticleLayout from '@site/src/layouts/ArticleLayout'

export default function MDXPage({ content: MDXPageContent }: Props): ReactNode {
  const { metadata, assets } = MDXPageContent
  const { title, editUrl, description, frontMatter, lastUpdatedBy, lastUpdatedAt } = metadata
  const { keywords, wrapperClassName, hide_table_of_contents: hideToc } = frontMatter
  const hasEditMetaRow = Boolean(editUrl || lastUpdatedAt || lastUpdatedBy)

  return (
    <HtmlClassNameProvider className={cn(wrapperClassName ?? ThemeClassNames.wrapper.mdxPages, ThemeClassNames.page.mdxPage)}>
      <ArticleLayout
        title={title}
        description={description}
        keywords={keywords}
        image={assets.image ?? frontMatter.image}
        toc={MDXPageContent.toc}
        hideToc={Boolean(hideToc)}
        tocMinHeadingLevel={frontMatter.toc_min_heading_level}
        tocMaxHeadingLevel={frontMatter.toc_max_heading_level}
        footer={
          hasEditMetaRow ? (
            <EditMetaRow
              className={cn('margin-top--sm', ThemeClassNames.pages.pageFooterEditMetaRow)}
              editUrl={editUrl}
              lastUpdatedAt={lastUpdatedAt}
              lastUpdatedBy={lastUpdatedBy}
            />
          ) : undefined
        }
      >
        <ContentVisibility metadata={metadata} />
        <MDXContent>
          <MDXPageContent />
        </MDXContent>
      </ArticleLayout>
    </HtmlClassNameProvider>
  )
}
