import { useEffect, useState, type ReactNode } from 'react'
import Link from '@docusaurus/Link'
import Layout from '@theme/Layout'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import CodeBlock from '@theme/CodeBlock'
import RenderExample from '@site/src/components/RenderExample'
import TemplateExample from '@site/src/components/TemplateExample'
import sites from '@site/src/sites'
import { BreadcrumbJsonLd, JsonLd, ORGANIZATION } from '@site/src/components/JsonLd'
import styles from './index.module.css'

/** The hero's install command: the whole chip copies it, and says so. */
function InstallCommand({ command }: { readonly command: string }): ReactNode {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <button
      type="button"
      className={styles.install}
      data-zui-tag="copy-install"
      aria-label={copied ? 'Copied' : `Copy ${command}`}
      onClick={() => {
        navigator.clipboard?.writeText(command).then(() => setCopied(true), () => {})
      }}
    >
      <code>{command}</code>
      <span className={styles.installAction} aria-hidden="true">
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  )
}

const RENDERER_SAMPLE = `## Release 1.4

Ships **today**. See the [changelog](https://example.com/changelog).

- Faster cold render
- \`compileMarkdown\` is now public

| Metric | Before | After |
| --- | ---: | ---: |
| Cold render | 12.4 ms | 9.1 ms |
`

const TEMPLATE_SAMPLE = `## Account review for {{customer.name}}

Your plan renews on {{renewsAt | date:"medium"}}.

| Item | Amount |
| --- | ---: |
| Subscription | {{amounts.subscription \\| currency:"USD"}} |
| Overage | {{amounts.overage \\| currency:"USD"}} |
`

const DATASETS = [
  {
    label: 'Acme',
    data: {
      customer: { name: 'Acme Industrial' },
      renewsAt: '2026-11-01',
      amounts: { subscription: 4800, overage: 312.5 },
    },
  },
  {
    label: 'Cedarline',
    data: {
      customer: { name: 'Cedarline Mutual' },
      renewsAt: '2027-02-15',
      amounts: { subscription: 19200, overage: 0 },
    },
  },
  {
    label: 'Acme, in French',
    locale: 'fr-FR',
    data: {
      customer: { name: 'Acme Industrial' },
      renewsAt: '2026-11-01',
      amounts: { subscription: 4800, overage: 312.5 },
    },
  },
]

interface PageLink {
  readonly to: string
  readonly label: string
  readonly what: string
}

/** The funnel and guide pages, listed so every one is reachable from this page. */
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

/** One page per compared library. */
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
      <header className={`${styles.hero} dark`}>
        <div className="container">
          <h1>React Markdown renderer, editor and template engine</h1>
          <p className={styles.tagline}>
            React packages for rendering, editing and personalizing Markdown. They share
            one Markdown model, so an app can go from displaying Markdown to authoring and
            personalizing it without changing how anything is stored.
          </p>
          <ActivityScope feature="hero" as="div" className={styles.actions}>
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

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Start here</span>
            <h2>One component</h2>
            <p>
              You don't need a provider, stylesheet or config to get started. Edit the
              Markdown on the left and the output updates, or open the{' '}
              <Link href={sites.rendererDemo}>renderer demo</Link> to try every option and copy
              the code.
            </p>
          </div>
          <CodeBlock language="tsx">{`import Markdown from '@react-markdown-kit/renderer'

<Markdown>{content}</Markdown>`}</CodeBlock>
          <RenderExample markdown={RENDERER_SAMPLE} gfm editable />
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Then, when you need it</span>
            <h2>The same document, personalized</h2>
            <p>
              Switch the customer and the output changes, while the authored source stays
              the same. It's plain Markdown the whole way through.
            </p>
          </div>
          <TemplateExample markdown={TEMPLATE_SAMPLE} datasets={DATASETS} gfm>
            This runs in your browser using the same engine a Node service, an email job or
            a PDF pipeline would use. Resolving doesn't call React at all.
          </TemplateExample>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2>Two packages, and three plugin packages that work in both</h2>
            <p>The renderer doesn't depend on the editor. Templates, Mermaid diagrams and slides are installed separately and plug in through the extension system.</p>
          </div>
          <div className={styles.cards}>
            <div className={styles.card}>
              <h3>Renderer</h3>
              <p>
                Renders Markdown to React. It's safe and unstyled by default, works on the server,
                and matches react-markdown on every compared prop.
              </p>
              <Link to="/react-markdown-renderer">Read more</Link>
            </div>
            <div className={styles.card}>
              <h3>Editor</h3>
              <p>
                Rich, source and preview authoring that reads and writes plain Markdown.
                Opening and closing a document doesn't change any of its bytes.
              </p>
              <Link to="/react-markdown-editor">Read more</Link> ·{' '}
              <Link href={sites.editorDemo}>Demo</Link>
            </div>
            <div className={styles.card}>
              <h3>Templates</h3>
              <p>
                <code>template({'{ data }'})</code> resolves typed variables while the renderer
                parses, and <code>templateVariables()</code> edits them as chips in the editor. It's a
                plugin package, so there's no separate engine to call and resolving doesn't need React.
              </p>
              <Link to="/markdown-template-engine">Read more</Link>
            </div>
            <div className={styles.card}>
              <h3>Diagrams</h3>
              <p>
                <code>mermaid()</code> turns a <code>```mermaid</code> flowchart into static SVG in the
                renderer and a drawing canvas in the editor. It's a plugin package with one export.
              </p>
              <Link to="/docs/mermaid">Read more</Link> ·{' '}
              <Link href={sites.mermaidDemo}>Live editor</Link>
            </div>
            <div className={styles.card}>
              <h3>Slides</h3>
              <p>
                <code>slides()</code> reads a Markdown file whose slides are separated by{' '}
                <code>---</code> and renders it as a deck of sections; <code>/present</code> adds
                keyboard-driven present mode and <code>/editor</code> the authoring commands.
              </p>
              <Link to="/docs/slides">Read more</Link> ·{' '}
              <Link href={sites.slidesDemo}>Demo</Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2>Guides</h2>
            <p>
              Task-focused pages with live examples. The kit itself rendered each one when this
              site was built.
            </p>
          </div>
          <ul className={styles.links}>
            {GUIDES.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link> <span>{item.what}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2>Comparisons</h2>
            <p>
              There's one page per library, covering install size, output format, security
              defaults, server rendering and migration. Byte counts come from{' '}
              <Link href={`${sites.github}/blob/main/docs/data/bundle-sizes.json`}>
                docs/data/bundle-sizes.json
              </Link>
              , written by <code>scripts/compare-bundles.mjs</code>.{' '}
              <Link to="/compare">All comparisons, with the full size table</Link>.
            </p>
          </div>
          <ul className={styles.links}>
            {COMPARISONS.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link> <span>{item.what}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2>Numbers with tests behind them</h2>
            <p>
              We don&rsquo;t claim &ldquo;drop-in replacement&rdquo; or &ldquo;fastest&rdquo;.
              Every number here comes from a test you can run.
            </p>
          </div>
          <div className={styles.facts}>
            <div className={styles.fact}>
              <div className={styles.factValue}>39/39</div>
              <div className={styles.factLabel}>
                prop comparisons matching react-markdown 10.1.0
              </div>
            </div>
            <div className={styles.fact}>
              <div className={styles.factValue}>96%</div>
              <div className={styles.factLabel}>
                CommonMark examples, counting raw HTML dropped by design
              </div>
            </div>
            <div className={styles.fact}>
              <div className={styles.factValue}>22/22</div>
              <div className={styles.factLabel}>
                editor round trips that are byte-identical
              </div>
            </div>
            <div className={styles.fact}>
              <div className={styles.factValue}>0</div>
              <div className={styles.factLabel}>styling dependencies in any package</div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  )
}
