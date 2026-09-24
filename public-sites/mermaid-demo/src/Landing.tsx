import type { ReactNode } from 'react'
import { docsUrl, sites } from '../../shared/Shell'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../shared/Seo'
import { badgeMarkdown, EXAMPLE_HASH, EXAMPLE_SOURCE, shareUrl } from './share'

/*
 * The crawlable copy of mermaid.reactmarkdownkit.com. It targets the searches
 * in docs/SEO_PLAN.md 4.3: "mermaid visual editor free / online / open
 * source", "mermaid editor drag and drop" and "flowchart to mermaid". The
 * built index.html carries it before the app mounts (shared/vite-seo.ts).
 */

export const TITLE = 'Free Online Mermaid Visual Editor'

/** Also the meta description in index.html; tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Free, open source Mermaid visual editor: edit flowcharts and sequence diagrams on a canvas, watch the code follow, and get plain Mermaid back. No account.'

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

const STANDALONE = `import { MermaidCanvas } from '@react-markdown-kit/mermaid/canvas'
import '@react-markdown-kit/mermaid/styles.css'

<div style={{ height: 600 }}>
  <MermaidCanvas value={source} onChange={setSource} />
</div>`

const VANILLA = `import { createMermaidCanvas } from '@react-markdown-kit/mermaid/canvas'

const canvas = createMermaidCanvas(document.getElementById('diagram'), {
  value: 'flowchart LR\n  a[Web] --> b[API]',
  onChange: (source) => save(source),
})`

/** The badge snippet for the three-node example, with its diagram in the hash. */
const BADGE = badgeMarkdown(shareUrl(EXAMPLE_HASH))

const EMBED = `<iframe src="${shareUrl(EXAMPLE_HASH).replace('/#', '/?embed=1#')}" width="100%" height="520" style="border:0" title="Mermaid visual editor" loading="lazy"></iframe>`

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
      'Yes. Drag a box or a connector on the flowchart canvas and the code pane updates. The positions are saved as one %% rmk-layout v1 comment on the last line, which every other Mermaid renderer ignores. In a sequence diagram, drag a participant to reorder the columns or a message to move it, and the Mermaid is rewritten with no extra comment.',
    more: { href: docsUrl('/docs/mermaid'), label: 'How the layout comment works.' },
  },
  {
    question: 'How do I turn a flowchart into Mermaid syntax?',
    answer:
      'Draw it here: add boxes and connectors on the canvas, then copy the Mermaid from the code panel. The editor converts a drawing into text. It does not read an image of a flowchart.',
  },
  {
    question: 'Does the Mermaid it writes render on GitHub?',
    answer:
      'Yes. The output is ordinary Mermaid syntax, so the same fence renders on GitHub, GitLab, Notion and Obsidian, and in the React Markdown Kit renderer as static SVG.',
  },
  {
    question: 'Which Mermaid diagram types does it support?',
    answer:
      'Flowcharts, written as flowchart or graph, and sequence diagrams both open on a canvas: drag nodes and connectors in a flowchart; add participants, draw messages between lifelines, add notes and wrap items in loop, alt or par frames in a sequence diagram. Both render as static SVG. Class, state, Gantt and the other types are shown as source, and a host app can render them with its own Mermaid.js through the plugin fallback entry. A document that mixes them still round-trips.',
  },
  {
    question: 'Can I share a diagram by link?',
    answer:
      'Yes. Copy link puts the whole diagram, layout comment included, compressed into the URL hash, so the link needs no server and nothing is uploaded. Opening it restores the drawing on the canvas.',
  },
  {
    question: 'Does it need Mermaid.js or a server?',
    answer:
      'No. The plugin parses flowcharts and sequence diagrams itself and draws static SVG, so nothing loads Mermaid.js. Once the page is open the editor needs no server, and nothing you type leaves your browser.',
  },
]

export default function Landing(): ReactNode {
  return (
    <article id="docs" className="site-landing">
      <header className="site-hero">
        <span className="site-eyebrow">Free, open source, no account</span>
        <h1>{TITLE}</h1>
        <p className="site-lede">
          Draw the diagram, get the Mermaid. Edit the Mermaid, the drawing follows. Paste a
          flowchart or a sequence diagram from GitHub, a wiki or an AI chat, fix it by dragging,
          and copy plain Mermaid syntax back. Both kinds are edited on a canvas.
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
          Type Mermaid in the code panel and the diagram re-parses. Drag a flowchart node or a
          sequence message on the canvas and the code panel shows exactly what would be saved.
        </li>
        <li>
          <strong>Plain Mermaid out</strong>
          What you save is ordinary Mermaid syntax, plus one layout comment on a flowchart, so it
          renders on GitHub, GitLab, Notion and Obsidian unchanged.
        </li>
        <li>
          <strong>No Mermaid.js</strong>
          The plugin parses flowcharts and sequence diagrams itself and draws static SVG: no
          script, no{' '}
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
          canvas or a source editor with a preview. Nothing here loads the Mermaid library: the
          plugin parses the flowchart and sequence diagram subsets itself and draws static SVG,
          so it renders in a server component or a static build.
        </p>

        <span className="site-eyebrow">Standalone</span>
        <h2>The canvas on its own, in any container</h2>
        <p>
          The editor on this page is the plugin's standalone canvas: no Markdown editor, just
          Mermaid in and Mermaid out. It fills whatever element you give it and floats its tools
          over the drawing, the same canvas the Markdown editor opens on a fence.
        </p>
        <pre className="site-code">
          <code>{STANDALONE}</code>
        </pre>
        <pre className="site-code">
          <code>{VANILLA}</code>
        </pre>
        <p>
          Select several boxes and connectors with Shift+click or by dragging a box around them,
          then drag any of them, or the empty space inside the selection frame, to move them
          together. The handles on the frame resize the whole selection: a corner scales it
          evenly from the opposite corner, a side stretches it along one axis, and Alt scales
          from the centre. Arrow keys nudge the selection by one pixel, ten with Shift, and
          Cmd+Z or Ctrl+Z undoes.
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
            and Obsidian, because it is ordinary Mermaid syntax. Without positions a flowchart is
            laid out for you; a sequence diagram always is.
            <pre className="site-code">
              <code>{FENCE}</code>
            </pre>
          </li>
          <li>
            <strong>Edit on a canvas.</strong> Use the <code>/editor</code> entry&rsquo;s{' '}
            <code>mermaid()</code> in the editor&rsquo;s preset. Dragging a flowchart writes Mermaid
            back with one <code>%% rmk-layout v1</code> comment on the last line, which every other
            renderer ignores and this plugin reads back, so a drawing round-trips without loss. A
            sequence diagram is edited on its own canvas, which writes plain Mermaid with no
            comment at all: participants, messages, notes and frames are the syntax.
            <pre className="site-code">
              <code>{EDIT}</code>
            </pre>
          </li>
        </ol>

        <div className="site-deeper">
          <p>
            <strong>Go deeper.</strong> The <a href={docsUrl('/docs/mermaid')}>Mermaid plugin docs</a> list the
            flowchart subset (every node shape, edge style, <code>subgraph</code>, <code>style</code>{' '}
            colours and front-matter titles), the sequence diagram subset, the layout annotation
            format and the editor options.{' '}
            <a href={docsUrl('/docs/editor/basics')}>Editor basics</a> covers the editor the canvas lives in.
            Four guides cover one job each:{' '}
            <a href={docsUrl('/react-mermaid')}>Mermaid in React without Mermaid.js</a>,{' '}
            <a href={docsUrl('/mermaid-live-editor-alternative')}>a Mermaid Live Editor alternative</a>,{' '}
            <a href={docsUrl('/flowchart-to-mermaid')}>flowchart to Mermaid</a> and{' '}
            <a href={docsUrl('/edit-ai-generated-mermaid')}>fixing AI-generated Mermaid</a>.
          </p>
        </div>

        <h2>About this editor</h2>
        <ul>
          <li>
            The left pane is Mermaid syntax; the right pane is the same fence as the plugin edits
            it: a drawing canvas for a flowchart, a sequence canvas for a sequence diagram. Type
            and it re-parses; drag and the code pane shows exactly what would be saved. The chip
            over the code names the first statement Mermaid itself would reject.
          </li>
          <li>
            Class, state, Gantt and the other Mermaid diagram types are shown as source, so a
            document that mixes them still round-trips, and a host app can draw them with its own
            Mermaid.js through the plugin&rsquo;s fallback entry. Delete the layout comment and the
            flowchart is auto-laid out again.
          </li>
          <li>
            See the fence next to prose, tables and template variables in the{' '}
            <a href={sites.editorDemo}>editor demo</a>, or just the rendering in the{' '}
            <a href={sites.rendererDemo}>renderer demo</a>.
          </li>
        </ul>

        <span className="site-eyebrow">Share</span>
        <h2>Open in visual editor badge</h2>
        <p>
          A link carries the diagram: the source, layout comment included, is compressed into the
          URL hash (<code>#pako:</code>, the same zlib form mermaid.live uses), so nothing is uploaded
          and the link needs no server. Paste this in a README and the badge opens the diagram on
          the canvas. Press <strong>Share</strong> in the editor above to get the snippet for your own
          diagram.
        </p>
        <pre className="site-code">
          <code>{BADGE}</code>
        </pre>
        <p>
          The badge is <a href="/badge.svg">/badge.svg</a>, a static SVG on this host. The link in this
          example opens this three-node flowchart:
        </p>
        <pre className="site-code">
          <code>{EXAMPLE_SOURCE}</code>
        </pre>
        <p>
          To put the editor in a blog post or a docs page, add <code>?embed=1</code> to any link and
          the site chrome is hidden:
        </p>
        <pre className="site-code">
          <code>{EMBED}</code>
        </pre>

        <Faq id="mermaid-faq" items={FAQ} />
      </div>

      <JsonLd data={webApplication({ name: TITLE, url: sites.mermaidDemo, description: DESCRIPTION })} />
    </article>
  )
}
