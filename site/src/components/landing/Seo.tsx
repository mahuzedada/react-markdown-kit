import type { ReactNode } from 'react'
import sites from '../../sites.json'
import { JsonLd, ORGANIZATION, faqPage } from '../JsonLd'

/*
 * Structured data and the FAQ block for the home page and the demo pages
 * (docs/SEO_WORKPLAN.md, milestone A). The JSON-LD is rendered from the same
 * data as the visible markup, so the two cannot drift.
 */

export { JsonLd }

const MIT = 'https://opensource.org/license/mit'

export interface FaqItem {
  readonly question: string
  /** Plain text: it is also the answer in the FAQPage structured data. */
  readonly answer: string
  /** An optional link after the answer, shown on the page only. */
  readonly more?: { readonly href: string; readonly label: string }
}

export interface WebApplicationInput {
  readonly name: string
  readonly url: string
  readonly description: string
}

/** A free, browser-based developer tool: the shape each demo page declares. */
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

export interface FaqProps {
  readonly id: string
  readonly title?: string
  readonly items: readonly FaqItem[]
}

/** The questions people type into a search box, answered in one sentence each. Sits inside `Prose`. */
export function Faq({ id, title = 'Questions', items }: FaqProps): ReactNode {
  return (
    <section data-faq aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <dl>
        {items.map((item) => (
          <div key={item.question} className="mt-5">
            <dt className="mb-1 font-semibold">{item.question}</dt>
            <dd className="m-0">
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
export function npmUrl(name: 'renderer' | 'editor' | 'variables' | 'mermaid' | 'slides'): string {
  return `https://www.npmjs.com/package/@react-markdown-kit/${name}`
}
