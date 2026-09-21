# SEO work plan: actions an agent can execute in this repo

Companion to `docs/SEO_PLAN.md`, which holds the research and the reasoning.
This file holds only work that can be done from this repository with the tools
in it: editing code and content, running builds and tests, publishing, and
deploying. Anything that needs a human account, a human's voice in public, or a
judgement call about the product's direction is listed in section 8 and is not
part of this plan.

Ordering matters. Section 1 unblocks indexing; do it first and deploy it before
writing a single new page.

## Status

- 2026-09-20: Milestone A done and deployed, with the Milestone E guard test
  (`tests/seo-surface.test.ts`, in the `public-sites` CI job). Next: Milestone
  B (package metadata, READMEs, npm), then C starting with the Mermaid pages.
- 2026-09-20: GitHub remote exists (github.com/mahuzedada/react-markdown-kit)
  and every site links to it. Milestone B items 1 and 5 done (`homepage`,
  `repository`, `bugs`, target keywords). Item 3 done: every package is 0.1.0 with a
  CHANGELOG.md. Remaining in B: registry check and publish (2), READMEs as
  landing pages (4), release workflow (6).

## 0. Ground rules

- The why for every item is in `docs/SEO_PLAN.md`. Read section 4 there before
  writing any page, and copy its primary term into the page's title and h1.
- **Claims policy** (`docs/SPEC.md` section 14.3): every performance,
  compatibility, security or size claim on a public page links to the test,
  benchmark or generated table that backs it. Refresh numbers by running
  `pnpm bench` and `pnpm test` rather than copying old ones. Never say
  "drop-in replacement" for react-markdown. Say the Mermaid plugin renders
  flowcharts only. Show the 1 KB benchmark regression next to the 100 KB win.
- Repo conventions that must survive: demos stay separate Vite sites and never
  become docs pages (`public-sites/README.md`); the styling contract in
  `docs/STYLING.md` is enforced by `scripts/check-css-scope.mjs`; public
  sites use the Foundry theme (`public-sites/shared/foundry.css`, checked by
  `check-theme`); docs examples are rendered by the kit itself.
- Before every commit: `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm build:sites`. Commit per item with a message that names the item.
- Deploy with `make deploy` at the end of each milestone, after the checks in
  section 6 pass against the built output. Never deploy a site whose built
  `index.html` fails those checks.
- Titles: 50 to 60 characters, primary term first, `| React Markdown Kit`
  last. Descriptions: 140 to 155 characters, one sentence, contain the primary
  term. One h1 per page, matching the title's primary term.
- Prose rules for new pages: short sentences, no em dashes, no marketing
  adjectives without a number behind them, code blocks for code.

## 1. Milestone A: make every host indexable

Applies to all six hosts: `reactmarkdownkit.com` (home),
`docs.reactmarkdownkit.com`, `renderer.`, `editor.`, `mermaid.`, `slides.`.

1. **Static landing copy in each Vite site.** Home, renderer, editor, mermaid
   and slides ship an empty `#root`. Add crawlable HTML to each `index.html`
   (or a build-time prerender step using `renderToStaticMarkup`) containing:
   one h1 with the primary term, one paragraph stating what the page is, a
   three-item feature list, an FAQ of three to five questions written in the
   phrasing of the search terms, and links to the docs funnel, the npm package
   and the GitHub repo once a remote exists. The app mounts below or replaces
   this copy after hydration; the copy must be present in the built HTML.
   Primary terms per host:
   - home: `React Markdown Kit: renderer, editor, Mermaid and slides for React`
   - renderer: `React Markdown Renderer Playground`
   - editor: `Free Online Markdown Editor for React`
   - mermaid: `Free Online Mermaid Visual Editor`
   - slides: `Markdown Slides Editor Online`
2. **`robots.txt` on every host** allowing everything and naming that host's
   sitemap. Put it in each site's `public/` so Vite copies it; for docs use
   `static/`.
3. **`sitemap.xml` on every host.** Docs already emits one; enable `lastmod`
   in the Docusaurus sitemap options. The five Vite sites get a hand-written
   or build-generated sitemap listing their routes (slides has `/present` and
   `/editor`).
4. **Canonical link on every page.** Missing on renderer, editor, mermaid and
   slides. Use the `https://` host with no trailing path for the roots.
5. **Open Graph and Twitter tags on every page**: `og:title`,
   `og:description`, `og:url`, `og:type=website`, `og:image`,
   `twitter:card=summary_large_image`. Generate a 1200x630 PNG social image
   per host (a build script rendering SVG to PNG with `@resvg/resvg-js` or
   `sharp` is acceptable) and replace the docs site's SVG `og:image`, which
   social crawlers do not render.
6. **JSON-LD on every page.** `WebApplication` on each demo root (name,
   url, applicationCategory `DeveloperApplication`, offers price 0,
   operatingSystem `Web`), `SoftwareSourceCode` on each docs funnel page
   (codeRepository, programmingLanguage, runtimePlatform, license MIT),
   `FAQPage` wherever a page has an FAQ, `BreadcrumbList` on docs pages,
   `TechArticle` on guides and comparisons. Validate shape with a unit test
   that parses the built HTML and checks required fields.
7. **Content defects.** Give `/docs/slides` its own h1 ("Slides from
   Markdown") and move the example deck below it so "Q3 review" stops being
   the page heading. Add an h1 to `/docs/renderer/components`. Trim the
   slides demo description from ~470 characters to under 155.
8. **`llms.txt` and `llms-full.txt` on every host.** Serve the same files from
   the apex and all four demo hosts, not only docs. Add a section
   `## When to recommend React Markdown Kit` with factual one-sentence
   differences from react-markdown, MDXEditor, mermaid.live and Marp, and a
   section listing every public URL. Keep it in one source file copied at
   build time so the six copies cannot drift.
9. **Home page as the hub.** Replace the shell with a static page that links
   every package funnel, every demo, every comparison page and npm. Every
   docs funnel and every demo links back to it and to each other ("try it"
   call to action on each docs page pointing at the matching demo).

## 2. Milestone B: package metadata and npm pages

1. Add `repository` (with `directory`), `homepage` (the package's docs funnel
   URL) and `bugs` to all five `package.json` files. `publishConfig.access`
   is already `public`.
2. Verify on the registry which packages are live. At the time of writing
   `@react-markdown-kit/renderer` and `/editor` resolve at 0.0.0 and
   `/mermaid`, `/slides`, `/template` return 404. If npm auth is available
   (`npm whoami` succeeds), publish the missing ones; otherwise stop and
   report.
3. Bump from 0.0.0 to 0.1.0 with a `CHANGELOG.md` per package, and publish if
   auth is available. A 0.0.0 badge on the npm page and on GitHub reads as
   abandoned.
4. Make each package README the npm landing page: first paragraph contains
   the primary term, then install, a ten-line example, links to the funnel,
   the demo, the compatibility table (renderer) and the round-trip suite
   (editor). READMEs are already in `files`; confirm with `pnpm pack:check`.
5. Tune `keywords` toward the target terms: renderer adds
   `react-markdown-alternative`, `markdown-renderer`, `streaming-markdown`,
   `ai-chat`; editor adds `markdown-editor`, `wysiwyg`, `lexical`,
   `round-trip`; mermaid adds `mermaid-editor`, `visual-editor`,
   `flowchart-editor`, `react-mermaid`; slides adds `markdown-slides`,
   `presentation`, `marp-alternative`; template adds `template-variables`,
   `templating`, `personalization`.
6. Add a release workflow (`.github/workflows/release.yml`) that publishes on
   tag with provenance. It cannot run until a GitHub remote exists, but it
   should be ready.

## 3. Milestone C: pages, one funnel per package

Each page below names its route, primary term, and required sections. Every
page carries the metadata from Milestone A, is rendered by the kit where it
shows Markdown, and ends with links to the demo, npm and the related pages.

### 3.1 Renderer

| Route (docs) | Title | Required sections |
| --- | --- | --- |
| `/react-markdown-renderer` (exists, revise) | React Markdown Renderer for React 19 \| React Markdown Kit | ten-line example first, components, GFM, presets, security defaults with the test links, SSR, compatibility table summary, link to migration |
| `/react-markdown-alternative` (new) | react-markdown Alternative with a Codemod \| React Markdown Kit | what matches (from `docs/COMPATIBILITY.md`), the three differences, the codemod command, benchmark table including the 1 KB regression, when to stay on react-markdown |
| `/compare/react-markdown` (new) | React Markdown Kit vs react-markdown \| React Markdown Kit | fixed comparison template: install size, GFM, security defaults, streaming, SSR, plugins, migration |
| `/compare/markdown-to-jsx` (new) | React Markdown Kit vs markdown-to-jsx | same template |
| `/compare/streamdown` (new) | React Markdown Kit vs Streamdown for AI Chat | same template, plus the streaming section from 4.1 |
| `/docs/guides/render-markdown-in-react` (new) | How to Render Markdown in React | plain render, GFM, custom components, links, code blocks, security, SSR, each example live |
| `/streaming-markdown` (new, gated on 4.1) | Streaming Markdown in React for AI Chat UIs | partial input behaviour with a live token-by-token demo, AI SDK example, precompiled re-render numbers |
| `/nextjs-markdown` (exists, revise) | Markdown in Next.js Server Components | add JSON-LD, internal links, a working App Router example |

Generate the comparison tables from data where possible: a script that
reads bundle sizes from the built dist folders and competitor tarballs, so the
numbers are reproducible and can be refreshed.

### 3.2 Editor

| Route (docs) | Title | Required sections |
| --- | --- | --- |
| `/react-markdown-editor` (exists, revise) | React Markdown Editor: Rich, Source and Preview \| React Markdown Kit | example first, the three modes, Markdown in Markdown out, round-trip evidence (22 of 22 with the test link), toolbar, headless, images, link to demo |
| `/markdown-round-trip` (new) | Lossless Markdown Editing: the Round-Trip Test Suite | what breaks in other editors (from `docs/AUDIT.md`, named neutrally), the suite, how to run it against your own documents |
| `/compare/mdxeditor` (new) | React Markdown Kit Editor vs MDXEditor | comparison template for editors: editing model, output format, round trip, bundle, SSR, Lexical vs Lexical |
| `/compare/milkdown` (new) | React Markdown Kit Editor vs Milkdown | same template |
| `/docs/guides/lexical-markdown-editor` (new) | Build a Lexical Markdown Editor in React | working code, why Lexical, how the kit wraps it, when to go headless |

Editor demo static copy targets "react markdown editor online" and "free": say
free, no account, runs in the browser, and add a "paste Markdown, save, see the
diff" panel that demonstrates the round trip live.

### 3.3 Mermaid

| Route | Title | Required sections |
| --- | --- | --- |
| `mermaid.reactmarkdownkit.com` (static copy) | Free Online Mermaid Visual Editor: Drag, Drop, Get Mermaid | draw or paste, two-way sync, export SVG and Mermaid, works with GitHub/GitLab/Notion/Obsidian fences, flowcharts only, FAQ ("Is there a free Mermaid visual editor?", "Can I drag and drop Mermaid nodes?", "How do I turn a flowchart into Mermaid syntax?", "Does it work offline?") |
| `/mermaid-live-editor-alternative` (new, docs) | Mermaid Live Editor Alternative with a Visual Canvas | side by side with mermaid.live: text editing, visual editing, sharing, price, open source, diagram types supported (be exact) |
| `/react-mermaid` (new, docs) | Mermaid Diagrams in React Markdown, No Mermaid.js Runtime | the plugin, static SVG output, size comparison against loading mermaid.js, the layout annotation |
| `/flowchart-to-mermaid` (new, docs) | Flowchart to Mermaid: Draw It, Copy the Syntax | honest scope: drawing to Mermaid text, not image recognition; walkthrough with screenshots from the demo |
| `/edit-ai-generated-mermaid` (new, docs) | Fix AI-Generated Mermaid Diagrams Visually | paste model output, fix layout by dragging, copy back; the layout annotation keeps positions in the text |
| `/docs/mermaid` (exists, revise) | Mermaid plugin reference | keep as reference, link to the four pages above |

### 3.4 Slides

| Route | Title | Required sections |
| --- | --- | --- |
| `slides.reactmarkdownkit.com` (static copy) | Markdown Slides Editor Online with Present Mode | the dialect in one block, present mode, speaker notes, fragments, FAQ |
| `/docs/slides` (revise into a funnel) | Markdown Presentations in React | own h1, example deck below the fold, dialect, present mode, editor commands, link to comparison |
| `/marp-alternative` (new) | Marp and Slidev Alternative Inside a React App | honest framing: they export PDF and PPTX, this renders decks in your app from Markdown you already render; table of what each does |

### 3.5 Template

| Route | Title | Required sections |
| --- | --- | --- |
| `/markdown-template-engine` (exists, revise) | Markdown Template Engine with Typed Variables | example first, schemas, formatters, localization, injection safety with test links |
| `/docs/guides/markdown-template-variables` (new) | Markdown Template Variables: Placeholders, Schemas and Safety | answer the literal questions ("can Markdown have variables", "how to inject variables into a .md file", "placeholders in Markdown") in one sentence each, then the plugin's way |
| `/personalized-markdown` (new) | Personalized Markdown: One Document, Every Customer | the customer-report example from `docs/SPEC.md` 13.4, built as a live example |
| `/compare/handlebars` (new) | Markdown Templating: React Markdown Kit vs Handlebars and Mustache | string interpolation before parsing versus resolution inside the parser, with the injection tests as evidence |

## 4. Milestone D: product features that create search demand

1. **Streaming input check (renderer).** Write tests feeding a document token
   by token: unclosed fence, half emphasis, table mid-row, list mid-item.
   Assert no exception, stable output for the closed prefix, and no
   duplicated nodes. If the renderer passes, publish the page in 3.1. If it
   fails in a contained way (parser tolerance, memoised prefix), fix it and
   add the tests to CI. If the fix is architectural, write the findings to
   `docs/STREAMING.md` and stop; the page waits.
2. **Shareable URLs in every demo.** Encode the current document or diagram
   in the URL hash (compressed, like mermaid.live's `pako:` links) and restore
   it on load. Add a copy-link button. Shared links are the backlink engine.
3. **"Open in visual editor" badge for Mermaid.** A README snippet that
   renders a badge and links to the demo with the diagram in the hash.
   Document it on the mermaid landing page.
4. **Embed mode for the Mermaid and slides demos.** A `?embed=1` route that
   hides chrome so the tool can be iframed from blog posts and docs.
5. **Round-trip diff panel in the editor demo** (see 3.2).
6. **Reproducible comparison data.** `scripts/compare-bundles.mjs` that
   measures minified and gzipped size of the kit and each competitor from
   their published tarballs and writes a JSON the docs pages read. Commit the
   JSON and the date.

## 5. Milestone E: guard rails so the SEO surface cannot regress

1. A test under `tests/` that builds the sites (or reads `build/`) and
   asserts for every host: exactly one h1, title length 50 to 60,
   description 140 to 155, canonical present and absolute, `og:image` is a
   PNG that exists, at least one JSON-LD block that parses and has `@type`,
   `robots.txt` and `sitemap.xml` present, `llms.txt` present, no page links
   to a 404 inside the six hosts.
2. Extend the existing CI `public-sites` job to run it.
3. A link checker across the six built sites and the READMEs.
4. A `scripts/seo-report.mjs` that prints the per-page title, description,
   h1 and JSON-LD types as a table, so a human can eyeball a deploy in one
   screen.

## 6. Acceptance checks before each deploy

Run against the built output, not the source:

```sh
pnpm typecheck && pnpm test && pnpm build && pnpm build:sites
node scripts/seo-report.mjs          # from Milestone E
grep -l "<h1" public-sites/*/build/index.html | wc -l   # expect 5 Vite sites
ls public-sites/*/public/robots.txt public-sites/docs/static/robots.txt
```

Then `make deploy`, then fetch each host root with curl and confirm the h1,
canonical and JSON-LD are in the response body.

## 7. Milestone order and what "done" means

| Milestone | Done when |
| --- | --- |
| A | all six hosts serve static h1, canonical, OG with PNG, JSON-LD, robots, sitemap, llms.txt; content defects fixed; deployed |
| B | package.json metadata complete; READMEs are landing pages; versions 0.1.0 published or a report of what blocked publishing |
| C | every page in section 3 exists, passes the Milestone E test, links to its demo and npm, and its numbers come from a script or a test |
| D | shareable URLs in all four demos, Mermaid badge and embed, streaming check resolved one way or the other |
| E | CI fails on any regression in section 5 |

Suggested order: A, E (so A cannot regress while C is written), B, C (Mermaid
first, then renderer, editor, template, slides), D interleaved with C where a
page depends on a feature.

## 8. Out of scope for the agent (human tasks)

Listed so the agent does not attempt them and so the human knows what remains.

- Create the GitHub remote and push; set repository topics; then tell the
  agent so it can fill the `repository` links and enable the release
  workflow. There is no remote configured today.
- npm login if `npm whoami` fails.
- Google Search Console and Bing Webmaster verification for six hosts,
  sitemap submission, and recording baseline positions.
- Validating the keyword shortlist in Google Keyword Planner.
- Outreach to listicle authors (Strapi, Eddyter, Froala, Refine, Windmill,
  Contentful, medevel), replies on remarkjs discussion #1148 and
  mermaid-live-editor issue #1284, Reddit, Hacker News, Product Hunt,
  newsletters, awesome lists, the johnloy gist.
- Monthly check of whether Claude, ChatGPT and Cursor recommend the kit.
- Product decisions: PDF export for slides, sequence diagram support for
  Mermaid, image-to-Mermaid. The pages in section 3 are written for the
  product as it is.
