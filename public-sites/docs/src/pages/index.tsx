import { useEffect, useState, type ReactNode } from 'react'
import Link from '@docusaurus/Link'
import Layout from '@theme/Layout'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import Heading from '@zuilib/primitives/heading'
import Text from '@zuilib/primitives/text'
import sites from '@site/src/sites'
import { BreadcrumbJsonLd, JsonLd, ORGANIZATION } from '@site/src/components/JsonLd'

function InstallCommand({ command }: { readonly command: string }): ReactNode {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <Button
      variant="outline"
      track="copy-install"
      className="h-auto max-w-full justify-start gap-3 border-border bg-muted py-[0.55rem] pr-[0.55rem] pl-4 text-left font-mono text-sm font-normal text-foreground hover:border-foreground hover:bg-muted"
      aria-label={copied ? 'Copied' : `Copy ${command}`}
      onClick={() => {
        navigator.clipboard?.writeText(command).then(() => setCopied(true), () => {})
      }}
    >
      <code className="border-0! bg-transparent! p-0! text-[length:inherit]! wrap-anywhere">{command}</code>
      <Text
        as="span"
        size="xs"
        weight="medium"
        muted
        className="flex-none rounded-md border border-border bg-background px-2 py-0.5 font-sans"
        aria-hidden="true"
      >
        {copied ? 'Copied' : 'Copy'}
      </Text>
    </Button>
  )
}

interface PageLink {
  readonly to: string
  readonly label: string
  readonly what: string
}

const GUIDES: readonly PageLink[] = [
  { to: '/react-markdown-renderer', label: 'React Markdown renderer', what: 'The one component and its defaults, with the tests behind each.' },
  { to: '/docs/guides/render-markdown-in-react', label: 'How to render Markdown in React', what: 'GFM, custom components, links, code blocks, security, server rendering.' },
  { to: '/streaming-markdown', label: 'Streaming Markdown in React', what: 'Every partial prefix renders, plus the two constructs that rewrite themselves.' },
  { to: '/nextjs-markdown', label: 'Markdown in Next.js', what: 'Server components with no client JavaScript, and precompiled documents.' },
  { to: '/react-markdown-editor', label: 'React Markdown editor', what: 'Rich, source and preview modes that store plain Markdown.' },
  { to: '/markdown-round-trip', label: 'Lossless Markdown editing', what: '22 of 22 audited documents open and save byte for byte.' },
  { to: '/docs/guides/lexical-markdown-editor', label: 'Lexical Markdown editor', what: 'Why Lexical, how the package wraps it, when to use the headless API.' },
  { to: '/markdown-template-engine', label: 'Markdown template engine', what: 'Typed variables, schemas, formatters and locales, resolved in the parser.' },
  { to: '/docs/guides/markdown-template-variables', label: 'Markdown template variables', what: 'Placeholder syntax in a .md file, and why data can\'t inject structure.' },
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
  { to: '/compare/handlebars', label: 'Templating vs Handlebars', what: 'Replacing placeholders before parsing, compared with resolving them inside the parser.' },
  { to: '/marp-alternative', label: 'Marp and Slidev alternative', what: 'A deck inside a React app, with no PDF or PPTX export.' },
  { to: '/mermaid-live-editor-alternative', label: 'Mermaid Live Editor alternative', what: 'mermaid.live compared with the canvas on editing, sharing, price, licence and diagram types.' },
  { to: '/migrate-from-react-markdown', label: 'Migrate from react-markdown', what: 'The three differences, and a codemod that skips anything it can\'t safely convert.' },
]

const SECTION = 'border-t border-border py-10'
const SECTION_HEAD = 'mx-auto mb-6 max-w-[42rem] text-center'
const SECTION_TITLE = 'mb-[0.4rem]! text-balance'

function PageLinks({ items }: { readonly items: readonly PageLink[] }): ReactNode {
  return (
    <ul className="m-0! grid list-none grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-6 gap-y-[0.6rem] p-0!">
      {items.map((item) => (
        <li key={item.to} className="border-t border-border pt-[0.6rem]">
          <Link to={item.to}>{item.label}</Link>
          <Text as="span" className="block">
            {item.what}
          </Text>
        </li>
      ))}
    </ul>
  )
}

const DESCRIPTION =
  'Render Markdown as React, add rich editing and personalize the same document with typed variables. The packages all share one Markdown model.'

export default function Home(): ReactNode {
  return (
    <Layout
      title="React Markdown renderer and editor docs"
      description={DESCRIPTION}
    >
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
          name: 'React Markdown Kit docs',
          url: sites.docs,
          description: DESCRIPTION,
          inLanguage: 'en',
          publisher: ORGANIZATION,
          isPartOf: { '@type': 'WebSite', name: 'React Markdown Kit', url: sites.home },
        }}
      />
      {/* The root of every breadcrumb trail on this site. */}
      <BreadcrumbJsonLd trail={[{ name: 'React Markdown Kit' }]} />
      {/* Spec 13.1: open with the renderer, not with architecture. */}
      <header>
        <div className="container">
          {/* Infima's unlayered `h1` and `p` rules set size and margins, so those utilities carry `!`. */}
          <Heading as="h1" className="mb-2! text-[clamp(2rem,5vw,3rem)]! text-balance">
            React Markdown renderer, editor and template engine
          </Heading>
          <Text className="mx-auto! mt-0! mb-7! max-w-[34rem] text-[clamp(1rem,2.4vw,1.25rem)] text-balance">
            React packages for rendering, editing and personalizing Markdown. They share
            one Markdown model, so an app can go from displaying Markdown to authoring and
            personalizing it without changing how anything is stored.
          </Text>
          <ActivityScope feature="hero" as="div" className="mb-10 flex flex-wrap justify-center gap-3">
            <Button as={Link} size="lg" track="get-started" to="/docs/getting-started">
              Get started
            </Button>
            <Button as={Link} size="lg" variant="outline" track="renderer-demo" href={sites.rendererDemo}>
              Try the renderer demo
            </Button>
          </ActivityScope>
          <InstallCommand command="npm install @react-markdown-kit/renderer" />
        </div>
      </header>

      <section className={SECTION}>
        <div className="container">
          <div className={SECTION_HEAD}>
            <Heading className={SECTION_TITLE}>Guides</Heading>
          </div>
          <PageLinks items={GUIDES} />
        </div>
      </section>

      <section className={SECTION}>
        <div className="container">
          <div className={SECTION_HEAD}>
            <Heading className={SECTION_TITLE}>Comparisons</Heading>
          </div>
          <PageLinks items={COMPARISONS} />
        </div>
      </section>

    </Layout>
  )
}
