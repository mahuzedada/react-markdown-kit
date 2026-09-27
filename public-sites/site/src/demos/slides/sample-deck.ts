/**
 * The deck the demo opens with: nine slides about the kit itself, written so
 * that every construct of the dialect appears once. Front matter, a title
 * slide, an agenda, a fence that holds a `---` line (which never splits), a
 * background directive, fragments, speaker notes, a rule inside a slide and a
 * closing slide that reads well at 16:9 and at 4:3.
 */
export const SAMPLE_DECK = `---
title: Slides from Markdown
---

<!-- class: center, middle -->

# Slides from Markdown

One \`.md\` file. The renderer shows a deck, the editor writes it back, GitHub shows a document.

<!-- name: intro -->

---

## In the next eight slides

1. A deck is Markdown: what \`---\`, \`???\` and \`--\` mean
2. Directives: \`class\`, \`background\`, \`name\`
3. Fragments and speaker notes, live
4. Present mode, the presenter window and deep links
5. Scaling without a script, printing, theming

---

<!-- name: dialect -->

## A deck is Markdown

| You write | The plugin reads |
| --- | --- |
| \`---\` between blank lines | a slide break |
| a paragraph that is exactly \`???\` | the speaker notes start here |
| a paragraph that is exactly \`--\` | a pause: what follows is a fragment |
| \`<!-- class: center, middle -->\` | a directive for this slide |

Nothing above changes how the file looks on GitHub: it is a document with rules.

***

A \`***\` is a rule inside the slide. Only dashes split.

---

## A \`---\` inside a fence never splits

\`\`\`md
---
title: Q3 review
---

# Welcome

---

## Numbers
\`\`\`

The front matter and the break are inside a code block, so this slide holds both lines. Blocks nested in a list or a quote are safe too.

---

<!-- background: https://picsum.photos/seed/reactmarkdownkit/1600/900 -->
<!-- class: inverse, bottom -->

## Directives are comments

\`background\` becomes an \`<img>\` so the renderer's URL policy checks it. \`class\` becomes \`data-rmk-slide-class\`, never \`class\`. \`name\` gives the slide an id for deep links.

---

## Fragments, one pause at a time

Press the right arrow, or click the right half of the slide.

--

- \`--\` on its own line is a pause
- Everything after it is the next fragment

--

- Fragments are hidden with \`visibility\`, so the layout never jumps
- The presenter window shows them too

---

<!-- name: notes -->

## Speaker notes

Everything after \`???\` stays out of the slide. It is an \`<aside hidden>\` in the static HTML and the notes column of the presenter view.

Open the presenter window from the header to read them next to the current slide, with a clock.

???

This is what the presenter sees. The audience window and this one share a BroadcastChannel, so moving here moves there.

Say the next slide is about scaling.

---

## Scaling, printing, theming

- Every slide is a size container; the body's font size is \`1.72cqw\`, so headings, lists and code follow the slide's width with no script
- Print gives each slide a page. The demo sets \`@page { size: 16in 9in }\`
- Colours are \`--rmk-slide-*\` and \`--rmk-deck-*\` custom properties: this site maps them onto its own theme, light and dark

---

<!-- class: center, middle, inverse -->

## Thanks

\`npm install @react-markdown-kit/renderer @react-markdown-kit/slides\`

Edit this deck on the left. The link in the address bar holds every change.
`
