import type { ReactNode } from 'react'
import useBrokenLinks from '@docusaurus/useBrokenLinks'
import { CopyCode } from '../../components/landing/CopyCode'
import { Callout, Feature, Features, Hero, LinkRow, Page, Prose, Steps } from '../../components/landing/Page'
import { docsUrl, sites } from '../../sites'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../components/landing/Seo'

/** The suite the round-trip claims on this page point at. */
const ROUNDTRIP_TEST = `${sites.github}/blob/main/packages/editor/tests/roundtrip.test.ts`

/*
 * The crawlable copy of reactmarkdownkit.com/markdown-editor. It targets the searches
 * in docs/SEO_PLAN.md 4.2: "react markdown editor online / free", "wysiwyg
 * markdown editor react" and "lossless markdown editor". It renders
 * on the server into the built page; the demo above it loads in the browser.
 */

export const TITLE = 'Free Online Markdown Editor for React'

/** Also the meta description of the page (src/pages); tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Free online Markdown editor for React with rich, source and preview modes. It saves plain Markdown, needs no account and supports templates and diagrams.'

const EDITOR = `'use client'

import { useState } from 'react'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import '@react-markdown-kit/editor/styles.css'

export function Notes() {
  const [value, setValue] = useState('# Notes\\n\\nStart writing.')
  return <MarkdownEditor value={value} onChange={setValue} />
}`

const PRESET = `import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'

export const preset = defineMarkdownPreset({ extensions: [gfm(), mermaid()] })

<MarkdownEditor preset={preset} value={value} onChange={setValue} />`

const TEMPLATE = `import Markdown from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
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
      'This page is one. It runs in the browser, doesn’t need an account and saves plain Markdown. The component behind it is @react-markdown-kit/editor, which is MIT licensed.',
    more: { href: npmUrl('editor'), label: 'The package on npm.' },
  },
  {
    question: 'Is it a WYSIWYG Markdown editor?',
    answer:
      'Rich mode is WYSIWYG, source mode shows the Markdown and preview mode shows the rendered output. You can switch whenever you like, and the document is the same string in all three.',
    more: { href: docsUrl('/docs/editor/basics'), label: 'Editor basics.' },
  },
  {
    question: 'Does the editor change my Markdown?',
    answer:
      'No. If you open a document and save it, it stays byte for byte the same. We took 22 documents from an audit of another editor, all 22 round-trip unchanged, and that suite runs in CI.',
    more: { href: docsUrl('/docs/editor/round-trip'), label: 'The round-trip suite.' },
  },
  {
    question: 'Can I check the round trip on my own Markdown?',
    answer:
      'Yes. Paste a document into the round-trip panel on this page. The editor opens it and saves it back, then the panel shows a line diff (or tells you the two are identical).',
    more: { href: ROUNDTRIP_TEST, label: 'The same bridge the test suite runs.' },
  },
  {
    question: 'What is the editor built on?',
    answer:
      'Lexical. The React component wraps a Lexical editor, and there’s a headless API that gives you the same engine without the toolbar and chrome.',
    more: { href: docsUrl('/docs/editor/headless'), label: 'Headless use.' },
  },
  {
    question: 'Can I add variables and diagrams?',
    answer:
      'Yes. The template plugin shows {{placeholders}} as chips while you write and resolves them at render time. The Mermaid plugin turns a mermaid fence into a canvas you can draw on.',
    more: { href: docsUrl('/docs/templates/basics'), label: 'Template basics.' },
  },
  {
    question: 'Does it need a design system?',
    answer:
      'No. The editor ships an optional stylesheet and reads CSS custom properties. None of the packages use Tailwind, a theme provider or CSS-in-JS.',
    more: { href: docsUrl('/docs/styling'), label: 'Styling options.' },
  },
]

export interface LandingProps {
  /**
   * The round-trip panel. It loads in the browser only (Demo.tsx); the copy
   * around it renders on the server.
   */
  readonly roundTrip?: ReactNode
}

export default function Landing({ roundTrip }: LandingProps): ReactNode {
  // Other pages link to #round-trip; a plain id is invisible to the build's anchor check.
  useBrokenLinks().collectAnchor('round-trip')
  return (
    <Page>
      <Hero
        kicker="Free and open source, no account needed"
        title={TITLE}
        lede={
          <>
            A rich text editor that reads and writes plain Markdown. It&rsquo;s free, runs in your
            browser and doesn&rsquo;t need an account. You can write in rich, source or preview mode,
            add typed variables and Mermaid diagrams, and what you save is the same string you opened.
          </>
        }
      >
        <LinkRow>
          <a href={docsUrl('/react-markdown-editor')}>Editor docs</a>
          <a href={npmUrl('editor')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </LinkRow>
      </Hero>

      <Features>
        <Feature title="Saves plain Markdown">
          Your app keeps storing plain strings. All 22 audited documents open and save byte for
          byte, and that suite runs in CI.
        </Feature>
        <Feature title="Three modes">
          Rich, source and preview, and you can switch between them at any time. The toolbar is
          optional, and you can use the engine headless if you want.
        </Feature>
        <Feature title="Plugins">
          Template variables shown as chips, Mermaid flowcharts on a canvas, and slide decks. Each
          one is a separate package.
        </Feature>
      </Features>

      <Prose>
        <h2>Install the editor and the two plugins this demo uses</h2>
        <CopyCode code="npm install @react-markdown-kit/editor @react-markdown-kit/renderer" />
        <CopyCode code="npm install @react-markdown-kit/template @react-markdown-kit/mermaid" />
        <p>
          The editor needs the renderer for its preview mode and its parser. The template and Mermaid
          packages are optional plugins, so you only need them if you want variables or diagrams.
        </p>

        <h2>Edit Markdown in three steps</h2>
        <Steps>
          <li>
            <strong>Mount the editor.</strong> It takes Markdown and gives you Markdown back, so your
            app keeps storing plain strings, and opening and closing a document doesn&rsquo;t change
            it. The stylesheet is optional (the editor works without it).
            <CopyCode code={EDITOR} />
          </li>
          <li>
            <strong>Share a dialect.</strong> Define your Markdown features once in a preset and pass
            it to both the editor and the renderer. A <code>```mermaid</code> fence becomes a canvas in the
            editor and static SVG in the renderer.
            <CopyCode code={PRESET} />
          </li>
          <li>
            <strong>Add variables.</strong> The template plugin shows placeholders as chips while you
            write and resolves them when rendering. Values go into the parsed tree, which means data
            can&rsquo;t inject Markdown.
            <CopyCode code={TEMPLATE} />
          </li>
        </Steps>

        <Callout>
          <p>
            <strong>More docs.</strong> <a href={docsUrl('/docs/editor/basics')}>Editor basics</a> covers modes,
            controlled and uncontrolled use and images, <a href={docsUrl('/docs/editor/headless')}>headless</a>{' '}
            shows how to keep the engine and replace the chrome, and{' '}
            <a href={docsUrl('/docs/editor/round-trip')}>round trip</a> explains how documents come
            through editing byte for byte. For the plugins, see <a href={docsUrl('/docs/templates/basics')}>templates</a>{' '}
            and <a href={docsUrl('/docs/mermaid')}>Mermaid</a>.
          </p>
        </Callout>

        <section id="round-trip">
          <h2>Paste Markdown, save it, read the diff</h2>
          <p>
            Paste a document below. The editor opens it and saves it straight back through the same
            headless bridge as{' '}
            <a href={ROUNDTRIP_TEST}>
              <code>packages/editor/tests/roundtrip.test.ts</code>
            </a>
            , then the panel diffs what you pasted against what was saved, line by line, and tells you
            if they match. The box starts out with things another editor corrupted in the audit (a
            setext heading, a list starting at 3, a nested quote, double backtick code, underscore
            emphasis and a reference link).
          </p>
          {roundTrip}
          <p>
            That suite runs 22 audited documents in CI and fails the build if any of them comes back
            changed. <a href={docsUrl('/docs/editor/round-trip')}>Round trip</a> lists the cases and
            what each one used to break.
          </p>
        </section>

        <h2>About this editor</h2>
        <ul>
          <li>
            The sample is a customer report, written once and resolved for one account. If you edit
            the template on the left, the right pane updates, since you changed the document and the
            data stayed the same. What gets saved is the placeholder. The chip only previews the value.
          </li>
          <li>
            You can edit the flowchart in place. If you drag a box, the saved Markdown is still plain
            Mermaid with one layout comment, and the placeholders around it aren&rsquo;t touched. The{' '}
            <a href={sites.mermaidDemo}>Mermaid editor</a> shows the same thing on its own.
          </li>
          <li>
            &ldquo;Copy link&rdquo; compresses the whole document into the URL hash and gives you the
            link. Nothing is uploaded and there&rsquo;s no account involved. Opening the link loads the
            document back into the editor.
          </li>
          <li>
            If you only install the renderer, you don&rsquo;t pull in any editor code or Lexical. The
            template and Mermaid root entries don&rsquo;t call React either, so the same resolution can
            run in a worker, a CLI or an email job. The{' '}
            <a href={docsUrl('/docs/security')}>security model</a> covers what to watch for when you mix
            authored text with runtime data.
          </li>
        </ul>

        <Faq id="editor-faq" items={FAQ} />
      </Prose>

      <JsonLd data={webApplication({ name: TITLE, url: sites.editorDemo, description: DESCRIPTION })} />
    </Page>
  )
}
