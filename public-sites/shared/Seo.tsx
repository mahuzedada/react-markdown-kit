import type { ReactNode } from 'react'
import sites from './sites.json'

/*
 * Structured data and the FAQ block for the home page and the demo sites
 * (docs/SEO_WORKPLAN.md, milestone A). The JSON-LD is rendered from the same
 * data as the visible markup, so the two cannot drift, and the prerender step
 * in vite-seo.ts puts both into the built index.html.
 */

const ORGANIZATION = { '@type': 'Organization', name: 'ZUI', url: sites.home }
const MIT = 'https://opensource.org/license/mit'

export interface FaqItem {
  readonly question: string
  /** Plain text: it is also the answer in the FAQPage structured data. */
  readonly answer: string
  /** An optional link after the answer, shown on the page only. */
  readonly more?: { readonly href: string; readonly label: string }
}

export function JsonLd({ data }: { readonly data: object }): ReactNode {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}

export interface WebApplicationInput {
  readonly name: string
  readonly url: string
  readonly description: string
}

/** A free, browser-based developer tool: the shape each demo root declares. */
export function webApplication({ name, url, description }: WebApplicationInput): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url,
    description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    license: MIT,
    author: ORGANIZATION,
    isPartOf: { '@type': 'WebSite', name: 'React Markdown Kit', url: sites.home },
  }
}

export interface SoftwareSourceCodeInput {
  readonly name: string
  readonly url: string
  readonly description: string
}

/** The kit as a code base: the shape the home page declares. */
export function softwareSourceCode({ name, url, description }: SoftwareSourceCodeInput): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name,
    url,
    description,
    codeRepository: sites.github,
    programmingLanguage: 'TypeScript',
    runtimePlatform: 'React 18 or newer',
    license: MIT,
    author: ORGANIZATION,
  }
}

function faqPage(items: readonly FaqItem[]): object {
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

export interface FaqProps {
  readonly id: string
  readonly title?: string
  readonly items: readonly FaqItem[]
}

/** The questions people type into a search box, answered in one sentence each. */
export function Faq({ id, title = 'Questions', items }: FaqProps): ReactNode {
  return (
    <section className="site-faq" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <dl>
        {items.map((item) => (
          <div key={item.question}>
            <dt>{item.question}</dt>
            <dd>
              {item.answer}
              {item.more ? (
                <>
                  {' '}
                  <a href={item.more.href}>{item.more.label}</a>
                </>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <JsonLd data={faqPage(items)} />
    </section>
  )
}

/** The npm page of a package. */
export function npmUrl(name: 'renderer' | 'editor' | 'template' | 'mermaid' | 'slides'): string {
  return `https://www.npmjs.com/package/@react-markdown-kit/${name}`
}
