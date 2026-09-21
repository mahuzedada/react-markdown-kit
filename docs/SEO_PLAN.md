# SEO plan: rank first for each package and plugin

Written 2026-09-20 from Google Trends (worldwide, past 12 months), live Google
result pages (US, English), npm download counts for the last 30 days, and an
audit of this repo's public surface. Trends numbers are relative indices, not
absolute volumes. Validate the shortlist in Google Keyword Planner before
committing writers, and replace every estimate here with Search Console data
once the sites are indexed.

## 1. What the research says

### 1.1 Search demand, by cluster

One Trends comparison across the five clusters (index, higher is more demand):

| Term | Index | Reading |
| --- | --- | --- |
| markdown editor | 37 | Largest cluster. Mixed consumer and developer intent. |
| mermaid editor | 25 | Second largest. Tool intent, people want to open something and draw. |
| markdown template | 9 | Mostly document templates (ADR, itinerary), not templating engines. |
| react markdown | 7 | Developer intent, dominated by the incumbent's brand. |
| markdown slides | 2 | Small. Brands (Marp, Slidev) carry the demand instead. |

Inside the renderer cluster: `react markdown` 52, `react-markdown` 32,
`markdown renderer` 20, `streamdown` 11, `markdown to jsx` 1. The breakout
rising query for "react markdown" is **streamdown** (Vercel's streaming
Markdown renderer for AI chat), followed by blocknote and react flow.

Inside the editor cluster: `milkdown` 20, `tiptap markdown` 20,
`wysiwyg markdown editor` 18, `react markdown editor` 13, `mdxeditor` 10.
Rising queries everywhere in this cluster are milkdown, mdxeditor, lexical and
tiptap. Searchers compare editors by name.

Inside the mermaid cluster: `draw.io` 72, `mermaid editor` 21,
`flowchart maker` 16, `mermaid live editor` 15, `mermaid chart` 14.
`mermaid visual editor` is too small to register on its own. Rising queries:
`mermaid.live` (+1700%), `mermaid free`, `mermaid live editor free`,
`svg editor`, `mermaid ai`, and for draw.io `draw.io mcp server` (+600%) and
`draw.io skill` (+1650%). `flowchart to mermaid` grew 4x between February and
June 2026 and indexes at twice `streaming markdown`.

Inside the slides cluster: `marp` 29, `slidev` 11, `reveal.js` 5,
`markdown presentation` 4, `markdown slides` 3. Rising: slidev, marp,
pptxgenjs, quarto, "markdown to pdf".

### 1.2 Who holds position one today

| Query | #1 today | Rest of page one | Winnable? |
| --- | --- | --- | --- |
| react markdown | github.com/remarkjs/react-markdown | its demo, Medium, Windmill, Strapi, Contentful, Stack Overflow, Reddit, uiw preview on npm | No. Navigational brand query. Target the modifiers instead. |
| react markdown editor | github.com/uiwjs/react-md-editor | its docs, MDXEditor, Strapi and Eddyter listicles, Reddit, Syncfusion, Contentful | Top 3 in 6 to 12 months. AI Overview shows a four-library table; the goal is a seat in that table. |
| mermaid visual editor | mermaid.ai/products/visual-editor (official, paid) | mermaid.live, mermaidflow.app (paid), GitHub saketkattu/mermaid-visual-editor, VS Code extension, MarkChart | #1 for the head term is the brand owner's. #1 achievable for "free", "online", "open source", "drag and drop", "alternative" variants. |
| markdown slides | marp.app | revealjs.com, sli.dev, johnloy gist, Deckset, deckless.app, Reddit | Head term no. "markdown slides online", "markdown slides editor", "marp alternative" yes. |
| markdown template variables | Medium (NocoBase) | Reddit, a GitHub Action README, mkdocs macros docs, Stack Overflow, markdowntools blog | Yes, quickly. Weak page. |

People-also-search-for terms Google showed, which are free keyword ideas:
"react-markdown alternative", "react-markdown renderer", "react markdown
example", "react-markdown remark-gfm", "react markdown editor online",
"react markdown editor free", "mermaid visual editor online free", "mermaid
visual editor vscode", "markdown slides online", "markdown slides template",
"markdown template variables github".

### 1.3 The market, in downloads per month

| Package | Downloads / 30 days |
| --- | --- |
| react-markdown | 120.9M |
| mermaid | 53.9M |
| streamdown | 21.4M |
| markdown-to-jsx | 16.6M |
| @mdxeditor/editor | 4.3M |
| @uiw/react-markdown-preview | 3.2M |
| @uiw/react-md-editor | 2.8M |
| @milkdown/react | 0.54M |
| @marp-team/marp-core | 0.39M |
| reveal.js | 0.38M |
| mdx-mermaid | 0.17M |
| @lightenna/react-mermaid-diagram | 0.017M |

Two conclusions. Streamdown reached 21M a month in about a year because AI
chat UIs are the fastest growing place Markdown is rendered. Nobody owns
"Mermaid in React": the React Mermaid packages are tiny.

### 1.4 Three strategic conclusions

1. **You cannot outrank a brand for its own name.** "react markdown" belongs to
   remarkjs, "mermaid visual editor" to mermaid.ai, "markdown slides" to Marp.
   Position one is achievable on comparative, modifier and how-to queries, and
   that is where switching decisions are made anyway.
2. **The growth is in AI workflows, not in classic docs sites.** Streamdown,
   "mermaid ai", "flowchart to mermaid", "draw.io mcp server" and "draw.io
   skill" are the rising queries. Markdown and Mermaid are the formats LLMs
   emit. Position the renderer as the streaming-safe renderer for AI output and
   the Mermaid editor as the visual editor for AI-generated diagrams.
3. **Discovery is now half search, half model.** Every page one above carries
   an AI Overview, and developers ask Claude, ChatGPT and Cursor which library
   to use. Getting cited by models (llms.txt, npm README, GitHub README,
   inclusion in the listicles those models read) is as important as the blue
   links.

## 2. Foundation work (blocks everything else)

Nothing ranks until this is done. Estimated one to two weeks.

1. **Publish to npm.** All five packages sit at 0.0.0 with no `publishConfig`,
   `repository` or `homepage` fields and no release workflow. Scoped packages
   default to restricted; set `"publishConfig": { "access": "public" }`. Add
   `repository`, `homepage` (the package's funnel page) and `bugs`. npm package
   pages rank for library names and are the first backlink to every funnel.
2. **Make the four demo sites crawlable.** renderer, editor, mermaid and slides
   demos ship a 1.1 kB shell with an empty `#root`. Google indexes what the
   client renders only sometimes and late. Author the landing copy (h1, what
   it is, three feature blocks, FAQ, links to docs and npm) as static HTML in
   each `index.html`, or prerender at build time with `renderToStaticMarkup`
   in a script. The app mounts below the copy. The home page needs the same.
3. **Per-host hygiene.** `robots.txt` with a `Sitemap:` line on all six hosts
   (none exists today). `sitemap.xml` on every host, with `lastmod`. Canonical
   on every page (missing on four sites). Open Graph and Twitter tags
   everywhere; replace the docs site's SVG `og:image` with a 1200x630 PNG,
   since social crawlers do not render SVG. Trim the slides demo description
   to 155 characters.
4. **Structured data.** JSON-LD is absent everywhere. Add `SoftwareSourceCode`
   on package pages, `WebApplication` on each demo, `FAQPage` where a page has
   an FAQ, `BreadcrumbList` on docs, `TechArticle` on guides.
5. **Fix the content defects the audit found.** `/docs/slides` renders the
   demo deck's "Q3 review" as the page h1. `/docs/renderer/components` has no
   h1. Mermaid and slides have no funnel pages, only docs pages.
6. **llms.txt on every host.** Today only docs.reactmarkdownkit.com serves it.
   Serve the same file from the apex and each demo host, and add a
   `## Alternatives and comparisons` section that states the differences from
   react-markdown, MDXEditor and mermaid.live in plain factual sentences.
7. **Search Console and Bing Webmaster** for all six hosts. Submit sitemaps.
   Record baseline positions for the target terms in section 4 before launch.
8. **Public GitHub repo** with topics (`react`, `markdown`, `markdown-editor`,
   `mermaid`, `mermaid-editor`, `slides`, `lexical`), a README that links every
   funnel and demo, and the compatibility and benchmark tables. GitHub holds
   position one for most library queries; the repo page is a ranking asset.

## 3. Domain and linking architecture

Keep the six hosts (already decided), but treat them as one site for linking:

- `reactmarkdownkit.com` is the hub. Static page, links to every package
  funnel, every demo and every comparison page. Currently an empty shell.
- `docs.reactmarkdownkit.com` holds all editorial content: funnels,
  comparisons, guides, migration. It is the only SSG site and already has
  sitemap, llms.txt and per-page Open Graph.
- Each demo host targets one tool-intent query cluster and links back to its
  docs funnel and npm page in static HTML, above the fold.
- Every docs page links to the matching demo with a "try it" call to action.
- Add shareable URL state to every demo (document or diagram encoded in the
  URL, like mermaid.live). Shared links are backlinks.

## 4. Targets per package and plugin

Each entry lists the primary term, the supporting terms, the page that should
rank, the current holder, and the content needed. "Time" is a realistic window
to reach position one after the foundation is live, assuming weekly content and
the outreach in section 5.

### 4.1 Renderer (`@react-markdown-kit/renderer`)

| Term | Page | Holder today | Time |
| --- | --- | --- | --- |
| react markdown renderer | docs `/react-markdown-renderer` (exists) | Strapi and Contentful blogs, remarkjs | 3 to 6 months |
| react markdown alternative | new docs `/react-markdown-alternative` | stackshare, Froala, Strapi | 3 months |
| streaming markdown react | new docs `/streaming-markdown` | Streamdown's own docs, AI SDK docs | 3 to 6 months |
| render markdown in react | new guide `/docs/guides/render-markdown-in-react` | Contentful, Windmill, Refine | 6 months |
| react-markdown vs markdown-to-jsx / vs streamdown / vs react-markdown-kit | new docs `/compare/*` | npm-compare, nobody substantive | 3 months |
| markdown next.js server component | docs `/nextjs-markdown` (exists) | Next.js docs, blogs | 6 months |

Content and product work:

- **Alternative page.** Lead with the compatibility evidence already generated
  (39 of 39 prop comparisons classified), the codemod, and the honest
  benchmark table. Google's AI Overview for "react markdown" praises safety
  and the absence of `dangerouslySetInnerHTML`; state the same guarantees with
  the tests that prove them.
- **Streaming page.** Confirm the renderer handles partial input: unclosed
  fences, half-written emphasis, a table mid-row, without flicker or layout
  jumps, and that a precompiled document re-renders incrementally. If it does
  not, build it; it is the single largest new demand in this cluster. Then
  publish "Streaming Markdown in React" with an AI SDK example and a
  head-to-head with Streamdown.
- **Comparison pages.** One page per pair. Same section order every time:
  install size, GFM, security defaults, streaming, SSR, plugins, migration.
  Comparison pages rank for both brand names and convert switchers.
- **Guide.** "Render Markdown in React" as the canonical how-to: plain render,
  GFM, custom components, links, code blocks, security, SSR, each example
  rendered by the kit on the page.
- Title pattern: `React Markdown Renderer | React Markdown Kit` (keep),
  `react-markdown alternative with a codemod | React Markdown Kit`,
  `Streaming Markdown in React | React Markdown Kit`.

### 4.2 Editor (`@react-markdown-kit/editor`)

| Term | Page | Holder today | Time |
| --- | --- | --- | --- |
| react markdown editor | docs `/react-markdown-editor` (exists) plus editor demo | uiwjs/react-md-editor on GitHub | top 3 in 6 to 12 months |
| wysiwyg markdown editor react | same funnel, section anchor | MDXEditor, Milkdown | 6 months |
| react markdown editor online / free | `editor.reactmarkdownkit.com` | uiw demo, MDXEditor demo | 3 to 6 months |
| lexical markdown editor | new guide `/docs/guides/lexical-markdown-editor` | Lexical playground, blog posts | 3 months |
| mdxeditor alternative, milkdown vs mdxeditor | new docs `/compare/mdxeditor`, `/compare/milkdown` | Eddyter, Strapi listicles | 3 to 6 months |
| lossless markdown editor / markdown round trip | new docs `/markdown-round-trip` | nobody | 3 months |

Content and product work:

- The AI Overview for "react markdown editor" is a four-row table: uiw,
  MDXEditor, editor-lite, Milkdown. The way in is to be in the sources it
  reads: the Strapi and Eddyter comparison posts, the remarkjs discussion
  #1148 ("feature rich markdown editor with preview using react-markdown"),
  and the r/react threads. See section 5.
- The unique claim is **round-trip fidelity**: 22 of 22 documents survive open
  and save unchanged. No competitor makes that claim with a test suite. Build
  the page around it, with a live "paste your Markdown, see the diff after a
  save" widget on the demo.
- Rename the editor demo title from `Editor demo` to
  `Free Online Markdown Editor for React | React Markdown Kit` and give the
  page static copy that mentions rich, source and preview modes.
- Lexical guide: "lexical markdown" is a live query with rising interest and
  the editor is built on Lexical. A guide that ships working code ranks.

### 4.3 Mermaid plugin (`@react-markdown-kit/mermaid`) and mermaid demo

This is the cluster with the best ratio of demand to competition, and the
user's stated goal is to be the standard for editing Mermaid visually online.

| Term | Page | Holder today | Time |
| --- | --- | --- | --- |
| mermaid visual editor free / online / open source | `mermaid.reactmarkdownkit.com` | mermaid.ai, mermaidflow.app (both paid) | 3 to 6 months |
| mermaid editor drag and drop | same | GitHub hobby projects, a Vercel demo | 3 months |
| mermaid live editor alternative | new docs `/mermaid-live-editor-alternative` | nobody substantive | 3 months |
| flowchart to mermaid | new docs `/flowchart-to-mermaid` plus demo mode | AI tools, Stack Overflow | 3 to 6 months |
| react mermaid / mermaid in react markdown | new docs `/react-mermaid` | tiny packages, blog posts | 3 months |
| mermaid editor | demo, long term | mermaid.live, mermaid.ai | top 5 in 12 months |

Content and product work:

- **Landing copy on the demo host**, static: "Free online Mermaid visual
  editor. Draw the flowchart, get the Mermaid. Edit the Mermaid, the drawing
  follows." Then: no account, no paywall, open source, exports SVG and
  Mermaid, round-trips to any Markdown that supports mermaid fences (GitHub,
  GitLab, Notion, Obsidian). FAQ with the exact phrasings people search:
  "Is there a free Mermaid visual editor?", "Can I drag and drop nodes in
  Mermaid?", "How do I convert a flowchart to Mermaid syntax?".
- **Shareable URLs and embeds.** mermaid.live grew on `mermaid.live/edit#pako:`
  links. Do the same, and add an "Open in visual editor" badge Markdown that
  README authors can paste. Every paste is a backlink.
- **"Edit AI-generated Mermaid visually"** page. Models emit Mermaid and get
  the layout wrong. Paste the output, fix it by dragging, copy the text back.
  This rides the "mermaid ai" and agent-diagram rising queries, and it is a
  distinct story from mermaid.ai's own AI product.
- **flowchart to mermaid.** The query is about converting an existing drawing
  into Mermaid. A "draw from scratch, export Mermaid" mode is the honest
  answer; describe it as such. Image-to-Mermaid is a separate product and
  should not be claimed.
- **React developer page.** `/react-mermaid`: render mermaid fences in React
  Markdown, static SVG, no Mermaid.js runtime. Nobody owns this query.
- Reply on mermaid-js/mermaid-live-editor issue #1284 ("Drag-drop visual
  editor for Mermaid") and the mermaid-js discussion asking for a visual
  editor, with a link and a screen recording. Those threads rank today.
- Note that the plugin renders flowcharts only. Say so on the page; the
  searchers who need sequence diagrams will bounce anyway, and honesty here
  protects the click-through on everything else.

### 4.4 Slides plugin (`@react-markdown-kit/slides`) and slides demo

Demand is small and brand-led. Spend little, but take the free positions.

| Term | Page | Holder today | Time |
| --- | --- | --- | --- |
| markdown slides online / markdown slides editor | `slides.reactmarkdownkit.com` | deckless.app, Marp | 3 months |
| marp alternative, slidev alternative | new docs `/marp-alternative` | nobody substantive | 3 months |
| markdown presentation react | docs `/docs/slides` rewritten as a funnel | mdx-deck (archived), reveal.js | 3 to 6 months |
| markdown to slides | same funnel | Marp, Slidev | 6 months |

Content and product work:

- Rewrite the slides docs page as a funnel with its own h1 (today the deck's
  "Q3 review" heading leaks) and move the example deck below the fold.
- One comparison page against Marp, Slidev and reveal.js with the honest
  framing: those export PDF and PPTX, this plugin renders decks inside a
  React app from the same Markdown you already render, with present mode and
  speaker notes. Rising queries "markdown to pdf" and "pptxgenjs" show export
  is what people miss; decide whether PDF export is on the roadmap before
  writing the page.
- Get listed in the johnloy "List of markdown presentation tools" gist and the
  awesome-markdown lists. The gist is on page one.

### 4.5 Template plugin (`@react-markdown-kit/template`)

Low volume, mixed intent, weak competition. Win it in one pass.

| Term | Page | Holder today | Time |
| --- | --- | --- | --- |
| markdown template variables | docs `/markdown-template-engine` (exists) plus a guide | Medium, Reddit, a GitHub Action | 1 to 3 months |
| markdown templating engine, markdown variables react | same funnel | mkdocs macros, Handlebars blogs | 3 months |
| personalized markdown, markdown placeholders react | new docs `/personalized-markdown` | nobody | 3 months |
| handlebars markdown react | new compare `/compare/handlebars` | Handlebars docs | 6 months |

Content and product work:

- The guide must answer the literal Reddit and Stack Overflow questions on
  page one: "how do I inject variables into a Markdown file", "can Markdown
  have variables", "placeholders in Markdown". Answer each in a sentence, then
  show the typed, schema-backed, injection-safe way the plugin does it, with
  the injection tests as evidence.
- Position against Handlebars and Mustache (141M and 63M downloads a month):
  they interpolate strings before parsing and so can inject Markdown or HTML;
  the plugin resolves placeholders inside the parser. That is a security
  argument nobody else on page one makes.
- The customer-report example from the spec (section 13.4) is the demo for
  this cluster. Build it once, use it on the funnel, the guide and the home
  page.

## 5. Off-page: links, listicles and models

Page one for every target is held by the same dozen publishers and threads.
Work them directly.

1. **Listicles that AI Overviews cite.** Strapi ("5 React Markdown Editors
   Compared"), Eddyter ("Best React Markdown Editor 2026"), Froala, Refine,
   Windmill, Contentful, medevel. Email each with the compatibility table,
   bundle numbers and the round-trip claim; ask for inclusion in the next
   update. Being in those tables puts the kit in the AI Overview tables.
2. **Threads that already rank.** remarkjs discussion #1148,
   mermaid-live-editor issue #1284, the mermaid-js visual editor discussion,
   the r/react "best markdown library" thread, the r/webdev "proper markdown
   render" thread, the Hacker News "Presentation slides with Markdown" thread.
   Answer with substance, one link.
3. **Directories.** npm (published), stackshare alternatives, npm-compare,
   openagentskill alternatives, awesome-react, awesome-markdown, awesome-mermaid,
   the johnloy gist, madewithreactjs, React newsletters (This Week in React,
   React Status, Bytes).
4. **Launches.** One launch per surface, staggered: Show HN for the Mermaid
   visual editor (tool launches do well there), Product Hunt for the same,
   Reddit r/reactjs for the renderer with the codemod story ("migrate from
   react-markdown in one command"), dev.to and Hashnode cross-posts of the
   comparison pages with canonical back to docs.
5. **Models.** Keep llms.txt current, keep the README on npm identical to the
   funnel's claims, and add a short "When to recommend React Markdown Kit"
   paragraph to llms.txt written the way a model would quote it. Ask in
   Claude, ChatGPT and Cursor monthly "what should I use to render Markdown in
   React" and log whether the kit appears.
6. **Community backlinks from the product.** Every demo gets "share" and
   "embed" and an "Open in editor" badge. Every docs page gets "Edit this
   page" on GitHub.

## 6. Cadence and sequencing

Weeks 1 to 2: section 2 foundation, npm publish, Search Console, baseline
positions.

Weeks 3 to 6: one page per package in this order, each with its demo copy and
JSON-LD: Mermaid landing and alternative page (highest demand to competition
ratio), renderer alternative and comparison pages, editor round-trip page,
template guide, slides funnel.

Weeks 7 to 12: streaming Markdown (product check, then page), Lexical guide,
react-mermaid page, flowchart-to-mermaid page, marp alternative. Outreach from
section 5 runs in parallel, two contacts a week.

Month 4 onward: one comparison or guide a week, driven by Search Console
queries that already show impressions at positions 5 to 20. Those are the
cheapest wins available and the list is unknowable until the data exists.

## 7. Measurement

Track weekly, in one sheet:

- Position and impressions in Search Console for the roughly 30 terms in
  section 4, per host.
- npm downloads per package, against the competitors in 1.3.
- Referring domains (Search Console links report, or Ahrefs Webmaster Tools,
  which is free for verified sites).
- Presence in AI answers for five prompts, one per package.
- Demo sessions and "share link created" events, since shares become links.

Checkpoints:

| When | Renderer | Editor | Mermaid | Slides | Template |
| --- | --- | --- | --- | --- | --- |
| 30 days | indexed, impressions on 10 terms | indexed | page one for two "free / online" variants | indexed | page one for "markdown template variables" |
| 90 days | #1 "react markdown alternative", top 5 "react markdown renderer" | top 10 "react markdown editor", #1 "markdown round trip" | #1 "mermaid live editor alternative", top 3 "mermaid visual editor free" | #1 "marp alternative" | #1 for three template terms |
| 180 days | #1 "react markdown renderer", top 3 "streaming markdown react" | top 3 "react markdown editor", in the AI Overview table | top 3 "mermaid visual editor", top 5 "mermaid editor" | #1 "markdown slides online" | hold |

If a term has not moved by the 90-day checkpoint, the page is wrong for the
intent. Read the top three results again and rewrite to match their format
before adding links.

## 8. Claims policy for every page

The spec's section 14.3 applies. Each ranking page makes claims that a test,
a benchmark or a generated table backs, and links to it. The audit found the
1 KB benchmark is 1.21x slower than react-markdown; say so on the comparison
page and show the 100 KB and precompiled numbers next to it. Honest pages
earn the links that dishonest pages lose.
