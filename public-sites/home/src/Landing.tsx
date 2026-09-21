import type { ReactNode } from 'react'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import { docsUrl, sites } from '../../shared/Shell'
import { Faq, JsonLd, npmUrl, softwareSourceCode, type FaqItem } from '../../shared/Seo'
import size from '../../../docs/data/mermaid-size.json'

/*
 * The hub (docs/SEO_WORKPLAN.md, milestone A item 9): every package funnel,
 * every demo, every comparison page and every npm page, linked from static
 * HTML. The built index.html carries it before the app mounts.
 */

export const TITLE = 'React Markdown Kit: renderer, editor, Mermaid and slides for React'

/** Also the meta description in index.html; tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'React Markdown Kit renders Markdown in React, adds a rich editor that saves plain Markdown, and ships plugins for templates, Mermaid flowcharts and slides.'

/** The same formula as docs/src/pages/react-mermaid.mdx, from the same file. */
const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`

const USE = `import Markdown from '@react-markdown-kit/renderer'

<Markdown>{content}</Markdown>`

type PackageName = 'renderer' | 'editor' | 'template' | 'mermaid' | 'slides'

interface Package {
  readonly name: PackageName
  readonly what: string
  readonly docs: string
  readonly demo?: string
}

const PACKAGES: readonly Package[] = [
  {
    name: 'renderer',
    what: 'Markdown to React. Safe by default, unstyled by default, server-ready.',
    docs: docsUrl('/react-markdown-renderer'),
    demo: sites.rendererDemo,
  },
  {
    name: 'editor',
    what: 'Rich, source and preview editing. Markdown in, Markdown out.',
    docs: docsUrl('/react-markdown-editor'),
    demo: sites.editorDemo,
  },
  {
    name: 'template',
    what: 'Plugin. Typed variables, formatters and schemas in the same document.',
    docs: docsUrl('/markdown-template-engine'),
  },
  {
    name: 'mermaid',
    what: 'Plugin. Flowcharts as static SVG, edited by dragging on a canvas.',
    docs: docsUrl('/docs/mermaid'),
    demo: sites.mermaidDemo,
  },
  {
    name: 'slides',
    what: 'Plugin. A deck from one Markdown file, presented and printed.',
    docs: docsUrl('/docs/slides'),
    demo: sites.slidesDemo,
  },
]

interface Demo {
  readonly href: string
  readonly label: string
  readonly what: string
}

const DEMOS: readonly Demo[] = [
  { href: sites.rendererDemo, label: 'Renderer playground', what: 'Paste Markdown, switch every option, copy the code.' },
  { href: sites.editorDemo, label: 'Online Markdown editor', what: 'Rich, source and preview modes with templates and diagrams.' },
  { href: sites.mermaidDemo, label: 'Mermaid visual editor', what: 'Drag a flowchart on a canvas, get plain Mermaid back.' },
  { href: sites.slidesDemo, label: 'Markdown slides editor', what: 'Write a deck, present it, open a presenter window.' },
]

interface Evidence {
  readonly href: string
  readonly label: string
  readonly what: string
}

const EVIDENCE: readonly Evidence[] = [
  {
    href: docsUrl('/migrate-from-react-markdown'),
    label: 'Migrating from react-markdown',
    what: 'The three differences, and a codemod that refuses to guess.',
  },
  {
    href: docsUrl('/docs/compatibility'),
    label: 'Compatibility matrix',
    what: '39 of 39 prop comparisons against react-markdown 10, each with its test.',
  },
  {
    href: `${sites.github}/tree/main/benchmarks`,
    label: 'Benchmarks',
    what: '1.21x slower at 1 KB, parity at 10 KB, 0.89x at 100 KB, 2.8x faster precompiled.',
  },
  {
    href: docsUrl('/docs/security'),
    label: 'Security model',
    what: 'Raw HTML shown as text, unsafe URLs emptied, template values that cannot inject.',
  },
  {
    href: docsUrl('/nextjs-markdown'),
    label: 'Next.js and server components',
    what: 'No use client directive; render on the server or in static builds.',
  },
]

const MERMAID_GUIDES: readonly Evidence[] = [
  {
    href: docsUrl('/react-mermaid'),
    label: 'Mermaid in React, no Mermaid.js',
    what: `Flowcharts as static SVG: ${kb(size.plugin.gzipped)} gzipped against ${kb(size.mermaid.flowchart.gzipped)} for a Mermaid.js flowchart (measured by scripts/mermaid-size.mjs).`,
  },
  {
    href: docsUrl('/mermaid-live-editor-alternative'),
    label: 'Mermaid Live Editor alternative',
    what: 'mermaid.live and the visual canvas side by side: editing, sharing, price, licence, diagram types.',
  },
  {
    href: docsUrl('/flowchart-to-mermaid'),
    label: 'Flowchart to Mermaid',
    what: 'Draw a flowchart on the canvas and copy the Mermaid it writes.',
  },
  {
    href: docsUrl('/edit-ai-generated-mermaid'),
    label: 'Fix AI-generated Mermaid',
    what: 'Paste model output, drag the layout right, copy it back with positions kept in a comment.',
  },
]

const RENDERER_PAGES: readonly Evidence[] = [
  {
    href: docsUrl('/docs/guides/render-markdown-in-react'),
    label: 'How to render Markdown in React',
    what: 'GFM, custom components, links, code blocks, security defaults and server rendering, each shown live.',
  },
  {
    href: docsUrl('/streaming-markdown'),
    label: 'Streaming Markdown in React',
    what: 'Every partial prefix renders and finished blocks stay byte-identical; the two exceptions are named.',
  },
  {
    href: docsUrl('/react-markdown-alternative'),
    label: 'react-markdown alternative',
    what: '39 of 39 prop comparisons render identical markup, and the three differences come with a codemod.',
  },
]

const EDITOR_PAGES: readonly Evidence[] = [
  {
    href: docsUrl('/markdown-round-trip'),
    label: 'Lossless Markdown editing',
    what: 'What a round trip has to preserve, the 22-document corpus, and how to run it on your own files.',
  },
  {
    href: docsUrl('/docs/guides/lexical-markdown-editor'),
    label: 'Lexical Markdown editor',
    what: 'Why Lexical, how @react-markdown-kit/editor wraps it, and when to drop to the headless API.',
  },
]

const TEMPLATE_PAGES: readonly Evidence[] = [
  {
    href: docsUrl('/docs/guides/markdown-template-variables'),
    label: 'Markdown template variables',
    what: 'Placeholder syntax in a .md file, and why a resolved value cannot create Markdown structure.',
  },
  {
    href: docsUrl('/personalized-markdown'),
    label: 'Personalized Markdown',
    what: 'Write the customer report once, resolve typed variables per customer and locale.',
  },
]

const SLIDES_PAGES: readonly Evidence[] = [
  {
    href: docsUrl('/docs/slides'),
    label: 'Markdown presentations in React',
    what: 'Slides split on ---, speaker notes after ???, fragments after --, present mode, one plugin.',
  },
  {
    href: docsUrl('/marp-alternative'),
    label: 'Marp and Slidev alternative',
    what: 'A deck rendered inside your own React app, with no PDF or PPTX export.',
  },
]

/** One page per compared library. Byte counts on them come from docs/data/bundle-sizes.json. */
const COMPARISONS: readonly Evidence[] = [
  {
    href: docsUrl('/compare'),
    label: 'All comparisons',
    what: 'Every comparison page, grouped by package, with one install-size table for every import.',
  },
  {
    href: docsUrl('/compare/react-markdown'),
    label: 'vs react-markdown',
    what: 'Install size, GFM, security defaults, streaming, server rendering, plugins and migration.',
  },
  {
    href: docsUrl('/compare/markdown-to-jsx'),
    label: 'vs markdown-to-jsx',
    what: 'The same rows, against the smaller renderer that parses with regular expressions.',
  },
  {
    href: docsUrl('/compare/streamdown'),
    label: 'vs Streamdown',
    what: 'The same rows, for an AI chat UI that renders tokens as they arrive.',
  },
  {
    href: docsUrl('/compare/mdxeditor'),
    label: 'Editor vs MDXEditor',
    what: 'Editing model, output format, round trip, bundle size, server rendering and migration.',
  },
  {
    href: docsUrl('/compare/milkdown'),
    label: 'Editor vs Milkdown',
    what: 'The same rows, against the ProseMirror editor and its plugin system.',
  },
  {
    href: docsUrl('/compare/handlebars'),
    label: 'Templating vs Handlebars',
    what: 'String interpolation before parsing, against placeholders resolved inside the parser.',
  },
]

const FAQ: readonly FaqItem[] = [
  {
    question: 'What is React Markdown Kit?',
    answer:
      'Two React packages and three plugins that share one Markdown model: a renderer, an editor, and plugins for typed template variables, Mermaid flowcharts and slides. Markdown stays the storage format throughout.',
  },
  {
    question: 'Which package do I install?',
    answer:
      '@react-markdown-kit/renderer to render Markdown, and @react-markdown-kit/editor to edit it. The template, mermaid and slides plugins are separate packages used only through the renderer’s extension system.',
    more: { href: docsUrl('/docs/getting-started'), label: 'Getting started.' },
  },
  {
    question: 'Is it free and open source?',
    answer: 'Yes. Every package is MIT licensed and published on npm, and the source is on GitHub.',
    more: { href: sites.github, label: 'The repository.' },
  },
  {
    question: 'How is it different from react-markdown?',
    answer:
      'The prop surface matches react-markdown 10 in 39 of 39 tested comparisons, raw HTML and unsafe URLs are dropped by default without a plugin, and a document can be compiled once and rendered many times. Three differences are documented, with a codemod.',
    more: { href: docsUrl('/migrate-from-react-markdown'), label: 'The migration guide.' },
  },
  {
    question: 'Does it need a design system?',
    answer:
      'No. There are zero styling dependencies in any package. Style the output with your own CSS, the shipped typography, utility classes or your own components.',
    more: { href: docsUrl('/docs/styling'), label: 'The four styling approaches.' },
  },
  {
    question: 'Does it work with Next.js?',
    answer:
      'Yes. The renderer has no use client directive and works in React Server Components; the editor is a client component that saves plain Markdown.',
    more: { href: docsUrl('/nextjs-markdown'), label: 'Markdown in Next.js.' },
  },
]

export default function Landing(): ReactNode {
  return (
    <main className="home">
      <header className="home-hero">
        <img className="home-logo" src="/logo.svg" alt="" width={40} height={40} />
        <h1>{TITLE}</h1>
        <p className="home-lede">
          Add Markdown to the React app you already have. Rendering, editing, diagrams and slides
          are solved, and the file stays plain Markdown, so you keep building your product.
        </p>
        <ActivityScope feature="hero" as="div" className="home-actions">
          <Button as="a" href={docsUrl('/docs/getting-started')} track="get-started">
            Get started
          </Button>
          <Button as="a" href={sites.docs} variant="outline" track="docs">
            Docs
          </Button>
          <Button as="a" href={sites.github} variant="outline" track="github">
            GitHub
          </Button>
        </ActivityScope>
      </header>

      <section className="home-section" aria-labelledby="home-install">
        <h2 id="home-install">Install</h2>
        <pre className="site-code">
          <code>npm install @react-markdown-kit/renderer</code>
        </pre>
        <pre className="site-code">
          <code>{USE}</code>
        </pre>
        <p>
          Raw HTML is shown as text and unsafe URLs are dropped, with nothing to configure. Style
          it with your own CSS, the shipped typography, utility classes or your own components.
        </p>
      </section>

      <section className="home-section" aria-labelledby="home-packages">
        <h2 id="home-packages">Packages</h2>
        <ul className="home-packages">
          {PACKAGES.map((pkg) => (
            <li key={pkg.name}>
              <a className="home-package-name" href={pkg.docs}>
                <code>@react-markdown-kit/{pkg.name}</code>
              </a>
              <span className="home-package-what">{pkg.what}</span>
              <span className="home-package-links">
                <a href={pkg.docs}>Docs</a>
                {pkg.demo ? <a href={pkg.demo}>Demo</a> : null}
                <a href={npmUrl(pkg.name)}>npm</a>
              </span>
            </li>
          ))}
        </ul>
        <p>
          Every package reads and writes plain Markdown, so a document that is rendered today
          can be edited, personalized or presented tomorrow without a migration.
        </p>
      </section>

      <section className="home-section" aria-labelledby="home-demos">
        <h2 id="home-demos">Try it in the browser</h2>
        <ul className="home-list">
          {DEMOS.map((demo) => (
            <li key={demo.href}>
              <a href={demo.href}>{demo.label}</a>
              <span>{demo.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-renderer-guides">
        <h2 id="home-renderer-guides">Renderer guides</h2>
        <ul className="home-list">
          {RENDERER_PAGES.map((guide) => (
            <li key={guide.href}>
              <a href={guide.href}>{guide.label}</a>
              <span>{guide.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-editor-guides">
        <h2 id="home-editor-guides">Editor guides</h2>
        <ul className="home-list">
          {EDITOR_PAGES.map((guide) => (
            <li key={guide.href}>
              <a href={guide.href}>{guide.label}</a>
              <span>{guide.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-template-guides">
        <h2 id="home-template-guides">Template guides</h2>
        <ul className="home-list">
          {TEMPLATE_PAGES.map((guide) => (
            <li key={guide.href}>
              <a href={guide.href}>{guide.label}</a>
              <span>{guide.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-guides">
        <h2 id="home-guides">Mermaid guides</h2>
        <ul className="home-list">
          {MERMAID_GUIDES.map((guide) => (
            <li key={guide.href}>
              <a href={guide.href}>{guide.label}</a>
              <span>{guide.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-slides-guides">
        <h2 id="home-slides-guides">Slides guides</h2>
        <ul className="home-list">
          {SLIDES_PAGES.map((guide) => (
            <li key={guide.href}>
              <a href={guide.href}>{guide.label}</a>
              <span>{guide.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-comparisons">
        <h2 id="home-comparisons">Comparisons</h2>
        <ul className="home-list">
          {COMPARISONS.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
              <span>{item.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-evidence">
        <h2 id="home-evidence">Compare and migrate</h2>
        <ul className="home-list">
          {EVIDENCE.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
              <span>{item.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <Faq id="home-faq" items={FAQ} />

      <JsonLd data={softwareSourceCode({ name: 'React Markdown Kit', url: sites.home, description: DESCRIPTION })} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'React Markdown Kit',
          url: sites.home,
          description: DESCRIPTION,
        }}
      />
    </main>
  )
}
