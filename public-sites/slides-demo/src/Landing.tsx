import type { ReactNode } from 'react'
import { CopyCode } from '../../shared/CopyCode'
import { docsUrl, sites } from '../../shared/Shell'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../shared/Seo'

/*
 * The crawlable copy of slides.reactmarkdownkit.com. It targets the searches
 * in docs/SEO_PLAN.md 4.4: "markdown slides online", "markdown slides
 * editor" and "markdown presentation react". The built index.html carries it
 * before the app mounts (shared/vite-seo.ts).
 */

export const TITLE = 'Markdown Slides Editor Online'

/** Also the meta description in index.html; tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Write a slide deck in plain Markdown and present it in the browser. Slides split on ---, notes go after ???, fragments after --, with a presenter window.'

const RENDER = `import Markdown, { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { slides } from '@react-markdown-kit/slides'
import '@react-markdown-kit/slides/styles.css'

const preset = defineMarkdownPreset({ extensions: [slides()] })

<div className="rmk-document">
  <Markdown preset={preset}>{deck}</Markdown>
</div>`

const DECK = `---
title: Q3 review
---

# Welcome

---

<!-- class: center, middle -->

## Numbers

Revenue is up.

--

So are costs.

???

Pause before the second line.`

const PRESENT = `import { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { slides } from '@react-markdown-kit/slides/present'

const preset = defineMarkdownPreset({
  extensions: [slides({ hashRouting: true, sync: 'talk' })],
})`

const EDIT = `import { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { slides } from '@react-markdown-kit/slides/editor'

const preset = defineMarkdownPreset({ extensions: [slides()] })

<MarkdownEditor preset={preset} value={source} onChange={setSource} />`

const EMBED = `<iframe
  src="https://slides.reactmarkdownkit.com/?embed=1&d=uIyBXZWxjb21lCgotLS0KCiMjIFNlY29uZCBzbGlkZQoKT25lIGZpbGUsIHR3byBzbGlkZXMu"
  title="A deck written in Markdown"
  width="100%"
  height="480"
  loading="lazy"
  allowfullscreen
></iframe>`

const FAQ: readonly FaqItem[] = [
  {
    question: 'Can I make slides from Markdown?',
    answer:
      'Yes. Separate slides with --- between blank lines and the file becomes a deck. It’s still a normal document on GitHub, in a diff, and in any editor that doesn’t know about the plugin.',
    more: { href: docsUrl('/docs/slides'), label: 'The dialect.' },
  },
  {
    question: 'How do I add speaker notes to Markdown slides?',
    answer:
      'Put ??? on its own line. Everything after it in that slide is a note. Notes are hidden in the deck and shown in the presenter window, next to the upcoming slide and a clock.',
  },
  {
    question: 'Can I present Markdown slides in the browser?',
    answer:
      'Yes. Present goes full screen with keyboard navigation. You can also open a presenter window that stays in sync, and share a link that opens the deck in present mode.',
  },
  {
    question: 'How do I reveal points one at a time?',
    answer: 'Put -- on its own line between them. Each -- starts a fragment that shows up on the next keypress.',
  },
  {
    question: 'Can I set a class or a background on one slide?',
    answer:
      'Yes. Use a comment on a line by itself to set class, background or name. Front matter at the top of the file sets the title, the aspect ratio and the defaults for every slide.',
  },
  {
    question: 'Can I embed a Markdown deck in a blog post?',
    answer:
      'Yes. Add embed=1 to a share link and put it in an iframe. The frame shows only the deck, in present mode. Keys work inside it, and there’s a link that opens the full editor.',
  },
  {
    question: 'Is it a Marp or Slidev alternative?',
    answer:
      'For decks inside a React app, yes. If you need to export files, probably not. Marp and Slidev export PDF and PPTX, and this plugin only renders sections from Markdown your app already stores (and prints one page per slide).',
    more: { href: docsUrl('/docs/slides'), label: 'What the plugin renders.' },
  },
]

export default function Landing(): ReactNode {
  return (
    <article className="site-landing">
      <header className="site-hero">
        <span className="site-eyebrow">Free and open source, no account needed</span>
        <h1>{TITLE}</h1>
        <p className="site-lede">
          Write a deck in plain Markdown on the left and it renders on the right. You can present
          it from this page, open a presenter window with your notes, share a link that holds the
          whole deck, or print it with one page per slide.
        </p>
        <p className="site-hero-links">
          <a href={docsUrl('/docs/slides')}>Plugin docs</a>
          <a href={npmUrl('slides')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </p>
      </header>

      <ul className="site-features">
        <li>
          <strong>Plain Markdown</strong>
          Slides split on <code>---</code>, notes go after <code>???</code> and fragments after{' '}
          <code>--</code>. GitHub still renders the file as a normal document.
        </li>
        <li>
          <strong>Present mode</strong>
          Full screen with keyboard and pointer navigation. There&rsquo;s a presenter window with the
          next slide and a clock, and you can deep link to any slide.
        </li>
        <li>
          <strong>Uses the same renderer</strong>
          One plugin turns the Markdown your app stores into an <code>&lt;article&gt;</code> of{' '}
          <code>&lt;section&gt;</code>s. It works on the server or in the browser.
        </li>
      </ul>

      <div className="site-prose">
        <span className="site-eyebrow">Install</span>
        <h2>Install the plugin, and the editor if you want to author decks</h2>
        <CopyCode code="npm install @react-markdown-kit/renderer @react-markdown-kit/slides" />
        <CopyCode code="npm install @react-markdown-kit/editor" />
        <p>
          You only need the first line to render a deck. The root entry doesn&rsquo;t load React, so a
          server component or a static build gets the same <code>&lt;article&gt;</code> of{' '}
          <code>&lt;section&gt;</code>s. The <code>/present</code> entry adds present mode. The left pane
          of this page is built from the editor and the <code>/editor</code> entry.
        </p>

        <span className="site-eyebrow">How to</span>
        <h2>Making slides from Markdown</h2>
        <ol className="site-steps">
          <li>
            <strong>Render a deck.</strong> Put <code>slides()</code> in a preset. Slides split on{' '}
            <code>---</code>, the notes start at <code>???</code>, a <code>--</code> is a pause, and{' '}
            <code>&lt;!-- class | background | name: … --&gt;</code> comments set a slide&rsquo;s
            properties. The output is static HTML with no script, classes or inline styles, and the
            notes get the HTML <code>hidden</code> attribute.
            <CopyCode code={RENDER} />
          </li>
          <li>
            <strong>Write plain Markdown.</strong> On GitHub, in a diff or in any other editor, the
            file shows up as a document with horizontal rules. A <code>---</code> inside a fence, a
            quote or a list doesn&rsquo;t split the slide, and front matter at the top sets the title,
            the aspect ratio and the defaults for every slide.
            <CopyCode code={DECK} />
          </li>
          <li>
            <strong>Present, then edit.</strong> The <code>/present</code> entry&rsquo;s{' '}
            <code>slides()</code> gives the deck a Present button, keyboard and pointer navigation,
            fragments, a presenter view with the notes and a clock, <code>#3</code> deep links and a{' '}
            <code>BroadcastChannel</code> that keeps two windows on the same slide. The{' '}
            <code>/editor</code> entry adds the slide break, the markers and the directive chips to the
            editor, with four toolbar buttons.
            <CopyCode code={PRESENT} />
            <CopyCode code={EDIT} />
          </li>
        </ol>

        <div className="site-deeper">
          <p>
            <strong>More docs.</strong> The <a href={docsUrl('/docs/slides')}>slides plugin docs</a> cover
            the dialect, every directive and diagnostic, the emitted HTML, the tokens the stylesheet
            reads, printing, and the editor and present options.{' '}
            <a href={docsUrl('/docs/editor/basics')}>Editor basics</a> covers the editor the left pane
            lives in.
          </p>
        </div>

        <span className="site-eyebrow">Embed</span>
        <h2>Put a deck in your own page</h2>
        <p>
          If you add <code>embed=1</code> to a share link, the page hides everything except the deck
          (the footer, the landing copy and the editor all go away). The deck fills the frame, opens
          in present mode and keeps keyboard and pointer navigation inside the frame, so arrow keys
          and clicks move the slides once the frame has focus. There&rsquo;s a small{' '}
          <em>Open in React Markdown Kit</em> link in the corner that opens the full editor in a new
          tab with the same deck.
        </p>
        <CopyCode code={EMBED} />
        <p>
          The <code>d</code> value is the whole deck, so the frame doesn&rsquo;t need to load anything
          from your server. Press Share on this page to copy a link with your deck in it, then add{' '}
          <code>&amp;embed=1</code>. An embedded deck doesn&rsquo;t touch the address bar or open a
          sync channel, so several frames on one page stay independent. Give the frame the aspect
          ratio of your slides (16 by 9 by default), and add <code>allowfullscreen</code> if you want
          the full screen button to work.{' '}
          <a href={`${sites.slidesDemo}/?embed=1`}>See the embed on its own</a>.
        </p>

        <h2>About this editor</h2>
        <ul>
          <li>
            The left pane is the rich editor with the <code>/editor</code> entry, and the right pane is
            the renderer with the same preset. The deck re-renders as you type. Press Present in the
            deck&rsquo;s control bar to show it from this window.
          </li>
          <li>
            The deck lives in the address bar. <code>?d=</code> is the source, deflated and base64url
            encoded, so a link carries the whole file. Share copies a link that opens in present mode.{' '}
            <em>Presenter window</em> opens a second window with the next slide, the notes and a clock,
            and it stays on the same slide as this window.
          </li>
          <li>
            Printing gives each slide a 16 by 9 inch page, using the stylesheet&rsquo;s{' '}
            <code>break-after: page</code> and this site&rsquo;s own <code>@page</code> rule. The deck
            scales with container units, so nothing has to measure the window.
          </li>
          <li>
            The other plugins are in the <a href={sites.editorDemo}>editor demo</a>, the Mermaid canvas
            is in the <a href={sites.mermaidDemo}>Mermaid editor</a>, and the{' '}
            <a href={sites.rendererDemo}>renderer demo</a> covers rendering on its own.
          </li>
        </ul>

        <Faq id="slides-faq" items={FAQ} />
      </div>

      <JsonLd data={webApplication({ name: TITLE, url: sites.slidesDemo, description: DESCRIPTION })} />
    </article>
  )
}
