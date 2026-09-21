import type { ReactNode } from 'react'
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
  'Write a slide deck as plain Markdown and present it from the browser: slides split on ---, notes after ???, fragments after --, plus a presenter window.'

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

const PRESENT = `import { slides } from '@react-markdown-kit/slides/present'

const preset = defineMarkdownPreset({
  extensions: [slides({ hashRouting: true, sync: 'talk' })],
})`

const EDIT = `import { MarkdownEditor } from '@react-markdown-kit/editor'
import { slides } from '@react-markdown-kit/slides/editor'

const preset = defineMarkdownPreset({ extensions: [slides()] })

<MarkdownEditor preset={preset} value={source} onChange={setSource} />`

const FAQ: readonly FaqItem[] = [
  {
    question: 'Can I make slides from Markdown?',
    answer:
      'Yes. Separate slides with --- between blank lines and the file is a deck. The same file is still a plain document on GitHub, in a diff and in any editor that does not know the plugin.',
    more: { href: docsUrl('/docs/slides'), label: 'The dialect.' },
  },
  {
    question: 'How do I add speaker notes to Markdown slides?',
    answer:
      'Put ??? on its own line. Everything after it in that slide is a note: hidden in the deck, shown in the presenter window next to the next slide and a clock.',
  },
  {
    question: 'Can I present Markdown slides in the browser?',
    answer:
      'Yes. Press Present for full screen with keyboard navigation, open a presenter window that stays in sync, and share a link that opens the deck in present mode.',
  },
  {
    question: 'How do I reveal points one at a time?',
    answer: 'Put -- on its own line between them. Each -- starts a fragment that appears on the next keypress.',
  },
  {
    question: 'Can I set a class or a background on one slide?',
    answer:
      'Yes, with a comment alone on its line: class, background or name. Front matter at the top of the file sets the title, the aspect ratio and defaults for every slide.',
  },
  {
    question: 'Is it a Marp or Slidev alternative?',
    answer:
      'For decks inside a React app, yes. For exporting files, no: Marp and Slidev export PDF and PPTX, while this plugin renders sections from Markdown your app already stores and prints one page per slide.',
    more: { href: docsUrl('/docs/slides'), label: 'What the plugin renders.' },
  },
]

export default function Landing(): ReactNode {
  return (
    <article className="site-landing">
      <header className="site-hero">
        <span className="site-eyebrow">Free, open source, no account</span>
        <h1>{TITLE}</h1>
        <p className="site-lede">
          Write a deck as plain Markdown on the left and watch it render on the right. Present it
          from this page, open a presenter window with your notes, share a link that holds the whole
          deck, and print one page per slide.
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
          Slides split on <code>---</code>, notes after <code>???</code>, fragments after{' '}
          <code>--</code>. GitHub still renders the file as a document.
        </li>
        <li>
          <strong>Present mode</strong>
          Full screen, keyboard and pointer navigation, a presenter window with the next slide and
          a clock, deep links to any slide.
        </li>
        <li>
          <strong>The renderer you already use</strong>
          One plugin turns the Markdown your app stores into an <code>&lt;article&gt;</code> of{' '}
          <code>&lt;section&gt;</code>s, on the server or in the browser.
        </li>
      </ul>

      <div className="site-prose">
        <span className="site-eyebrow">Install</span>
        <h2>The plugin, plus the editor for authoring</h2>
        <pre className="site-code">
          <code>npm install @react-markdown-kit/renderer @react-markdown-kit/slides</code>
        </pre>
        <pre className="site-code">
          <code>npm install @react-markdown-kit/editor</code>
        </pre>
        <p>
          Rendering a deck needs only the first line, and the root entry loads no React: a server
          component or a static build gets the same <code>&lt;article&gt;</code> of{' '}
          <code>&lt;section&gt;</code>s. The <code>/present</code> entry adds the show; the editor and the{' '}
          <code>/editor</code> entry are what the left pane of this page is made of.
        </p>

        <span className="site-eyebrow">How to</span>
        <h2>Slides from Markdown in three steps</h2>
        <ol className="site-steps">
          <li>
            <strong>Render a deck.</strong> Put <code>slides()</code> in a preset. Slides split on{' '}
            <code>---</code>, the notes start at <code>???</code>, a <code>--</code> is a pause, and{' '}
            <code>&lt;!-- class | background | name: … --&gt;</code> comments set a slide&rsquo;s
            properties. The output is static: no script, no classes, no inline style, and the notes
            carry the HTML <code>hidden</code> attribute.
            <pre className="site-code">
              <code>{RENDER}</code>
            </pre>
          </li>
          <li>
            <strong>Write plain Markdown.</strong> The same file is a document with rules on GitHub,
            in a diff and in any editor. A <code>---</code> inside a fence, a quote or a list never
            splits, and front matter at the top sets the title, the aspect ratio, and defaults for
            every slide.
            <pre className="site-code">
              <code>{DECK}</code>
            </pre>
          </li>
          <li>
            <strong>Present, then edit.</strong> The <code>/present</code> entry&rsquo;s{' '}
            <code>slides()</code> gives the deck a Present button, keyboard and pointer navigation,
            fragments, a presenter view with the notes and a clock, <code>#3</code> deep links and a{' '}
            <code>BroadcastChannel</code> that keeps two windows on the same slide. The{' '}
            <code>/editor</code> entry adds the slide break, the markers and the directive chips to the
            editor, with four toolbar buttons.
            <pre className="site-code">
              <code>{PRESENT}</code>
            </pre>
            <pre className="site-code">
              <code>{EDIT}</code>
            </pre>
          </li>
        </ol>

        <div className="site-deeper">
          <p>
            <strong>Go deeper.</strong> The <a href={docsUrl('/docs/slides')}>slides plugin docs</a> cover
            the dialect, every directive and diagnostic, the emitted HTML, the tokens the stylesheet
            reads, printing, and the editor and present options.{' '}
            <a href={docsUrl('/docs/editor/basics')}>Editor basics</a> covers the editor the left pane
            lives in.
          </p>
        </div>

        <h2>About this editor</h2>
        <ul>
          <li>
            The left pane is the rich editor with the <code>/editor</code> entry; the right pane is the
            renderer with the same preset. Type and the deck re-renders; press Present in the deck&rsquo;s
            control bar to show it from this window.
          </li>
          <li>
            The address bar holds the deck: <code>?d=</code> is the source, deflated and base64url
            encoded, so a link is the whole file. Share copies a link that opens in present mode.{' '}
            <em>Presenter window</em> opens a second window with the next slide, the notes and a clock;
            it and this window move together.
          </li>
          <li>
            Print gives each slide a 16 by 9 inch page, with the stylesheet&rsquo;s{' '}
            <code>break-after: page</code> and this site&rsquo;s own <code>@page</code> rule. The deck
            uses container units to scale, so nothing measures the window.
          </li>
          <li>
            See the other plugins at work in the <a href={sites.editorDemo}>editor demo</a>, the Mermaid
            canvas in the <a href={sites.mermaidDemo}>Mermaid editor</a>, or just the rendering in the{' '}
            <a href={sites.rendererDemo}>renderer demo</a>.
          </li>
        </ul>

        <Faq id="slides-faq" items={FAQ} />
      </div>

      <JsonLd data={webApplication({ name: TITLE, url: sites.slidesDemo, description: DESCRIPTION })} />
    </article>
  )
}
