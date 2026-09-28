/**
 * The deck the demo opens with: a short tour of the plugin, written so
 * every construct of the dialect shows up at least once. Front matter with
 * deck-wide defaults, each layout, two columns, an incremental list,
 * stepped code, a background, a Mermaid diagram, fragments, speaker notes
 * and a fence that holds a `---` line (which never splits).
 */
export const SAMPLE_DECK = `---
title: Slides from Markdown
footer: React Markdown Kit
paginate: true
transition: slide
---

<!-- layout: cover -->
<!-- name: intro -->
<!-- paginate: false -->

# Slides from Markdown

One \`.md\` file. The left pane is the file, the right pane is the deck. GitHub shows the same file as a document.

---

<!-- incremental: true -->

## What's in this deck

- The syntax: breaks, markers and directives
- Layouts and two columns
- Code that highlights one step at a time
- Diagrams, pictures and speaker notes
- Presenting: overview, presenter view, drawing, export

???

The list reveals one item per press because of the \`incremental\` directive.

---

<!-- name: dialect -->

## A deck is Markdown

| You write | The plugin reads |
| --- | --- |
| \`---\` between blank lines | a slide break |
| \`???\` on its own line | speaker notes start here |
| \`--\` on its own line | a pause: what follows is the next step |
| \`::right::\` on its own line | the second column starts here |
| \`<!-- layout: two-cols -->\` | a directive for this slide |

A \`***\` is a rule inside the slide. Only dashes split.

---

<!-- layout: two-cols -->

## Two columns

Everything before \`::right::\` goes on the left.

\`\`\`md
<!-- layout: two-cols -->

## Two columns

Left side.

::right::

Right side.
\`\`\`

::right::

The right column holds the rest. A pause on one side still counts on the other.

--

- \`cover\`, \`center\`, \`section\`, \`fact\`, \`quote\`
- \`two-cols\`, \`image-left\`, \`image-right\`

---

## Code, one step at a time

\`\`\`ts {1-2|4-6|8|all}
import { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { slides } from '@react-markdown-kit/slides/present'

const preset = defineMarkdownPreset({
  extensions: [slides({ hashRouting: true, sync: 'talk' })],
})

<Markdown preset={preset}>{deck}</Markdown>
\`\`\`

The braces after the language pick the lines. GitHub ignores them.

---

<!-- layout: image-right -->
<!-- image: https://picsum.photos/seed/reactmarkdownkit/900/1000 -->

## Directives are comments

\`<!-- key: value -->\` on its own line sets something on one slide. The same keys in the front matter set the default for every slide.

\`image\` and \`background\` render as \`<img>\` elements, so the renderer's URL policy checks them like any other image.

---

## Diagrams render in the slide

\`\`\`mermaid
flowchart LR
  source[deck.md] --> parser[compileMarkdown]
  parser --> deck[article of sections]
  parser --> pptx[.pptx file]
  deck --> present[present mode]
\`\`\`

The Mermaid plugin draws this as static SVG. No Mermaid.js runtime on the page.

---

<!-- name: notes -->

## Fragments and notes

Press the right arrow, or click the right half of the slide.

--

Each \`--\` on its own line is one more step.

--

Everything after \`???\` stays off the slide. Press **p** to see it in the presenter view.

???

This is what the presenter sees, with the next step, a timer and the clock.

Press t to reset the timer, and + or - to change this text's size.

---

<!-- layout: section -->

## Presenting

---

## Keys while presenting

| Key | Does |
| --- | --- |
| **o** | overview of every slide, click one to go there |
| **p** | presenter view: next step, notes, timer |
| **d** / **l** | draw on the slide / laser pointer |
| **b** | black screen |
| **12** then **Enter** | go to slide 12 |
| **?** | every shortcut |

---

<!-- layout: fact -->

# 1 file

GitHub shows it as a document, this page shows it as a deck, and Export writes a .pptx.

---

<!-- layout: quote -->

> A \`---\` inside a code fence, a quote or a list never splits the slide.

---

<!-- layout: center -->
<!-- class: inverse -->
<!-- paginate: false -->

## Thanks

\`npm install @react-markdown-kit/renderer @react-markdown-kit/slides\`

Edit this deck on the left. The link in the address bar holds every change.
`
