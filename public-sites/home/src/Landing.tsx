import type { ReactNode } from 'react'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import Heading from '@zuilib/primitives/heading'
import Text from '@zuilib/primitives/text'
import { CopyCode } from '../../shared/CopyCode'
import { Page } from '../../shared/Page'
import { docsUrl, sites } from '../../shared/Shell'
import { Faq, JsonLd, npmUrl, softwareSourceCode, type FaqItem } from '../../shared/Seo'
import size from '../../../docs/data/mermaid-size.json'

export const TITLE = 'React Markdown Kit'

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
    what: 'Renders Markdown to React elements. Safe and unstyled by default, and it runs on the server.',
    docs: docsUrl('/react-markdown-renderer'),
    demo: sites.rendererDemo,
  },
  {
    name: 'editor',
    what: 'Rich, source and preview modes. It loads Markdown and saves Markdown.',
    docs: docsUrl('/react-markdown-editor'),
    demo: sites.editorDemo,
  },
  {
    name: 'template',
    what: 'Plugin for typed variables, formatters and schemas inside the Markdown document itself.',
    docs: docsUrl('/markdown-template-engine'),
  },
  {
    name: 'mermaid',
    what: 'Plugin that renders flowcharts as static SVG. You can edit them by dragging things around on a canvas.',
    docs: docsUrl('/docs/mermaid'),
    demo: sites.mermaidDemo,
  },
  {
    name: 'slides',
    what: 'Plugin that turns one Markdown file into a deck you can present or print.',
    docs: docsUrl('/docs/slides'),
    demo: sites.slidesDemo,
  },
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
    what: 'Covers the three differences. The codemod won’t guess when it isn’t sure.',
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
    what: 'Raw HTML is shown as text, unsafe URLs are emptied and template values can’t inject markup.',
  },
  {
    href: docsUrl('/nextjs-markdown'),
    label: 'Next.js and server components',
    what: 'The renderer has no use client directive, so you can render on the server or in a static build.',
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
    what: 'How mermaid.live compares with the visual canvas on editing, sharing, price, licence and diagram types.',
  },
  {
    href: docsUrl('/flowchart-to-mermaid'),
    label: 'Flowchart to Mermaid',
    what: 'Draw a flowchart on the canvas and copy out the Mermaid it writes.',
  },
  {
    href: docsUrl('/edit-ai-generated-mermaid'),
    label: 'Fix AI-generated Mermaid',
    what: 'Paste what the model gave you, drag the layout until it looks right, then copy it back (positions are kept in a comment).',
  },
]

const RENDERER_PAGES: readonly Evidence[] = [
  {
    href: docsUrl('/docs/guides/render-markdown-in-react'),
    label: 'How to render Markdown in React',
    what: 'Covers GFM, custom components, links, code blocks, security defaults and server rendering, with a live example for each.',
  },
  {
    href: docsUrl('/streaming-markdown'),
    label: 'Streaming Markdown in React',
    what: 'Every partial prefix renders, and blocks that are finished stay byte-identical. There are two exceptions and the page lists them.',
  },
  {
    href: docsUrl('/react-markdown-alternative'),
    label: 'react-markdown alternative',
    what: '39 of 39 prop comparisons render identical markup. There’s a codemod for the three differences.',
  },
]

const EDITOR_PAGES: readonly Evidence[] = [
  {
    href: docsUrl('/markdown-round-trip'),
    label: 'Lossless Markdown editing',
    what: 'What a round trip needs to preserve, the 22-document corpus we test with, and how to run it against your own files.',
  },
  {
    href: docsUrl('/docs/guides/lexical-markdown-editor'),
    label: 'Lexical Markdown editor',
    what: 'Why we went with Lexical, how @react-markdown-kit/editor wraps it, and when you’d want the headless API instead.',
  },
]

const TEMPLATE_PAGES: readonly Evidence[] = [
  {
    href: docsUrl('/docs/guides/markdown-template-variables'),
    label: 'Markdown template variables',
    what: 'The placeholder syntax for a .md file, and why a resolved value can’t create Markdown structure.',
  },
  {
    href: docsUrl('/personalized-markdown'),
    label: 'Personalized Markdown',
    what: 'Write a customer report once and resolve its typed variables for each customer and locale.',
  },
]

const SLIDES_PAGES: readonly Evidence[] = [
  {
    href: docsUrl('/docs/slides'),
    label: 'Markdown presentations in React',
    what: 'Slides are split on ---, speaker notes go after ??? and fragments after --. Present mode is in the same plugin.',
  },
  {
    href: docsUrl('/marp-alternative'),
    label: 'Marp and Slidev alternative',
    what: 'The deck renders inside your own React app. There’s no PDF or PPTX export.',
  },
]

/** One page per compared library. Byte counts on them come from docs/data/bundle-sizes.json. */
const COMPARISONS: readonly Evidence[] = [
  {
    href: docsUrl('/compare'),
    label: 'All comparisons',
    what: 'Every comparison page grouped by package, plus one install-size table that covers every import.',
  },
  {
    href: docsUrl('/compare/react-markdown'),
    label: 'vs react-markdown',
    what: 'Compares install size, GFM, security defaults, streaming, server rendering, plugins and migration.',
  },
  {
    href: docsUrl('/compare/markdown-to-jsx'),
    label: 'vs markdown-to-jsx',
    what: 'Same comparison against markdown-to-jsx, a smaller renderer that parses with regular expressions.',
  },
  {
    href: docsUrl('/compare/streamdown'),
    label: 'vs Streamdown',
    what: 'Same comparison, aimed at AI chat UIs that render tokens as they arrive.',
  },
  {
    href: docsUrl('/compare/mdxeditor'),
    label: 'Editor vs MDXEditor',
    what: 'Compares editing model, output format, round trip, bundle size, server rendering and migration.',
  },
  {
    href: docsUrl('/compare/milkdown'),
    label: 'Editor vs Milkdown',
    what: 'Same comparison against Milkdown, which is built on ProseMirror and has its own plugin system.',
  },
  {
    href: docsUrl('/compare/handlebars'),
    label: 'Templating vs Handlebars',
    what: 'Handlebars interpolates strings before parsing. The template plugin resolves placeholders inside the parser instead.',
  },
]

const FAQ: readonly FaqItem[] = [
  {
    question: 'What is React Markdown Kit?',
    answer:
      'It’s two React packages (a renderer and an editor) plus three plugins for typed template variables, Mermaid flowcharts and slides. They all share one Markdown model, and what you store is always plain Markdown.',
  },
  {
    question: 'Which package do I install?',
    answer:
      'Use @react-markdown-kit/renderer to render Markdown and @react-markdown-kit/editor to edit it. The template, mermaid and slides plugins are separate packages, and you only use them through the renderer’s extension system.',
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
      'The props match react-markdown 10 in 39 of 39 tested comparisons. Raw HTML and unsafe URLs are dropped by default without needing a plugin, and you can compile a document once and render it many times. There are three documented differences, and a codemod handles them.',
    more: { href: docsUrl('/migrate-from-react-markdown'), label: 'The migration guide.' },
  },
  {
    question: 'Does it need a design system?',
    answer:
      'No. None of the packages has a styling dependency. You can style the output with your own CSS, the shipped typography, utility classes or your own components.',
    more: { href: docsUrl('/docs/styling'), label: 'The four styling approaches.' },
  },
  {
    question: 'Does it work with Next.js?',
    answer:
      'Yes. The renderer has no use client directive and works in React Server Components. The editor is a client component, and it saves plain Markdown.',
    more: { href: docsUrl('/nextjs-markdown'), label: 'Markdown in Next.js.' },
  },
]

function Section({ id, title, children }: { readonly id: string; readonly title: string; readonly children: ReactNode }): ReactNode {
  return (
    <section className="mb-12" aria-labelledby={id}>
      <Heading id={id} as="h2" size="xl" className="mt-0 mb-3">
        {title}
      </Heading>
      {children}
    </section>
  )
}

function LinkList({ items }: { readonly items: readonly Evidence[] }): ReactNode {
  return (
    <ul className="m-0 list-none border-t border-border p-0">
      {items.map((item) => (
        <li key={item.href} className="border-b border-border py-3">
          <a className="font-medium text-primary-text no-underline hover:underline" href={item.href}>
            {item.label}
          </a>
          <Text className="m-0 mt-0.5">{item.what}</Text>
        </li>
      ))}
    </ul>
  )
}

export default function Landing(): ReactNode {
  return (
    <Page as="main" className="max-w-(--container-width-sm) pt-20 max-sm:pt-12">
      <header className="mb-14">
        <div className="mb-4 flex items-center gap-3">
          <img src="/logo.svg" alt="" width={40} height={40} className="size-10" />
          <Heading as="h1" size="3xl" className="m-0">
            {TITLE}
          </Heading>
        </div>
        <Text size="lg" weight="medium" className="m-0 mb-8 text-xl max-sm:text-lg">
          Packages for rendering, streaming and editing markdown in react.{' '}
          <span className="mt-1 block text-base font-semibold">Plus plugins for diagrams, slides and variables.</span>
        </Text>
        <ActivityScope feature="hero" as="div" className="flex flex-wrap gap-2">
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

      <Section id="home-install" title="Install">
        <CopyCode code="npm install @react-markdown-kit/renderer" />
        <CopyCode code={USE} />
        <Text className="m-0">
          Raw HTML is shown as text and unsafe URLs are dropped by default, so there’s nothing to
          configure for that. For styling you can use your own CSS, the shipped typography, utility
          classes or your own components.
        </Text>
      </Section>

      <Section id="home-packages" title="Packages">
        <ul className="m-0 mb-4 list-none border-t border-border p-0">
          {PACKAGES.map((pkg) => (
            <li key={pkg.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-border py-3">
              <a className="text-foreground no-underline hover:text-primary-text" href={pkg.docs}>
                <code className="font-mono text-sm font-semibold">@react-markdown-kit/{pkg.name}</code>
              </a>
              <Text className="col-start-1 m-0">{pkg.what}</Text>
              <span className="col-start-2 row-span-2 row-start-1 flex gap-3 self-center [&_a]:text-primary-text [&_a]:no-underline [&_a:hover]:underline">
                <a href={pkg.docs}>Docs</a>
                {pkg.demo ? <a href={pkg.demo}>Demo</a> : null}
                <a href={npmUrl(pkg.name)}>npm</a>
              </span>
            </li>
          ))}
        </ul>
        <Text className="m-0">
          Every package reads and writes plain Markdown. If you start with the renderer and later
          want editing, templates or slides, the documents you already have should work as they are.
        </Text>
      </Section>

      <Section id="home-renderer-guides" title="Renderer guides">
        <LinkList items={RENDERER_PAGES} />
      </Section>

      <Section id="home-editor-guides" title="Editor guides">
        <LinkList items={EDITOR_PAGES} />
      </Section>

      <Section id="home-template-guides" title="Template guides">
        <LinkList items={TEMPLATE_PAGES} />
      </Section>

      <Section id="home-guides" title="Mermaid guides">
        <LinkList items={MERMAID_GUIDES} />
      </Section>

      <Section id="home-slides-guides" title="Slides guides">
        <LinkList items={SLIDES_PAGES} />
      </Section>

      <Section id="home-comparisons" title="Comparisons">
        <LinkList items={COMPARISONS} />
      </Section>

      <Section id="home-evidence" title="Compare and migrate">
        <LinkList items={EVIDENCE} />
      </Section>

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
    </Page>
  )
}
