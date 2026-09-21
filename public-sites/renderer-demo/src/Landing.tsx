import type { ReactNode } from 'react'
import { docsUrl, sites } from '../../shared/Shell'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../shared/Seo'

/*
 * The crawlable copy of renderer.reactmarkdownkit.com. It targets the
 * searches in docs/SEO_PLAN.md 4.1: "react markdown renderer", "render
 * markdown in react" and "react markdown alternative". The built index.html
 * carries it before the app mounts (shared/vite-seo.ts).
 */

export const TITLE = 'React Markdown Renderer Playground'

/** Also the meta description in index.html; tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Try the React Markdown renderer in the browser: paste Markdown, turn on GFM and safety policies, override components, and copy the code behind the output.'

const RENDER = `import Markdown from '@react-markdown-kit/renderer'

export function Article({ content }: { content: string }) {
  return <Markdown>{content}</Markdown>
}`

const GFM = `import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

<Markdown preset={preset}>{content}</Markdown>`

const STYLE = `import '@react-markdown-kit/renderer/styles.css'

<div className="rmk-document">
  <Markdown preset={preset} components={{ a: AppLink, img: AppImage }}>
    {content}
  </Markdown>
</div>`

const FAQ: readonly FaqItem[] = [
  {
    question: 'How do I render Markdown in React?',
    answer:
      'Install @react-markdown-kit/renderer and pass the string as children to the Markdown component. There is no provider, stylesheet or configuration to add.',
    more: { href: docsUrl('/docs/getting-started'), label: 'Getting started.' },
  },
  {
    question: 'Is it safe to render Markdown written by users?',
    answer:
      'Raw HTML is shown as text and never executed, and unsafe URL schemes are emptied, with nothing to configure. The security page lists the tests behind that.',
    more: { href: docsUrl('/docs/security'), label: 'The security model.' },
  },
  {
    question: 'Is React Markdown Kit a react-markdown alternative?',
    answer:
      'Its prop surface matches react-markdown 10: 39 of 39 tested prop comparisons render identical markup, three differences are documented, and a codemod migrates the rest. It is not a drop-in replacement.',
    more: { href: docsUrl('/migrate-from-react-markdown'), label: 'The migration guide.' },
  },
  {
    question: 'Does it work in Next.js and React Server Components?',
    answer:
      'Yes. The package has no use client directive, so it renders on the server, inside server components and in static builds.',
    more: { href: docsUrl('/nextjs-markdown'), label: 'Markdown in Next.js.' },
  },
  {
    question: 'Does it support GitHub Flavored Markdown?',
    answer:
      'Yes. Add gfm() to a preset for tables, task lists, strikethrough, autolinks and footnotes. The default dialect is CommonMark.',
    more: { href: docsUrl('/docs/renderer/gfm'), label: 'GFM options.' },
  },
  {
    question: 'Can I share the Markdown I am testing?',
    answer:
      'Yes. Copy link compresses the whole document into the URL hash, so the link opens this playground with your Markdown already in the source pane. Nothing is uploaded.',
  },
  {
    question: 'How fast is it?',
    answer:
      'On a 1 KB document it is 1.21x slower than react-markdown, at parity at 10 KB and 0.89x at 100 KB. A precompiled document re-renders 2.8x faster than parsing again.',
    more: { href: `${sites.github}/tree/main/benchmarks`, label: 'The benchmark methodology.' },
  },
]

export default function Landing(): ReactNode {
  return (
    <article className="site-landing">
      <header className="site-hero">
        <span className="site-eyebrow">Free, open source, runs in your browser</span>
        <h1>{TITLE}</h1>
        <p className="site-lede">
          Paste Markdown, switch every option of the React Markdown Kit renderer, and copy the
          exact code that produced the output. Safe by default, unstyled by default, and the same
          props as react-markdown.
        </p>
        <p className="site-hero-links">
          <a href={docsUrl('/react-markdown-renderer')}>Renderer docs</a>
          <a href={npmUrl('renderer')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </p>
      </header>

      <ul className="site-features">
        <li>
          <strong>Safe by default</strong>
          Raw HTML is shown as text, never run, and unsafe URL schemes are emptied, with nothing
          to configure.
        </li>
        <li>
          <strong>The props you know</strong>
          The prop surface matches react-markdown 10 across 39 tested comparisons, with three
          documented differences and a codemod.
        </li>
        <li>
          <strong>Server-ready</strong>
          No <code>use client</code> directive. Render in server components and static builds, or
          precompile once and re-render 2.8x faster.
        </li>
      </ul>

      <div className="site-prose">
        <span className="site-eyebrow">Install</span>
        <h2>One package, one component</h2>
        <pre className="site-code">
          <code>npm install @react-markdown-kit/renderer</code>
        </pre>
        <p>
          React 18 or newer. No provider, no stylesheet, no configuration, and no design system.
          The package has no <code>use client</code> directive, so it works in server components,
          during server rendering and in static builds.
        </p>

        <span className="site-eyebrow">How to</span>
        <h2>Render Markdown in three steps</h2>
        <ol className="site-steps">
          <li>
            <strong>Render a string.</strong> Raw HTML is shown as text, never run, and unsafe URL
            schemes are emptied, with nothing to configure.
            <pre className="site-code">
              <code>{RENDER}</code>
            </pre>
          </li>
          <li>
            <strong>Turn on GitHub Flavored Markdown</strong> for tables, task lists,
            strikethrough, autolinks and footnotes. A preset is your application&rsquo;s answer to
            &ldquo;what does Markdown mean here?&rdquo;, defined once and reused everywhere.
            <pre className="site-code">
              <code>{GFM}</code>
            </pre>
          </li>
          <li>
            <strong>Style it your way.</strong> Opt into the shipped typography, pass your own
            components per element, or leave the plain semantic HTML and bring your own CSS. The
            playground above uses a component for every element; its Code tab has the source.
            <pre className="site-code">
              <code>{STYLE}</code>
            </pre>
          </li>
        </ol>

        <div className="site-deeper">
          <p>
            <strong>Go deeper.</strong> The <a href={docsUrl('/docs/getting-started')}>getting started guide</a>{' '}
            covers every prop, <a href={docsUrl('/docs/renderer/components')}>components</a> and{' '}
            <a href={docsUrl('/docs/styling')}>styling</a> have live examples for each approach, and the{' '}
            <a href={docsUrl('/docs/compatibility')}>compatibility matrix</a> lists every difference from{' '}
            <code>react-markdown</code> with the test that proves it.
          </p>
        </div>

        <h2>About this playground</h2>
        <ul>
          <li>
            <strong>Rendered</strong> is a live <code>&lt;Markdown&gt;</code>. Edit the source and it
            follows. <strong>HTML</strong> is the static markup a server would send.{' '}
            <strong>Tree</strong> is the parsed document that <code>compileMarkdown</code> returns,
            plain JSON you can cache or hand to the{' '}
            <a href={docsUrl('/markdown-template-engine')}>template plugin</a>. <strong>Code</strong> is
            the exact JSX behind the render.
          </li>
          <li>
            The status strip measures parse and render medians in your browser. They show one thing,
            that rendering a precompiled document skips the parse, and they are not a benchmark. The{' '}
            <a href={`${sites.github}/tree/main/benchmarks`}>benchmark methodology</a> explains how the
            kit is actually compared.
          </li>
          <li>
            <strong>Copy link</strong> above the source pane compresses the document into the URL
            hash and copies the address, so a colleague opens this page with your exact Markdown
            already loaded and nothing is uploaded.
          </li>
          <li>
            Want to edit as well as render? Open the <a href={sites.editorDemo}>editor demo</a>.
          </li>
        </ul>

        <Faq id="renderer-faq" items={FAQ} />
      </div>

      <JsonLd data={webApplication({ name: TITLE, url: sites.rendererDemo, description: DESCRIPTION })} />
    </article>
  )
}
