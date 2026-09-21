import type { ReactNode } from 'react'
import { docsUrl, sites } from '../../shared/Shell'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../shared/Seo'

/*
 * The crawlable copy of mermaid.reactmarkdownkit.com. It targets the searches
 * in docs/SEO_PLAN.md 4.3: "mermaid visual editor free / online / open
 * source", "mermaid editor drag and drop" and "flowchart to mermaid". The
 * built index.html carries it before the app mounts (shared/vite-seo.ts).
 */

export const TITLE = 'Free Online Mermaid Visual Editor'

/** Also the meta description in index.html; tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Free, open source Mermaid visual editor: drag flowchart nodes on a canvas and get plain Mermaid back, or paste Mermaid and edit it visually. No account.'

const RENDER = `import Markdown, { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { mermaid } from '@react-markdown-kit/mermaid'
import '@react-markdown-kit/mermaid/styles.css'

const preset = defineMarkdownPreset({ extensions: [mermaid()] })

<Markdown preset={preset}>{content}</Markdown>`

const FENCE = `\`\`\`mermaid
flowchart LR
    web[Web App] -->|REST| api[API]
    api --> db[(Postgres)]
    style web fill:#a5d8ff,stroke:#1971c2
\`\`\``

const EDIT = `import { MarkdownEditor } from '@react-markdown-kit/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'

const preset = defineMarkdownPreset({ extensions: [mermaid()] })

<MarkdownEditor preset={preset} value={source} onChange={setSource} />`

const FAQ: readonly FaqItem[] = [
  {
    question: 'Is there a free Mermaid visual editor?',
    answer:
      'Yes, this page. It runs in your browser with no account and no paywall, and the editor behind it is the MIT licensed @react-markdown-kit/mermaid plugin.',
    more: { href: npmUrl('mermaid'), label: 'The package on npm.' },
  },
  {
    question: 'Can I drag and drop nodes in Mermaid?',
    answer:
      'Yes. Drag a box or a connector on the canvas and the code pane updates. The positions are saved as one %% rmk-layout v1 comment on the last line, which every other Mermaid renderer ignores.',
    more: { href: docsUrl('/docs/mermaid'), label: 'How the layout comment works.' },
  },
  {
    question: 'How do I turn a flowchart into Mermaid syntax?',
    answer:
      'Draw it here: add boxes and connectors on the canvas, then copy the Mermaid from the left pane. The editor converts a drawing into text. It does not read an image of a flowchart.',
  },
  {
    question: 'Does the Mermaid it writes render on GitHub?',
    answer:
      'Yes. The output is ordinary flowchart syntax, so the same fence renders on GitHub, GitLab, Notion and Obsidian, and in the React Markdown Kit renderer as static SVG.',
  },
  {
    question: 'Which Mermaid diagram types does it support?',
    answer:
      'Flowcharts only, written as flowchart or graph. Sequence, class, Gantt and the other diagram types stay ordinary code blocks, so a document that mixes them still round-trips.',
  },
  {
    question: 'Does it need Mermaid.js or a server?',
    answer:
      'No. The plugin parses the flowchart subset itself and draws static SVG, so nothing loads Mermaid.js. Once the page is open the editor needs no server, and nothing you type leaves your browser.',
  },
]

export default function Landing(): ReactNode {
  return (
    <article className="site-landing">
      <header className="site-hero">
        <span className="site-eyebrow">Free, open source, no account</span>
        <h1>{TITLE}</h1>
        <p className="site-lede">
          Draw the flowchart, get the Mermaid. Edit the Mermaid, the drawing follows. Paste a
          diagram from GitHub, a wiki or an AI chat, fix its layout by dragging, and copy plain
          Mermaid syntax back. Flowcharts only.
        </p>
        <p className="site-hero-links">
          <a href={docsUrl('/docs/mermaid')}>Plugin docs</a>
          <a href={npmUrl('mermaid')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </p>
      </header>

      <ul className="site-features">
        <li>
          <strong>Two-way sync</strong>
          Type Mermaid on the left and the canvas re-parses. Drag on the right and the code pane
          shows exactly what would be saved.
        </li>
        <li>
          <strong>Plain Mermaid out</strong>
          What you save is ordinary flowchart syntax plus one layout comment, so it renders on
          GitHub, GitLab, Notion and Obsidian unchanged.
        </li>
        <li>
          <strong>No Mermaid.js</strong>
          The plugin parses flowcharts itself and draws static SVG: no script, no{' '}
          <code>foreignObject</code>, and nothing loaded from a CDN.
        </li>
      </ul>

      <div className="site-prose">
        <span className="site-eyebrow">Install</span>
        <h2>The plugin, plus the editor for the canvas</h2>
        <pre className="site-code">
          <code>npm install @react-markdown-kit/renderer @react-markdown-kit/mermaid</code>
        </pre>
        <pre className="site-code">
          <code>npm install @react-markdown-kit/editor</code>
        </pre>
        <p>
          Rendering needs only the first line. The editor is what turns the fence into a drawing
          canvas. Nothing here loads the Mermaid library: the plugin parses the flowchart subset
          itself and draws static SVG, so it renders in a server component or a static build.
        </p>

        <span className="site-eyebrow">How to</span>
        <h2>Draw Mermaid in three steps</h2>
        <ol className="site-steps">
          <li>
            <strong>Render a fence.</strong> Put <code>mermaid()</code> in a preset and every{' '}
            <code>```mermaid</code> block becomes an SVG with no script, no <code>foreignObject</code> and
            no external reference.
            <pre className="site-code">
              <code>{RENDER}</code>
            </pre>
          </li>
          <li>
            <strong>Write plain Mermaid.</strong> The same fence renders on GitHub, GitLab, Notion
            and Obsidian, because it is ordinary flowchart syntax. Without positions it is laid out
            for you.
            <pre className="site-code">
              <code>{FENCE}</code>
            </pre>
          </li>
          <li>
            <strong>Edit on a canvas.</strong> Use the <code>/editor</code> entry&rsquo;s{' '}
            <code>mermaid()</code> in the editor&rsquo;s preset. Dragging writes Mermaid back with one{' '}
            <code>%% rmk-layout v1</code> comment on the last line, which every other renderer
            ignores and this plugin reads back, so a drawing round-trips without loss.
            <pre className="site-code">
              <code>{EDIT}</code>
            </pre>
          </li>
        </ol>

        <div className="site-deeper">
          <p>
            <strong>Go deeper.</strong> The <a href={docsUrl('/docs/mermaid')}>Mermaid plugin docs</a> list the
            flowchart subset (every node shape, edge style, <code>subgraph</code>, <code>style</code>{' '}
            colours and front-matter titles), the layout annotation format and the editor options.{' '}
            <a href={docsUrl('/docs/editor/basics')}>Editor basics</a> covers the editor the canvas lives in.
          </p>
        </div>

        <h2>About this editor</h2>
        <ul>
          <li>
            The left pane is Mermaid syntax; the right pane is a visual editor for the same fence.
            Type and the canvas re-parses; drag and the code pane shows exactly what would be saved.
          </li>
          <li>
            Sequence, class, Gantt and the other Mermaid diagram types stay ordinary code blocks, so
            a document that mixes them still round-trips. Delete the layout comment and the
            flowchart is auto-laid out again.
          </li>
          <li>
            See the fence next to prose, tables and template variables in the{' '}
            <a href={sites.editorDemo}>editor demo</a>, or just the rendering in the{' '}
            <a href={sites.rendererDemo}>renderer demo</a>.
          </li>
        </ul>

        <Faq id="mermaid-faq" items={FAQ} />
      </div>

      <JsonLd data={webApplication({ name: TITLE, url: sites.mermaidDemo, description: DESCRIPTION })} />
    </article>
  )
}
