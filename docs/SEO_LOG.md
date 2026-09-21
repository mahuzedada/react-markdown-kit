# SEO log: the weekly sheet from `docs/SEO_PLAN.md` section 7

One entry per check. Search Console and referring-domain rows start once the
six properties are verified and have impressions. npm downloads come from
`https://api.npmjs.org/downloads/point/last-month/<package>`.

## Model checks

Five prompts, one per package, asked in a fresh chat with no custom
instructions. "Named" records whether the answer names React Markdown Kit or
any `@react-markdown-kit/*` package. The prompts are fixed so the monthly
runs compare:

1. Renderer: "What library should I use to render Markdown in a React 19 app?
   I want GFM tables, safe defaults (no dangerouslySetInnerHTML) and it should
   cope with streaming partial Markdown from an LLM. Name specific npm
   packages."
2. Editor: "I need a React Markdown editor with a rich WYSIWYG mode that saves
   plain Markdown and does not corrupt the document on open and save. Which
   npm packages should I consider? Name specific libraries."
3. Mermaid: "Is there a free online visual editor for Mermaid diagrams where I
   can drag and drop nodes and get the Mermaid text back? Name specific sites
   or tools."
4. Slides: "How can I render a slide deck from Markdown inside a React app,
   with present mode and speaker notes, rather than exporting to PDF with
   Marp? Name specific npm packages."
5. Template: "How do I use template variables or placeholders inside Markdown
   that I render in React, so one Markdown document can be personalized per
   customer safely? Name specific npm packages."

### 2026-09-21 (baseline, before any host was verified in Search Console)

| Prompt | Model | Named | What it recommended instead |
| --- | --- | --- | --- |
| Renderer | ChatGPT (6 Pro, web search) | no | react-markdown + remark-gfm + remend; Streamdown as the turnkey alternative, with a note that its Mermaid path uses dangerouslySetInnerHTML |
| Renderer | Claude (Fable 5.1, web search) | no | Streamdown first; react-markdown + remark-gfm + remend as the smaller option |
| Editor | ChatGPT | no | MDXEditor, Milkdown Crepe, Gravity UI markdown-editor, Tiptap, ZUI text-editor; told the asker to write their own round-trip acceptance tests |
| Editor | Claude | no | MDXEditor, Milkdown, Tiptap, with uiw react-md-editor as the source-only option; said no WYSIWYG editor is byte-for-byte lossless |
| Mermaid | ChatGPT | no | mermaid.ai (paid, 3 free diagrams), saketkattu/mermaid-visual-editor on GitHub, mermaidflow.app; noted mermaid.live is not drag and drop |
| Mermaid | Claude | no | mermaid.ai, mermaidflow, mermaid.live, draw.io, Excalidraw, Eraser, the saketkattu project |
| Slides | ChatGPT | no | @revealjs/react + reveal.js first, spectacle second, marp-core for existing decks |
| Slides | Claude | no | reveal.js, spectacle, mdx-deck, slidev, marp, remark |
| Template | ChatGPT | no | @markdoc/markdoc first; react-markdown + remark-directive; mustache, handlebars, liquidjs with a Markdown-injection warning |
| Template | Claude | no | mustache + react-markdown with manual escaping; a remark text-node plugin; remark-directive; Markdoc |

What the answers reveal, for the pages in `docs/SEO_PLAN.md` section 4:

- Both models already make the kit's own arguments for it: post-parse
  substitution beats string templating (template), no editor round-trips
  byte-for-byte (editor, where the kit's 22 of 22 suite is the counterclaim),
  Streamdown's raw-HTML default is a risk (renderer), mermaid.live cannot
  drag nodes and the saketkattu project has no import (mermaid). The pages
  that make those claims with test links are the ones the models will quote
  once they can find them.
- Both models cite the same sources: GitHub READMEs, npm pages, the Strapi
  listicle, and the vendors' docs. The outreach list in
  `docs/SEO_PLAN.md` section 5 is the right one.
- `remend` is now the standard answer for partial Markdown. `/streaming-markdown`
  and `/compare/streamdown` should say how the kit's tolerance differs from
  preprocessing the string.
- ChatGPT named `@zuilib/text-editor` for the editor prompt, which shares
  an author with this kit. Its docs are already indexed; the kit's are not.

## npm downloads, last 30 days

| Date | renderer | editor | mermaid | slides | template | react-markdown | streamdown | markdown-to-jsx | @mdxeditor/editor | @milkdown/react | marp-core | reveal.js |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-09-21 | 119 | 95 | 64 | 62 | 64 | 118.9M | 21.1M | 16.2M | 4.25M | 0.53M | 0.39M | 0.37M |

## Search Console

All six hosts are verified in Google Search Console and Bing Webmaster Tools
(2026-09-21, URL-prefix properties, HTML tag method) with `/sitemap.xml`
submitted on each. Rows start once impressions appear.

| Date | Host | Term | Position | Impressions | Clicks |
| --- | --- | --- | --- | --- | --- |

## Referring domains

| Date | Host | Referring domains | Source |
| --- | --- | --- | --- |
