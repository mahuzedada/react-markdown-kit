import type { ReactNode } from 'react'
import type { PageMeta } from '@site/src/app/routes'
import Shell from '@site/src/layouts/Shell'
import MarkdownDocument from '@site/src/components/document/MarkdownDocument'
import source from '@site/src/content/home.md?raw'
import { BreadcrumbJsonLd, JsonLd, ORGANIZATION } from '@site/src/components/JsonLd'
import sites from '@site/src/sites'

export const meta: PageMeta = {
  title: 'React Markdown renderer and editor docs',
  description: 'Render Markdown as React, add rich editing and personalize the same document with typed variables. The packages all share one Markdown model.',
}

export default function Home(): ReactNode {
  return <Shell>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: 'React Markdown Kit',
      description: meta.description, url: sites.docs, codeRepository: sites.github, programmingLanguage: 'TypeScript',
      runtimePlatform: 'React 18 or newer', inLanguage: 'en',
      license: 'https://opensource.org/license/mit', author: ORGANIZATION }} />
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'React Markdown Kit', url: sites.docs, description: meta.description, publisher: ORGANIZATION }} />
    <BreadcrumbJsonLd trail={[{ name: 'React Markdown Kit' }]} />
    <main className="document-reading"><MarkdownDocument source={source} /></main>
  </Shell>
}
