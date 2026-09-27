import type { ReactNode } from 'react'
import CodeBlock from '../../components/CodeBlock'
import { Callout, Feature, Features, Hero, LinkRow, Page, Steps } from '../../components/landing/Page'
import { docsUrl, sites } from '../../sites'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../components/landing/Seo'
import { badgeMarkdown, EXAMPLE_HASH, EXAMPLE_SOURCE, shareUrl } from './share'

/*
 * The crawlable copy of reactmarkdownkit.com/mermaid-editor. It targets the searches
 * in docs/SEO_PLAN.md 4.3: "mermaid visual editor free / online / open
 * source", "mermaid editor drag and drop" and "flowchart to mermaid". It
 * renders on the server into the built page; the demo above it loads in the browser.
 */

export const TITLE = 'Free Online Mermaid Visual Editor'

/** Also the meta description of the page (src/pages); tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Free, open source Mermaid visual editor. Edit flowcharts and sequence diagrams on a canvas, the code updates as you go, and you get plain Mermaid back.'

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

const EDIT = `import { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
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
  value: 'flowchart LR\\n  a[Web] --> b[API]',
  onChange: (source) => save(source),
})`

/** The badge snippet for the three-node example, with its diagram in the hash. */
const BADGE = badgeMarkdown(shareUrl(EXAMPLE_HASH))

const EMBED = `<iframe src="${shareUrl(EXAMPLE_HASH).replace('#', '?embed=1#')}" width="100%" height="520" style="border:0" title="Mermaid visual editor" loading="lazy"></iframe>`

const FAQ: readonly FaqItem[] = [
  {
    question: 'Is there a free Mermaid visual editor?',
    answer:
      "Yes, you're on it. It runs in your browser, it's free, and you don't need an account. It's built on @react-markdown-kit/mermaid, which is MIT licensed.",
    more: { href: npmUrl('mermaid'), label: 'The package on npm.' },
  },
  {
    question: 'Can I drag and drop nodes in Mermaid?',
    answer:
      "Yes. Drag a box or an arrow in a flowchart and the code updates as you go. The positions are saved in one comment at the end of the diagram (%% rmk-layout v1), and other Mermaid tools skip it. In a sequence diagram you can drag participants to reorder them and drag messages to move them, and that doesn't add a comment at all.",
    more: {
      href: docsUrl('/docs/mermaid'),
      label: 'How the layout comment works.',
    },
  },
  {
    question: 'How do I turn a flowchart into Mermaid syntax?',
    answer:
      "Draw it here. Add boxes and arrows on the canvas, then copy the Mermaid from the code panel. It can't read a picture of a flowchart, though. You have to draw it on the canvas.",
  },
  {
    question: 'Does the Mermaid it writes render on GitHub?',
    answer:
      'Yes. What you get is regular Mermaid, so it renders on GitHub, GitLab, Notion and Obsidian. The React Markdown Kit renderer shows it as an SVG too.',
  },
  {
    question: 'Which Mermaid diagram types does it support?',
    answer:
      'Flowcharts (flowchart or graph) and sequence diagrams, and both open on a canvas. In a flowchart you drag boxes and arrows around. In a sequence diagram you add participants, draw messages between them, add notes and wrap steps in loop, alt or par blocks. Class, state, Gantt and the other types show up as code and are saved exactly as you wrote them. Your app can still draw those with Mermaid.js if you want.',
  },
  {
    question: 'Can I share a diagram by link?',
    answer:
      'Yes. Copy link packs the whole diagram into the URL, layout included. Nothing is uploaded and no server is involved. Whoever opens the link gets the same drawing on the canvas.',
  },
  {
    question: 'Does it need Mermaid.js or a server?',
    answer:
      'No. The plugin reads flowcharts and sequence diagrams on its own and draws them as SVG, so Mermaid.js never loads. Once the page is open, everything happens in your browser and nothing you type is sent anywhere.',
  },
]

export default function Landing(): ReactNode {
  return (
    // `#docs` is the target of the "Docs and FAQ below" island on the canvas.
    <Page id="docs">
      <Hero
        kicker="Free and open source. No sign-up."
        title={TITLE}
        lede={
          <>
            Draw a diagram and get the Mermaid code. Or paste some Mermaid and fix it by dragging things around. It
            works with flowcharts and sequence diagrams, including the ones you copy out of GitHub, a wiki or ChatGPT.
          </>
        }
      >
        <LinkRow>
          <a href={docsUrl('/docs/mermaid')}>Plugin docs</a>
          <a href={npmUrl('mermaid')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </LinkRow>
      </Hero>

      <Features>
        <Feature title="Code and canvas stay in sync">
          Type in the code panel and the diagram updates. Drag something on the canvas and the code changes to match.
        </Feature>
        <Feature title="Saves regular Mermaid">
          You save ordinary Mermaid, so it still renders on GitHub, GitLab, Notion and Obsidian. Flowcharts get one
          extra comment that remembers the layout, and other tools ignore it.
        </Feature>
        <Feature title={<>Doesn&rsquo;t need Mermaid.js</>}>
          The plugin reads your diagrams itself and draws them as plain SVG. There&rsquo;s no script to load and nothing
          comes from a CDN.
        </Feature>
      </Features>

      <h2>Install</h2>
      <CodeBlock language="bash">npm install @react-markdown-kit/mermaid</CodeBlock>
      <p>
        That&rsquo;s everything you need to render diagrams and use the canvas. npm installs the renderer for you. If
        you also want to edit diagrams inside a Markdown editor, step 3 below shows how.
      </p>
      <p>Since it never loads Mermaid.js, it works in server components and static builds too.</p>

      <h2>Using the canvas on its own</h2>
      <p>
        The editor you&rsquo;re using on this page is the standalone canvas. You give it Mermaid and it gives you
        Mermaid back (you don&rsquo;t need a Markdown editor for this). It fills whatever container you put it in.
      </p>
      <p>In a React app:</p>
      <CodeBlock language="tsx">{STANDALONE}</CodeBlock>
      <p>Or mount it into any element on the page:</p>
      <CodeBlock language="ts">{VANILLA}</CodeBlock>
      <p>A few things to try on the canvas:</p>
      <ul>
        <li>Double-click a shape or an arrow to type in it. Press Enter for a new line.</li>
        <li>
          Select a shape to change its colour, stroke width, dashes and corners, or an arrow to change its arrowheads.
          Cmd+D (Ctrl+D on Windows) makes a copy.
        </li>
        <li>
          Shift+click, or drag a box around a few shapes, to select them together. Drag to move them, or pull a handle
          on the frame to resize them. Hold Alt to resize from the centre.
        </li>
        <li>Nudge the selection with the arrow keys, and hold Shift for bigger steps.</li>
        <li>Cmd+Z or Ctrl+Z undoes the last change.</li>
      </ul>

      <h2>Adding Mermaid to your app</h2>
      <Steps>
        <li>
          <strong>Render your diagrams.</strong> Add <code>mermaid()</code> to your preset and every{' '}
          <code>```mermaid</code> block in your Markdown turns into an SVG.
          <CodeBlock language="tsx">{RENDER}</CodeBlock>
        </li>
        <li>
          <strong>Write regular Mermaid.</strong> Use the same syntax you&rsquo;d put in a GitHub README. If a
          flowchart has no layout saved yet, it gets laid out for you.
          <CodeBlock language="markdown">{FENCE}</CodeBlock>
        </li>
        <li>
          <strong>Edit them on a canvas.</strong> Install the editor, then use the <code>mermaid()</code> from the{' '}
          <code>/editor</code> entry in your editor&rsquo;s preset. When you drag a flowchart around, the plugin saves
          the positions in a <code>%% rmk-layout v1</code> comment at the end of the diagram. Other Mermaid tools
          ignore that comment, so nothing breaks. Sequence diagrams don&rsquo;t need it at all.
          <CodeBlock language="bash">npm install @react-markdown-kit/editor</CodeBlock>
          <CodeBlock language="tsx">{EDIT}</CodeBlock>
        </li>
      </Steps>

      <Callout>
        <p>
          <strong>More docs.</strong> The <a href={docsUrl('/docs/mermaid')}>Mermaid plugin docs</a> cover every
          supported shape and arrow, the layout comment and all the editor options, and{' '}
          <a href={docsUrl('/docs/editor/basics')}>Editor basics</a> explains the editor itself. There are also guides
          for <a href={docsUrl('/react-mermaid')}>using Mermaid in React without Mermaid.js</a>,{' '}
          <a href={docsUrl('/mermaid-live-editor-alternative')}>switching from the Mermaid Live Editor</a>,{' '}
          <a href={docsUrl('/flowchart-to-mermaid')}>turning a flowchart into Mermaid</a> and{' '}
          <a href={docsUrl('/edit-ai-generated-mermaid')}>fixing Mermaid that an AI wrote</a>.
        </p>
      </Callout>

      <h2>About this editor</h2>
      <ul>
        <li>
          The panel on the right is your Mermaid code, and the rest of the window is the canvas. If Mermaid would
          reject something in your code, a note under the code tells you which line.
        </li>
        <li>
          Class, state, Gantt and the other diagram types show up as code, and they&rsquo;re saved exactly as you
          wrote them. Your own app can still draw them with Mermaid.js through the plugin&rsquo;s fallback entry.
          Delete the layout comment from a flowchart and it goes back to automatic layout.
        </li>
        <li>
          The <a href={sites.editorDemo}>editor demo</a> shows diagrams next to regular Markdown, tables and template
          variables. If you only need rendering, there&rsquo;s also the <a href={sites.rendererDemo}>renderer demo</a>
          .
        </li>
      </ul>

      <h2>Adding an &ldquo;Open in visual editor&rdquo; badge</h2>
      <p>
        Every link to this editor carries the whole diagram inside the URL (<code>#pako:</code>, compressed the same
        way mermaid.live does it). Nothing gets uploaded and there&rsquo;s no server involved. Put this in a README
        and people can open your diagram with one click. To get the snippet for your own diagram, press{' '}
        <strong>Share</strong> in the editor above.
      </p>
      <CodeBlock language="markdown">{BADGE}</CodeBlock>
      <p>
        The badge image lives at <a href="/badge.svg">/badge.svg</a>. The link in the example above opens this
        flowchart:
      </p>
      <CodeBlock language="mermaid">{EXAMPLE_SOURCE}</CodeBlock>
      <p>
        To put the editor inside a blog post or a docs page, add <code>?embed=1</code> to any link. That hides the
        rest of the site:
      </p>
      <CodeBlock language="html">{EMBED}</CodeBlock>

      <Faq id="mermaid-faq" items={FAQ} />

      <JsonLd
        data={webApplication({
          name: TITLE,
          url: sites.mermaidDemo,
          description: DESCRIPTION,
        })}
      />
    </Page>
  )
}
