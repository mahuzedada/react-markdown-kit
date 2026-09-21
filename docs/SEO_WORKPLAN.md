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
- 2026-09-20 (deployed the same day): Milestone B done: 0.1.0 of all five packages published to npm
  today, READMEs rewritten as npm landing pages (4), release workflow on
  `v*` tags with provenance and a version guard (6). Milestone E items 1, 3
  and 4 done: `tests/seo-surface.test.ts` strict on every built page,
  `tests/seo-links.test.ts`, `scripts/seo-report.mjs`, all in the
  `public-sites` CI job. Milestone D items 2, 3 and 4 done for the Mermaid
  demo: share links carry the source in the hash as
  `#pako:<base64url(zlib-deflate)>` with a `#base64:` fallback, the "Open in
  visual editor" badge (`/badge.svg` plus that link) and `?embed=1`.
  Milestone C 3.3 pages done: `/react-mermaid`,
  `/mermaid-live-editor-alternative`, `/flowchart-to-mermaid`,
  `/edit-ai-generated-mermaid`, cross-linked from `/docs/mermaid`, the home
  hub, the Mermaid demo and `llms.txt`. Next: C 3.1 renderer pages, D items
  2 to 4 for the renderer, editor and slides demos, D1 streaming check, D6
  `compare-bundles`.
- 2026-09-20 (not deployed): Milestone C items 3.1, 3.2, 3.4 and 3.5 done.
  New routes: `/react-markdown-alternative`, `/compare/react-markdown`,
  `/compare/markdown-to-jsx`, `/compare/streamdown`, `/streaming-markdown`,
  `/docs/guides/render-markdown-in-react`, `/markdown-round-trip`,
  `/compare/mdxeditor`, `/compare/milkdown`,
  `/docs/guides/lexical-markdown-editor`, `/personalized-markdown`,
  `/compare/handlebars`, `/docs/guides/markdown-template-variables` and
  `/marp-alternative`. All of them are in `sidebars.ts` or the footer, in
  `llms.txt` and `llms-full.txt`, on the home hub and on the docs index; the
  reference pages under `/docs/renderer`, `/docs/editor` and `/docs/templates`
  carry a "Read next" link to their funnel. `node scripts/seo-report.mjs`
  reports 49 pages and 0 problems. Next: deploy, then C 3.3 follow-ups and
  the remaining D items.
- 2026-09-20 (not deployed): review fixes across the Milestone C pages, and
  the Milestone D ledger. Milestone D is done: item 1's streaming verdict is
  **passes**, so `/streaming-markdown` is published and no `docs/STREAMING.md`
  was needed (`packages/renderer/tests/streaming.test.tsx`, 59 tests); items 2
  and 5 are the share-link hash and the round-trip diff panel in the editor
  demo and the share link in the renderer demo; item 3 is the Mermaid badge;
  item 4 is `?embed=1` for the Mermaid and slides demos; item 6 is
  `scripts/compare-bundles.mjs` and the committed `docs/data/bundle-sizes.json`
  that the comparison pages read through `CompareTable.tsx`. Milestone C 3.1,
  3.2, 3.4 and 3.5 pages all exist: the 14 routes listed in the bullet above.
  The review fixes in this commit: `/compare/streamdown` now says Streamdown
  *completes* an incomplete construct through `remend` rather than suppressing
  it, and links their features list; `/compare/markdown-to-jsx` states the
  measured `img` behaviour and the real `tagfilter` tag list; the three
  comparison pages no longer say the native and plugin GFM routes are
  "byte-identical", because `tests/gfm.test.ts` compares through the tolerant
  normalizer in `tests/helpers/html.ts`, and they name the 12 cases the
  plain-CommonMark run exempts; `/nextjs-markdown` cites
  `tests/packaging.test.ts` for the source check and `scripts/pack-check.mjs`
  for the tarball install; the unbacked "the extension is smaller" sentence is
  gone from `/docs/guides/render-markdown-in-react`; "roughly 80% of the work"
  is now "about two thirds" everywhere, which is what
  `benchmarks/README.md` measures (16.80 ms against 5.99 ms at 10 KB);
  `/react-markdown-renderer` has a one-sentence description carrying its
  primary term; `packages/editor/tests/roundtrip.test.ts` really runs the
  GFM-off column instead of falling through to the default preset (61 tests
  pass); the Lexical-types claim is scoped to the root entry and links
  `packages/editor/tests/styling.test.tsx` on all five pages that make it; the
  corruption fixture's `why` strings name "the audited editor" instead of the
  product, and the three placeholder rows describe a real failure; the editor
  FAQ gives the renderer's measured 36.8 KB instead of "far smaller";
  `/docs/guides/lexical-markdown-editor` ends with demo, npm and source links;
  the template guide no longer claims its left pane is editable and counts 6
  code-context cases out of 13 in the file; `/compare/handlebars` counts 18
  prototype-path cases in a 33-case file and describes its pane honestly;
  `/markdown-template-engine` cites both link test blocks; `/marp-alternative`
  builds its deck from `@react-markdown-kit/slides/present` so Present really
  works, describes Marp fragments as coming from the list marker, and links
  `tests/packaging.test.ts`; `/docs/slides` shows slide 2 of the deck the test
  asserts, carries the primary term in its h1 and links the packaging test.
  `pnpm typecheck`, `pnpm test` (1625 tests), `pnpm build` and
  `pnpm build:sites` pass; `tests/seo-surface.test.ts` and
  `tests/seo-links.test.ts` pass and `node scripts/seo-report.mjs` reports 49
  pages and 0 problems. What remains:
  - Not deployed, as instructed. The six sites are built but `make deploy` was
    not run, so none of the 14 new routes is live yet.
  - `/docs/slides` has title "Markdown Presentations in React" and h1
    "Markdown presentations in React", so they now match; the deck's "Q3
    review" heading no longer leaks as the page's h1.
  - The byte counts now in `public-sites/shared/llms/llms.txt` and
    `llms-full.txt` (36.8/35.5/48.5/46.4/27.8/152.2/110.3/163.1/104.9 KB
    gzipped) are typed into prose from `docs/data/bundle-sizes.json`, unlike
    the comparison pages, which read the JSON through `CompareTable.tsx`. A
    rerun of `scripts/compare-bundles.mjs` updates the pages but not the two
    llms files. A generator for the llms files, or a test asserting the
    numbers against the JSON, would close this.
  - Same drift risk for the benchmark figures (1.21x at 1 KB, parity at 10 KB,
    0.89x at 100 KB, 2.8x precompiled) in `llms.txt` and
    `public-sites/home/src/Landing.tsx`. Those predate this change and come
    from `benchmarks/README.md`, not from a committed data file.
  - The docs index page (`docs.reactmarkdownkit.com/`) emits only
    `SoftwareSourceCode` JSON-LD, with no `WebSite` or `BreadcrumbList`.
    Pre-existing and not flagged by the report.
  - The navbar in `public-sites/docs/docusaurus.config.ts` was left alone; it
    already carries ten items. The comparison pages are reachable site-wide
    through a new Compare column in the footer, plus the home hub, the docs
    index and the renderer funnel.
  - `/compare` has no index route, so every breadcrumb trail on a comparison
    page runs `/` -> the funnel -> the page rather than through `/compare`. A
    `/compare` index would be a small follow-up.
  - C 3.3 follow-ups, then deploy.
- 2026-09-20: the Milestone C pages above are deployed and live. Follow-ups
  closed:
  - **Soft 404s.** Every host answered an unknown path with 200 and its
    home page. `nginx.container.conf` now tries only real files and answers
    anything else with 404 and the site's `404.html` (Docusaurus writes the
    docs one, `shared/vite-seo.ts` writes the five Vite ones, marked
    `noindex`). Checked against the built image on every host;
    `tests/seo-surface.test.ts` asserts the config and the files.
  - **Drift of published figures.** `docs/data/benchmarks.json` holds the
    reference run's medians (`node benchmarks/run.mjs --write` replaces it).
    `tests/published-figures.test.ts` fails on any decimal ratio, median or
    byte count in the public sources that `benchmarks.json`,
    `bundle-sizes.json` or `mermaid-size.json` does not produce, and binds
    each llms.txt comparison sentence to its rows. That covers the llms files,
    `Landing.tsx` and every MDX page, so a generator was not needed.
  - **Docs index structured data**: `WebSite` and a root `BreadcrumbList`
    next to `SoftwareSourceCode`.
  - **`/compare` index** (`src/pages/compare.mdx`, `CollectionPage`): every
    comparison grouped by package with the full size table. The six
    `/compare/*` trails now run `/` -> `/compare` -> page. Linked from the
    footer, the docs index, the home hub and llms.txt. 50 pages, 0 problems.
  - "C 3.3 follow-ups" had no defined content left; the four Mermaid pages
    exist. Removed from the open list.
- 2026-09-21: every milestone (A to E) is done and deployed. Off-repo work
  done from the browser: the GitHub repository carries 12 topics (`react`,
  `markdown`, `markdown-editor`, `markdown-renderer`, `mermaid`,
  `mermaid-editor`, `slides`, `lexical`, `streaming-markdown`,
  `react-markdown`, `flowchart`, `typescript`), a description naming every
  package and the apex as its website. Six URL-prefix properties exist in
  Google Search Console, one per host; every host's root page carries the
  account's `google-site-verification` meta tag (`index.html` of the five
  Vite sites, `headTags` in `docusaurus.config.ts`) and
  `tests/seo-surface.test.ts` asserts it. Bing Webmaster Tools needs a
  sign-in (OAuth), so it stays in section 8. What is left is section 8 and
  the data-driven work in `docs/SEO_PLAN.md` sections 6 and 7, which waits on
  Search Console impressions.

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
   the demo, the compatibility table (renderer) and the round-trip suites
   (editor: `packages/editor/tests/roundtrip.test.ts` for the 22 of 22
   byte-identical cases, `tests/roundtrip.test.ts` for the serializer path's
   meaning and idempotence). READMEs are already in `files`; confirm with
   `pnpm pack:check`.
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

- Push `main` to github.com/mahuzedada/react-markdown-kit. The remote was
  created 2026-09-20 with a single "proof of concept" commit whose CI run
  failed; the READMEs, the release workflow and the SEO pages are only
  local until it is pushed. Topics, description and website are set.
- npm login if `npm whoami` fails.
- Record baseline positions in `docs/SEO_LOG.md` once Search Console shows
  impressions. All six properties are verified with sitemaps submitted
  (2026-09-21); the six Bing Webmaster sites verify from the `msvalidate.01`
  tag on the next deploy, then need their sitemaps submitted.
- Validating the keyword shortlist in Google Keyword Planner.
- Outreach to listicle authors (Strapi, Eddyter, Froala, Refine, Windmill,
  Contentful, medevel), replies on remarkjs discussion #1148 and
  mermaid-live-editor issue #1284, Reddit, Hacker News, Product Hunt,
  newsletters, awesome lists, the johnloy gist.
- Monthly check of whether Claude, ChatGPT and Cursor recommend the kit.
- Product decisions: PDF export for slides, sequence diagram support for
  Mermaid, image-to-Mermaid. The pages in section 3 are written for the
  product as it is.
