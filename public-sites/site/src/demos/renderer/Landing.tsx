import type { ReactNode } from 'react'
import { CopyCode } from '../../../../shared/CopyCode'
import { Callout, Feature, Features, Hero, LinkRow, Page, Prose, Steps } from '../../../../shared/Page'
import { docsUrl, sites } from '../../../../shared/Shell'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../../../shared/Seo'

/*
 * The crawlable copy of reactmarkdownkit.com/markdown-renderer. It targets the
 * searches in docs/SEO_PLAN.md 4.1: "react markdown renderer", "render
 * markdown in react" and "react markdown alternative". The built index.html
 * carries it before the app mounts (shared/vite-seo.ts).
 */

export const TITLE = 'React Markdown Renderer Playground'

/** Also the meta description in index.html; tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Try the React Markdown renderer in the browser: paste Markdown, turn on GFM and safety policies, override components and copy the code behind the output.'

const RENDER = `import Markdown from '@react-markdown-kit/renderer'

export function Article({ content }: { content: string }) {
  return <Markdown>{content}</Markdown>
}`

const GFM = `import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

<Markdown preset={preset}>{content}</Markdown>`

const STYLE = `import Markdown from '@react-markdown-kit/renderer'
import '@react-markdown-kit/renderer/styles.css'

<div className="rmk-document">
  <Markdown preset={preset} components={{ a: AppLink, img: AppImage }}>
    {content}
  </Markdown>
</div>`

const FAQ: readonly FaqItem[] = [
  {
    question: 'How do I render Markdown in React?',
    answer:
      'Install @react-markdown-kit/renderer and pass the string as children to the Markdown component. You don’t need to add a provider, a stylesheet or any configuration.',
    more: { href: docsUrl('/docs/getting-started'), label: 'Getting started.' },
  },
  {
    question: 'Is it safe to render Markdown written by users?',
    answer:
      'For the most part, yes. Raw HTML is shown as text and never executed, and unsafe URL schemes are emptied, without you having to configure anything. The security page lists the tests that cover this.',
    more: { href: docsUrl('/docs/security'), label: 'The security model.' },
  },
  {
    question: 'Is React Markdown Kit a react-markdown alternative?',
    answer:
      'Mostly. Its props match react-markdown 10, and 39 of 39 tested prop comparisons render identical markup. There are three documented differences and a codemod that migrates the rest, so it isn’t quite a drop-in replacement.',
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
      'Yes. Copy link compresses the whole document into the URL hash, and whoever opens the link gets this playground with your Markdown already in the source pane. Nothing gets uploaded.',
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
    <Page>
      <Hero
        kicker="Free and open source, runs in your browser"
        title={TITLE}
        lede={
          <>
            Paste some Markdown, try the React Markdown Kit renderer&rsquo;s options, and copy the
            code that produced the output. The renderer is safe and unstyled by default, and it takes
            the same props as react-markdown.
          </>
        }
      >
        <LinkRow>
          <a href={docsUrl('/react-markdown-renderer')}>Renderer docs</a>
          <a href={npmUrl('renderer')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </LinkRow>
      </Hero>

      <Features>
        <Feature title="Safe by default">
          Raw HTML is shown as text and never run, and unsafe URL schemes are emptied. You don&rsquo;t
          have to configure anything for this.
        </Feature>
        <Feature title="Same props as react-markdown">
          The props match react-markdown 10 across 39 tested comparisons. There are three
          documented differences, and a codemod for them.
        </Feature>
        <Feature title="Works on the server">
          There&rsquo;s no <code>use client</code> directive, so you can render in server components
          and static builds. You can also precompile once and re-render 2.8x faster.
        </Feature>
      </Features>

      <Prose>
        <h2>Install the package</h2>
        <CopyCode code="npm install @react-markdown-kit/renderer" />
        <p>
          It needs React 18 or newer. You don&rsquo;t need a provider, stylesheet, config or design
          system to get going. The package has no <code>use client</code> directive, so it works in
          server components, during server rendering and in static builds.
        </p>

        <h2>Render Markdown in three steps</h2>
        <Steps>
          <li>
            <strong>Render a string.</strong> Raw HTML is shown as text and never run, and unsafe URL
            schemes are emptied (no config needed).
            <CopyCode code={RENDER} />
          </li>
          <li>
            <strong>Turn on GitHub Flavored Markdown</strong> for tables, task lists,
            strikethrough, autolinks and footnotes. A preset is where your app decides which
            Markdown features it supports. You define it once and reuse it everywhere.
            <CopyCode code={GFM} />
          </li>
          <li>
            <strong>Style it.</strong> You can opt into the shipped typography, pass your own
            components per element, or keep the plain semantic HTML and write your own CSS. The
            playground above uses a component for every element, and its Code tab has the source.
            <CopyCode code={STYLE} />
          </li>
        </Steps>

        <Callout>
          <p>
            <strong>More docs.</strong> The <a href={docsUrl('/docs/getting-started')}>getting started guide</a>{' '}
            covers every prop, <a href={docsUrl('/docs/renderer/components')}>components</a> and{' '}
            <a href={docsUrl('/docs/styling')}>styling</a> have live examples for each approach, and the{' '}
            <a href={docsUrl('/docs/compatibility')}>compatibility matrix</a> lists each difference from{' '}
            <code>react-markdown</code> along with the test that checks it.
          </p>
        </Callout>

        <h2>About this playground</h2>
        <ul>
          <li>
            <strong>Rendered</strong> is a live <code>&lt;Markdown&gt;</code> that updates as you edit
            the source. <strong>HTML</strong> is the static markup a server would send.{' '}
            <strong>Tree</strong> is the parsed document that <code>compileMarkdown</code> returns. It&rsquo;s
            plain JSON, so you can cache it or hand it to the{' '}
            <a href={docsUrl('/markdown-template-engine')}>template plugin</a>. <strong>Code</strong> is
            the JSX behind the render.
          </li>
          <li>
            The status strip measures parse and render medians in your browser. They&rsquo;re only
            there to show that rendering a precompiled document skips the parse, so don&rsquo;t read
            them as a benchmark. The{' '}
            <a href={`${sites.github}/tree/main/benchmarks`}>benchmark methodology</a> explains how the
            kit is actually compared.
          </li>
          <li>
            <strong>Copy link</strong> above the source pane compresses the document into the URL
            hash and copies the address. Whoever opens it gets this page with your Markdown already
            loaded, and nothing is uploaded.
          </li>
          <li>
            If you want to edit as well as render, try the <a href={sites.editorDemo}>editor demo</a>.
          </li>
        </ul>

        <Faq id="renderer-faq" items={FAQ} />
      </Prose>

      <JsonLd data={webApplication({ name: TITLE, url: sites.rendererDemo, description: DESCRIPTION })} />
    </Page>
  )
}
