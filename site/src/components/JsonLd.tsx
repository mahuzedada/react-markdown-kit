import type { ReactNode } from 'react'
import sites from '@site/src/sites'

/*
 * Structured data (docs/SEO_WORKPLAN.md, milestone A item 6): SoftwareSourceCode
 * on the package funnels, TechArticle on the guides and docs, breadcrumbs,
 * FAQPage. Rendered inline where the page renders it; crawlers read JSON-LD
 * anywhere in the document.
 */

const MIT = 'https://opensource.org/license/mit'
const SITE_NAME = 'React Markdown Kit'

export const ORGANIZATION = { '@type': 'Organization', name: 'ZUI', url: sites.home }

export function JsonLd({ data }: { readonly data: object }): ReactNode {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}

export interface PackageJsonLdProps {
  readonly name: 'renderer' | 'editor' | 'variables' | 'mermaid' | 'slides'
  readonly description: string
  readonly path: string
}

/** A package funnel: the package as source code, with its npm page. */
export function PackageJsonLd({ name, description, path }: PackageJsonLdProps): ReactNode {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: `@react-markdown-kit/${name}`,
        description,
        url: `${sites.home}${path}`,
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

/** A guide, a doc or a comparison page. */
export function ArticleJsonLd({ headline, description, path }: ArticleJsonLdProps): ReactNode {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline,
        description,
        url: `${sites.home}${path}`,
        inLanguage: 'en',
        author: ORGANIZATION,
        publisher: ORGANIZATION,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: sites.home },
      }}
    />
  )
}

export interface Crumb {
  readonly name: string
  /** Site-relative path. The last crumb usually has none: Google wants `item` on every crumb but the last. */
  readonly path?: string
}

export function BreadcrumbJsonLd({ trail }: { readonly trail: readonly Crumb[] }): ReactNode {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          ...(crumb.path === undefined ? {} : { item: `${sites.home}${crumb.path}` }),
        })),
      }}
    />
  )
}

export interface FaqEntry {
  readonly question: string
  readonly answer: string
}

/** The FAQ section of a page as FAQPage structured data; the visible answers must say the same. */
export function faqPage(items: readonly FaqEntry[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

export function FaqJsonLd({ items }: { readonly items: readonly FaqEntry[] }): ReactNode {
  return <JsonLd data={faqPage(items)} />
}
