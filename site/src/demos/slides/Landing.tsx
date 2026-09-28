import type { ReactNode } from 'react'
import CodeBlock from '../../components/CodeBlock'
import { Callout, Feature, Features, Hero, LinkRow, Page, Steps } from '../../components/landing/Page'
import { docsUrl, sites } from '../../sites'
import { Faq, JsonLd, npmUrl, webApplication } from '../../components/landing/Seo'
import { FAQ } from './landing-faq'
import { DECK, EDIT, EMBED, PRESENT, RENDER } from './landing-samples'

/*
 * The crawlable copy of reactmarkdownkit.com/markdown-slides. It targets the searches
 * in docs/SEO_PLAN.md 4.4: "markdown slides online", "markdown slides
 * editor" and "markdown presentation react". It renders on the server
 * into the built page; the demo above it loads in the browser.
 */

export const TITLE = 'Markdown Slides Editor Online'

/** Also the meta description of the page (src/pages); tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Write a slide deck in plain Markdown and present it in the browser. Slides split on ---, notes go after ???, fragments after --, with a presenter window.'

export default function Landing(): ReactNode {
  return (
    // Print is the deck alone: the landing copy and the footer after it stay off the page.
    <Page id="docs" className="print:hidden">
      <Hero
        kicker="Free and open source, no account needed"
        title={TITLE}
        lede={
          <>
            Write a deck in plain Markdown on the left and it renders on the right. You can present
            it from this page, open a presenter window with your notes, share a link that holds the
            whole deck, print it with one page per slide or export it to PowerPoint.
          </>
        }
      >
        <LinkRow>
          <a href={docsUrl('/docs/slides')}>Plugin docs</a>
          <a href={npmUrl('slides')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </LinkRow>
      </Hero>

      <Features>
        <Feature title="Plain Markdown">
          Slides split on <code>---</code>, notes go after <code>???</code> and fragments after{' '}
          <code>--</code>. GitHub still renders the file as a normal document.
        </Feature>
        <Feature title="Present mode">
          Full screen with keyboard and pointer navigation, an overview of every slide, and a
          presenter window with the next step, your notes and a timer. You can deep link to any
          slide.
        </Feature>
        <Feature title="Uses the same renderer">
          One plugin turns the Markdown your app stores into an <code>&lt;article&gt;</code> of{' '}
          <code>&lt;section&gt;</code>s. It works on the server or in the browser.
        </Feature>
      </Features>

      <h2>Install the plugin, and the editor if you want to author decks</h2>
      <CodeBlock language="bash">npm install @react-markdown-kit/renderer @react-markdown-kit/slides</CodeBlock>
      <CodeBlock language="bash">npm install @react-markdown-kit/editor</CodeBlock>
      <p>
        You only need the first line to render a deck. The root entry doesn&rsquo;t load React, so a
        server component or a static build gets the same <code>&lt;article&gt;</code> of{' '}
        <code>&lt;section&gt;</code>s. The <code>/present</code> entry adds present mode, and the{' '}
        <code>/editor</code> entry adds the slide commands to the rich editor if you want one.
      </p>

      <h2>Making slides from Markdown</h2>
      <Steps>
        <li>
          <strong>Render a deck.</strong> Put <code>slides()</code> in a preset. Slides split on{' '}
          <code>---</code>, the notes start at <code>???</code>, a <code>--</code> is a pause, and{' '}
          <code>&lt;!-- key: value --&gt;</code> comments set a slide&rsquo;s layout, class,
          background, transition and footer. The output is static HTML with no script, classes or inline styles, and the
          notes get the HTML <code>hidden</code> attribute.
          <CodeBlock language="tsx">{RENDER}</CodeBlock>
        </li>
        <li>
          <strong>Write plain Markdown.</strong> On GitHub, in a diff or in any other editor, the
          file shows up as a document with horizontal rules. A <code>---</code> inside a fence, a
          quote or a list doesn&rsquo;t split the slide, and front matter at the top sets the title,
          the aspect ratio and the defaults for every slide.
          <CodeBlock language="markdown">{DECK}</CodeBlock>
        </li>
        <li>
          <strong>Present, then edit.</strong> The <code>/present</code> entry&rsquo;s{' '}
          <code>slides()</code> gives the deck a Present button, keyboard and pointer navigation,
          fragments, an overview, a presenter view with the notes and a timer, drawing and a laser
          pointer, <code>#3</code> deep links and a <code>BroadcastChannel</code> that keeps two
          windows on the same slide. The{' '}
          <code>/editor</code> entry adds the slide break, the markers and the directive chips to the
          editor, with four toolbar buttons.
          <CodeBlock language="tsx">{PRESENT}</CodeBlock>
          <CodeBlock language="tsx">{EDIT}</CodeBlock>
        </li>
      </Steps>

      <Callout>
        <p>
          <strong>More docs.</strong> The <a href={docsUrl('/docs/slides')}>slides plugin docs</a> cover
          the dialect, every directive and diagnostic, the emitted HTML, the tokens the stylesheet
          reads, printing, and the editor and present options.{' '}
          <a href={docsUrl('/docs/editor/basics')}>Editor basics</a> covers the editor the left pane
          lives in.
        </p>
      </Callout>

      <h2>Put a deck in your own page</h2>
      <p>
        If you add <code>embed=1</code> to a share link, the page hides everything except the deck
        (the footer, the landing copy and the editor all go away). The deck fills the frame, opens
        in present mode and keeps keyboard and pointer navigation inside the frame, so arrow keys
        and clicks move the slides once the frame has focus. There&rsquo;s a small{' '}
        <em>Open in React Markdown Kit</em> link in the corner that opens the full editor in a new
        tab with the same deck.
      </p>
      <CodeBlock language="html">{EMBED}</CodeBlock>
      <p>
        The <code>d</code> value is the whole deck, so the frame doesn&rsquo;t need to load anything
        from your server. Press Share on this page to copy a link with your deck in it, then add{' '}
        <code>&amp;embed=1</code>. An embedded deck doesn&rsquo;t touch the address bar or open a
        sync channel, so several frames on one page stay independent. Give the frame the aspect
        ratio of your slides (16 by 9 by default), and add <code>allowfullscreen</code> if you want
        the full screen button to work.{' '}
        <a href={`${sites.slidesDemo}?embed=1`}>See the embed on its own</a>.
      </p>

      <h2>About this editor</h2>
      <ul>
        <li>
          The left pane is the deck file as plain text, with the plugin&rsquo;s syntax coloured, and
          the right pane is the renderer with the <code>/present</code> entry and the Mermaid
          plugin. The deck re-renders as you type. Press Present to show it from this window, and{' '}
          <code>?</code> while presenting for the keys.
        </li>
        <li>
          <em>Stream it</em> replays the deck into the right pane a few characters at a time, the way
          a model&rsquo;s reply arrives, and presents it as it grows. The deck&rsquo;s{' '}
          <code>follow</code> option keeps it on the newest slide.
        </li>
        <li>
          <em>Export .pptx</em> writes the deck as a PowerPoint file with the <code>/pptx</code>{' '}
          entry. Every fragment and code step is shown, and a diagram comes out as its source.
        </li>
        <li>
          The deck lives in the address bar. <code>?d=</code> is the source, deflated and base64url
          encoded, so a link carries the whole file. Share copies a link that opens in present mode.{' '}
          <em>Presenter window</em> opens a second window with the next step, the notes and a timer,
          and it stays on the same slide as this window.
        </li>
        <li>
          Printing gives each slide a 16 by 9 inch page from the plugin&rsquo;s stylesheet. The deck
          scales with container units, so nothing has to measure the window.
        </li>
        <li>
          The other plugins are in the <a href={sites.editorDemo}>editor demo</a>, the Mermaid canvas
          is in the <a href={sites.mermaidDemo}>Mermaid editor</a>, and the{' '}
          <a href={sites.rendererDemo}>renderer demo</a> covers rendering on its own.
        </li>
      </ul>

      <Faq id="slides-faq" items={FAQ} />

      <JsonLd data={webApplication({ name: TITLE, url: sites.slidesDemo, description: DESCRIPTION })} />
    </Page>
  )
}
