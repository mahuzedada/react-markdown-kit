import type { ReactNode } from 'react'
import Head from '@docusaurus/Head'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import sites from '@site/src/sites'

/*
 * Structured data for the docs site (docs/SEO_WORKPLAN.md, milestone A item 6):
 * SoftwareSourceCode on the package funnels and TechArticle on the guides in
 * src/pages. Docs under /docs get theirs from src/theme/DocItem/Content.
 */

const MIT = 'https://opensource.org/license/mit'

export const ORGANIZATION = { '@type': 'Organization', name: 'ZUI', url: sites.home }

export function JsonLd({ data }: { readonly data: object }): ReactNode {
  return (
    <Head>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Head>
  )
}

export interface PackageJsonLdProps {
  readonly name: 'renderer' | 'editor' | 'template' | 'mermaid' | 'slides'
  readonly description: string
  readonly path: string
}

/** A package funnel: the package as source code, with its npm page. */
export function PackageJsonLd({ name, description, path }: PackageJsonLdProps): ReactNode {
  const { siteConfig } = useDocusaurusContext()
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: `@react-markdown-kit/${name}`,
        description,
        url: `${siteConfig.url}${path}`,
        codeRepository: sites.github,
        programmingLanguage: 'TypeScript',
        runtimePlatform: 'React 18 or newer',
        license: MIT,
        author: ORGANIZATION,
        sameAs: `https://www.npmjs.com/package/@react-markdown-kit/${name}`,
      }}
    />
  )
}

export interface ArticleJsonLdProps {
  readonly headline: string
  readonly description: string
  readonly path: string
}

/** A guide or a comparison page. */
export function ArticleJsonLd({ headline, description, path }: ArticleJsonLdProps): ReactNode {
  const { siteConfig } = useDocusaurusContext()
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline,
        description,
        url: `${siteConfig.url}${path}`,
        inLanguage: 'en',
        author: ORGANIZATION,
        publisher: ORGANIZATION,
        isPartOf: { '@type': 'WebSite', name: siteConfig.title, url: siteConfig.url },
      }}
    />
  )
}
