import type { ReactNode } from 'react'
import Content from '@theme-original/DocItem/Content'
import type ContentType from '@theme/DocItem/Content'
import type { WrapperProps } from '@docusaurus/types'
import Head from '@docusaurus/Head'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { useDoc } from '@docusaurus/plugin-content-docs/client'
import { ORGANIZATION } from '@site/src/components/JsonLd'

type Props = WrapperProps<typeof ContentType>

/**
 * Every page under /docs carries TechArticle structured data built from the
 * doc's own metadata (docs/SEO_WORKPLAN.md, milestone A item 6). The
 * BreadcrumbList comes from Docusaurus itself (DocBreadcrumbs), so none is
 * added here: one trail per page.
 */
export default function ContentWrapper(props: Props): ReactNode {
  const { siteConfig } = useDocusaurusContext()
  const { metadata } = useDoc()
  const url = `${siteConfig.url}${metadata.permalink}`

  const article = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: metadata.title,
    description: metadata.description,
    url,
    inLanguage: 'en',
    author: ORGANIZATION,
    publisher: ORGANIZATION,
    isPartOf: { '@type': 'WebSite', name: siteConfig.title, url: siteConfig.url },
  }

  return (
    <>
      <Head>
        <script type="application/ld+json">{JSON.stringify(article)}</script>
      </Head>
      <Content {...props} />
    </>
  )
}
