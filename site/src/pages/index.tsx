import type { ReactNode } from 'react'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import sites from '@site/src/sites'
import type { PageMeta } from '@site/src/app/routes'
import CodeBlock from '@site/src/components/CodeBlock'
import { BreadcrumbJsonLd, JsonLd, ORGANIZATION } from '@site/src/components/JsonLd'
import { Feature, Features, Hero, Page } from '@site/src/components/landing/Page'
import Shell from '@site/src/layouts/Shell'

interface PageLink {
  readonly to: string
  readonly label: string
  readonly what: string
}

const GUIDES: readonly PageLink[] = [
  { to: '/markdown-renderer', label: 'Renderer demo', what: 'The whole syntax on one page you can edit, rendered by the component you would ship.' },
  { to: '/docs/guides/render-markdown-in-react', label: 'How to render Markdown in React', what: 'GFM, custom components, links, code blocks, security, server rendering.' },
  { to: '/streaming-markdown', label: 'Streaming Markdown in React', what: 'Every partial prefix renders, plus the two constructs that rewrite themselves.' },
  { to: '/nextjs-markdown', label: 'Markdown in Next.js', what: 'Server components with no client JavaScript, and precompiled documents.' },
  { to: '/markdown-editor', label: 'Editor demo', what: 'Rich, source and preview modes that store plain Markdown.' },
  { to: '/markdown-round-trip', label: 'Lossless Markdown editing', what: '22 of 22 audited documents open and save byte for byte.' },
  { to: '/docs/guides/lexical-markdown-editor', label: 'Lexical Markdown editor', what: 'Why Lexical, how the package wraps it, when to use the headless API.' },
  { to: '/markdown-variables', label: 'Markdown variables', what: 'Typed variables, schemas, formatters and locales, resolved in the parser.' },
  { to: '/docs/guides/markdown-variables', label: 'Variables in a .md file', what: 'Placeholder syntax in a .md file, and why data can\'t inject structure.' },
  { to: '/personalized-markdown', label: 'Personalized Markdown', what: 'Write a report once and resolve it per customer and per locale.' },
  { to: '/react-mermaid', label: 'Mermaid in React', what: 'Flowcharts and sequence diagrams as static SVG without Mermaid.js.' },
  { to: '/docs/slides', label: 'Markdown presentations in React', what: 'A deck from one Markdown file, with present mode and speaker notes.' },
]

const COMPARISONS: readonly PageLink[] = [
  { to: '/react-markdown-alternative', label: 'react-markdown alternative', what: '39 of 39 prop comparisons render identical markup, and the three differences.' },
  { to: '/compare/react-markdown', label: 'vs react-markdown', what: 'Install size, GFM, security defaults, streaming, server rendering, migration.' },
  { to: '/compare/markdown-to-jsx', label: 'vs markdown-to-jsx', what: 'Install size, GFM, security defaults, streaming, server rendering, migration.' },
  { to: '/compare/streamdown', label: 'vs Streamdown', what: 'Same sections, for an AI chat UI that renders tokens as they arrive.' },
  { to: '/compare/mdxeditor', label: 'Editor vs MDXEditor', what: 'Editing model, output format, round trip, bundle size, server rendering.' },
  { to: '/compare/milkdown', label: 'Editor vs Milkdown', what: 'Editing model, output format, round trip, bundle size, ProseMirror.' },
  { to: '/compare/handlebars', label: 'Variables vs Handlebars', what: 'Replacing placeholders before parsing, compared with resolving them inside the parser.' },
  { to: '/marp-alternative', label: 'Marp and Slidev alternative', what: 'A deck inside a React app, with no PDF or PPTX export.' },
  { to: '/mermaid-live-editor-alternative', label: 'Mermaid Live Editor alternative', what: 'mermaid.live compared with the canvas on editing, sharing, price, licence and diagram types.' },
  { to: '/migrate-from-react-markdown', label: 'Migrate from react-markdown', what: 'The three differences, and a codemod that skips anything it can\'t safely convert.' },
]

const DESCRIPTION =
  'Render Markdown as React, add rich editing and personalize the same document with typed variables. The packages all share one Markdown model.'

export const meta: PageMeta = { title: 'React Markdown renderer and editor docs', description: DESCRIPTION }

function PageLinks({ items }: { readonly items: readonly PageLink[] }): ReactNode {
  return (
    <Features>
      {items.map((item) => (
        <Feature key={item.to} title={<a href={item.to}>{item.label}</a>}>
          {item.what}
        </Feature>
      ))}
    </Features>
  )
}

export default function Home(): ReactNode {
  return (
    <Shell>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareSourceCode',
          name: 'React Markdown Kit',
          description: DESCRIPTION,
          url: sites.docs,
          codeRepository: sites.github,
          programmingLanguage: 'TypeScript',
          runtimePlatform: 'React 18 or newer',
          license: 'https://opensource.org/license/mit',
          author: ORGANIZATION,
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'React Markdown Kit',
          url: sites.docs,
          description: DESCRIPTION,
          inLanguage: 'en',
          publisher: ORGANIZATION,
        }}
      />
      <BreadcrumbJsonLd trail={[{ name: 'React Markdown Kit' }]} />
      <Page as="main">
        <Hero
          title="React Markdown Kit"
          lede="Markdown rendering, streaming and editing in react. Plus plugins for mermaid diagrams, slides and variables."
        />
        <ActivityScope feature="hero" as="div" className="flex flex-wrap gap-3">
          <Button as="a" size="lg" track="get-started" href="/docs/getting-started">
            Get started
          </Button>
          <Button as="a" size="lg" variant="outline" track="renderer-demo" href="/markdown-renderer">
            Try the renderer demo
          </Button>
        </ActivityScope>
        <CodeBlock language="bash">npm install @react-markdown-kit/renderer</CodeBlock>

        <h2>Guides</h2>
        <PageLinks items={GUIDES} />

        <h2>Comparisons</h2>
        <PageLinks items={COMPARISONS} />
      </Page>
    </Shell>
  )
}
