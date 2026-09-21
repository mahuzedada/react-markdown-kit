import type { ReactNode } from 'react'
import Content from '@theme-original/DocItem/Content'
import type ContentType from '@theme/DocItem/Content'
import type { WrapperProps } from '@docusaurus/types'
import Head from '@docusaurus/Head'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { useDoc, useSidebarBreadcrumbs } from '@docusaurus/plugin-content-docs/client'
import { ORGANIZATION } from '@site/src/components/JsonLd'

type Props = WrapperProps<typeof ContentType>

/**
 * Every page under /docs carries TechArticle and BreadcrumbList structured
 * data built from the doc's own metadata and its sidebar position
 * (docs/SEO_WORKPLAN.md, milestone A item 6).
 */
export default function ContentWrapper(props: Props): ReactNode {
  const { siteConfig } = useDocusaurusContext()
  const { metadata } = useDoc()
  const breadcrumbs = useSidebarBreadcrumbs() ?? []
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

  // Google wants an `item` on every crumb but the last, so unlinked categories
  // are left out of the trail.
  const last = breadcrumbs.length - 1
  const trail = [
    { label: 'Docs', href: '/docs/getting-started' },
    ...breadcrumbs.filter((crumb, index) => crumb.href !== undefined || index === last),
  ]
  const list = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      ...(crumb.href !== undefined ? { item: `${siteConfig.url}${crumb.href}` } : {}),
    })),
  }

  return (
    <>
      <Head>
        <script type="application/ld+json">{JSON.stringify(article)}</script>
        <script type="application/ld+json">{JSON.stringify(list)}</script>
      </Head>
      <Content {...props} />
    </>
  )
}
