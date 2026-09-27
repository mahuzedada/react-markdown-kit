import type { ReactNode } from 'react'
import CodeBlock from '../../components/CodeBlock'
import { Feature, Features, Hero, LinkRow, Page } from '../../components/landing/Page'
import { docsUrl, sites } from '../../sites'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../components/landing/Seo'

/*
 * The crawlable copy of reactmarkdownkit.com/markdown-streaming. It renders
 * on the server into the built page; the demo above it loads in the browser.
 */

export const TITLE = 'React Streaming Markdown Playground'

/** Also the meta description of the page (src/pages); tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Stream Markdown into a React renderer token by token, like an AI chat reply. Open code fences, half tables and Mermaid diagrams render at every prefix.'

const CHAT = `import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

export function Reply({ text }: { text: string }) {
  // text grows with every chunk from the model
  return <Markdown preset={preset}>{text}</Markdown>
}`

const FAQ: readonly FaqItem[] = [
  {
    question: 'Do I need a streaming mode or a special component?',
    answer:
      'No. Pass the text received so far to the same Markdown component on every chunk. The renderer re-parses the whole prefix each time and React keeps the finished DOM nodes in place.',
    more: { href: docsUrl('/streaming-markdown'), label: 'Streaming Markdown in React.' },
  },
  {
    question: 'What happens to a code fence that is still open?',
    answer:
      'It renders as a code block holding what has arrived so far, and closes when the closing fence comes in. Half-written emphasis, a table stopped mid row and a link with no closing bracket render the same way, as whatever they are at that prefix.',
  },
  {
    question: 'Does text that already rendered move around?',
    answer:
      'Finished blocks produce byte-identical HTML at every later prefix. There are two exceptions from the CommonMark and GFM rules: a paragraph followed by a setext underline turns into a heading, and a half-typed URL autolinks to the truncated host until the rest arrives.',
  },
  {
    question: 'Is the stream in this playground a real model?',
    answer:
      'No. It replays the Markdown on the left in chunks on a timer, in your browser. Random chunk size sends 1 to 8 tokens at a time, which is closer to what a model API sends than one token per tick.',
  },
]

export default function Landing(): ReactNode {
  return (
    <Page id="docs">
      <Hero
        kicker="Free and open source, runs in your browser"
        title={TITLE}
        lede={
          <>
            Edit the Markdown on the left and press Simulate stream. The right side is the React
            Markdown Kit renderer fed the text a few tokens at a time, the way a chat UI re-renders
            on every chunk from a model.
          </>
        }
      >
        <LinkRow>
          <a href={docsUrl('/streaming-markdown')}>Streaming guide</a>
          <a href={npmUrl('renderer')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </LinkRow>
      </Hero>

      <Features>
        <Feature title="Every prefix renders">
          Open fences, half-written emphasis, tables stopped mid row and links with no closing bracket
          all render without throwing. The cases are asserted prefix by prefix in the renderer&rsquo;s
          tests.
        </Feature>
        <Feature title="Finished blocks stay put">
          The HTML of a finished block doesn&rsquo;t change as more text arrives, so nothing above the
          line being written jumps around.
        </Feature>
        <Feature title="Same component">
          There&rsquo;s no streaming mode to turn on. It&rsquo;s the same <code>&lt;Markdown&gt;</code>{' '}
          you&rsquo;d use for a static page.
        </Feature>
      </Features>

      <h2>Render a streamed reply</h2>
      <CodeBlock language="bash">npm install @react-markdown-kit/renderer</CodeBlock>
      <p>
        Keep appending chunks to a string in state and render it. That&rsquo;s the whole integration.
      </p>
      <CodeBlock language="tsx">{CHAT}</CodeBlock>
      <p>
        The playground also turns on the <a href={docsUrl('/docs/mermaid')}>Mermaid plugin</a>, so a{' '}
        <code>mermaid</code> fence switches to SVG once the diagram type arrives, then fills in node
        by node.
      </p>

      <h2>About this playground</h2>
      <ul>
        <li>
          <strong>Speed</strong> sets the time between chunks and <strong>Chunk size</strong> sets how
          many tokens each one carries. A token is a word or a single space or punctuation character,
          so a code fence arrives as three separate backticks.
        </li>
        <li>
          The status strip counts chunks and elapsed time. Every chunk is a full parse and render of the
          prefix, with nothing cached between them.
        </li>
        <li>
          <strong>Copy link</strong> compresses the Markdown into the URL hash. Whoever opens it gets
          this page with your document loaded, and nothing is uploaded.
        </li>
        <li>
          The <a href={docsUrl('/streaming-markdown')}>streaming guide</a> has the details, including the
          two constructs that change shape as they complete.
        </li>
      </ul>

      <Faq id="stream-faq" items={FAQ} />

      <JsonLd data={webApplication({ name: TITLE, url: sites.streamDemo, description: DESCRIPTION })} />
    </Page>
  )
}
