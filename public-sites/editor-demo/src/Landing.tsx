import type { ReactNode } from 'react'
import { docsUrl, sites } from '../../shared/Shell'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../shared/Seo'

/*
 * The crawlable copy of editor.reactmarkdownkit.com. It targets the searches
 * in docs/SEO_PLAN.md 4.2: "react markdown editor online / free", "wysiwyg
 * markdown editor react" and "lossless markdown editor". The built
 * index.html carries it before the app mounts (shared/vite-seo.ts).
 */

export const TITLE = 'Free Online Markdown Editor for React'

/** Also the meta description in index.html; tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Free online Markdown editor for React with rich, source and preview modes. Plain Markdown in, plain Markdown out, no account, plus templates and diagrams.'

const EDITOR = `'use client'

import { useState } from 'react'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import '@react-markdown-kit/editor/styles.css'

export function Notes() {
  const [value, setValue] = useState('# Notes\\n\\nStart writing.')
  return <MarkdownEditor value={value} onChange={setValue} />
}`

const PRESET = `import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { mermaid } from '@react-markdown-kit/mermaid/editor'

export const preset = defineMarkdownPreset({ extensions: [gfm(), mermaid()] })

<MarkdownEditor preset={preset} value={value} onChange={setValue} />`

const TEMPLATE = `import Markdown from '@react-markdown-kit/renderer'
import { template } from '@react-markdown-kit/template'
import { templateVariables } from '@react-markdown-kit/template/editor'

// Authoring: every {{placeholder}} is a chip that previews the sample data.
<MarkdownEditor
  preset={preset}
  extensions={[templateVariables({ previewData: customer })]}
  value={source}
  onChange={setSource}
/>

// Rendering: the same source, resolved for one customer.
<Markdown preset={preset} extensions={[template({ data: customer })]}>
  {source}
</Markdown>`

const FAQ: readonly FaqItem[] = [
  {
    question: 'Is there a free online Markdown editor for React?',
    answer:
      'This page is one. It runs in the browser, needs no account and saves plain Markdown. The component behind it is @react-markdown-kit/editor, MIT licensed.',
    more: { href: npmUrl('editor'), label: 'The package on npm.' },
  },
  {
    question: 'Is it a WYSIWYG Markdown editor?',
    answer:
      'Rich mode is WYSIWYG, source mode shows the Markdown and preview mode shows the rendered output. Switch at any time; the document is the same string in all three.',
    more: { href: docsUrl('/docs/editor/basics'), label: 'Editor basics.' },
  },
  {
    question: 'Does the editor change my Markdown?',
    answer:
      'No. Opening a document and saving it leaves it byte for byte the same. 22 of 22 documents from an audit of another editor round-trip unchanged, and that suite runs in CI.',
    more: { href: docsUrl('/docs/editor/round-trip'), label: 'The round-trip suite.' },
  },
  {
    question: 'What is the editor built on?',
    answer:
      'Lexical. The React component wraps a Lexical editor, and a headless API exposes the same engine without the toolbar and chrome.',
    more: { href: docsUrl('/docs/editor/headless'), label: 'Headless use.' },
  },
  {
    question: 'Can I add variables and diagrams?',
    answer:
      'Yes. The template plugin shows {{placeholders}} as chips while authoring and resolves them at render time, and the Mermaid plugin turns a mermaid fence into a drawing canvas.',
    more: { href: docsUrl('/docs/templates/basics'), label: 'Template basics.' },
  },
  {
    question: 'Does it need a design system?',
    answer:
      'No. The editor ships an optional stylesheet and reads CSS custom properties. There is no Tailwind, no theme provider and no CSS-in-JS in any package.',
    more: { href: docsUrl('/docs/styling'), label: 'Styling options.' },
  },
]

export default function Landing(): ReactNode {
  return (
    <article className="site-landing">
      <header className="site-hero">
        <span className="site-eyebrow">Free, open source, no account</span>
        <h1>{TITLE}</h1>
        <p className="site-lede">
          A rich text editor that reads and writes plain Markdown. Write in rich, source or
          preview mode, add typed variables and Mermaid diagrams, and save the same string you
          opened.
        </p>
        <p className="site-hero-links">
          <a href={docsUrl('/react-markdown-editor')}>Editor docs</a>
          <a href={npmUrl('editor')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </p>
      </header>

      <ul className="site-features">
        <li>
          <strong>Markdown in, Markdown out</strong>
          Your application keeps storing plain strings. 22 of 22 audited documents open and save
          byte for byte, in a suite that runs in CI.
        </li>
        <li>
          <strong>Three modes</strong>
          Rich, source and preview, switched at any time. The toolbar is optional and the engine
          is available headless.
        </li>
        <li>
          <strong>Plugins for the hard parts</strong>
          Template variables as chips, Mermaid flowcharts on a canvas and slide decks, each a
          separate package.
        </li>
      </ul>

      <div className="site-prose">
        <span className="site-eyebrow">Install</span>
        <h2>The editor, and the two plugins this demo uses</h2>
        <pre className="site-code">
          <code>npm install @react-markdown-kit/editor @react-markdown-kit/renderer</code>
        </pre>
        <pre className="site-code">
          <code>npm install @react-markdown-kit/template @react-markdown-kit/mermaid</code>
        </pre>
        <p>
          The editor needs the renderer for its preview mode and its parser. The template and Mermaid
          packages are optional plugins: install them only when you want variables or diagrams.
        </p>

        <span className="site-eyebrow">How to</span>
        <h2>Edit Markdown in three steps</h2>
        <ol className="site-steps">
          <li>
            <strong>Mount the editor.</strong> Markdown in, Markdown out: your application keeps
            storing plain strings, and opening a document and closing it changes nothing. The
            stylesheet is optional; the editor works without it.
            <pre className="site-code">
              <code>{EDITOR}</code>
            </pre>
          </li>
          <li>
            <strong>Share a dialect.</strong> Define what Markdown means once, then pass the same
            preset to the editor and the renderer. A <code>```mermaid</code> fence becomes a canvas here and
            static SVG there.
            <pre className="site-code">
              <code>{PRESET}</code>
            </pre>
          </li>
          <li>
            <strong>Add variables.</strong> The template plugin shows placeholders as chips while
            authoring and resolves them while rendering. Values are placed into the parsed tree, so
            data can never inject Markdown.
            <pre className="site-code">
              <code>{TEMPLATE}</code>
            </pre>
          </li>
        </ol>

        <div className="site-deeper">
          <p>
            <strong>Go deeper.</strong> <a href={docsUrl('/docs/editor/basics')}>Editor basics</a> covers modes,
            controlled and uncontrolled use and images, <a href={docsUrl('/docs/editor/headless')}>headless</a>{' '}
            shows how to keep the engine and replace the chrome, and{' '}
            <a href={docsUrl('/docs/editor/round-trip')}>round trip</a> explains why documents survive
            editing byte for byte. For the plugins, see <a href={docsUrl('/docs/templates/basics')}>templates</a>{' '}
            and <a href={docsUrl('/docs/mermaid')}>Mermaid</a>.
          </p>
        </div>

        <h2>About this editor</h2>
        <ul>
          <li>
            A customer report, authored once and resolved for one account. Edit the template on the
            left and the right pane follows, because you changed the document, not the data. What is
            saved is the placeholder; the chip only previews the value.
          </li>
          <li>
            The flowchart is editable in place. Drag a box and the saved Markdown is still plain
            Mermaid, with one layout comment, while the placeholders around it stay untouched. The{' '}
            <a href={sites.mermaidDemo}>Mermaid editor</a> shows that on its own.
          </li>
          <li>
            Installing the renderer alone pulls no editor code and no Lexical, and the template and
            Mermaid root entries call no React, so the same resolution runs in a worker, a CLI or an
            email job. The <a href={docsUrl('/docs/security')}>security model</a> covers what mixing
            authored text with runtime data means.
          </li>
        </ul>

        <Faq id="editor-faq" items={FAQ} />
      </div>

      <JsonLd data={webApplication({ name: TITLE, url: sites.editorDemo, description: DESCRIPTION })} />
    </article>
  )
}
