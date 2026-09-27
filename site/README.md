# reactmarkdownkit.com

The one public site: a Vite app with MDX, zui and Tailwind, built to static HTML,
with every live example rendered by the kit's own packages: the docs, the funnel and comparison pages, and the four demos. It
isn't a published package. Before writing or editing any copy here, read
[docs/writing-rules.md](../docs/writing-rules.md).

```bash
pnpm --filter react-markdown-kit-site start    # dev server, renders in the browser
pnpm --filter react-markdown-kit-site build    # static build, every route to build/<route>/index.html
pnpm --filter react-markdown-kit-site serve    # serve the build the way nginx does
pnpm --filter react-markdown-kit-site check-theme   # WCAG pairs of src/css/theme.css
```

The site depends on the workspace packages and plugins, so run `pnpm build` in the repo
root first if you have not built them.

## How it builds

A page is a file. `docs/**/*.mdx` is served at `/docs/<path>`, `src/pages/**/*.mdx`
and `src/pages/**/*.tsx` at `/<path>` (`index.tsx` is `/`). `vite/pages.ts` finds
them, reads their front matter and last commit date, and gives the app the list
as `virtual:pages`; its remark plugin gives every MDX page heading ids, `toc`
and `frontMatter` exports, and turns relative `.mdx` links into routes.

`scripts/build.mjs` builds the client, then a server bundle, renders every route
with React to `build/<route>/index.html` (head from `src/app/head.ts`), and
writes `404.html` and `sitemap.xml`. Every link is a plain page load: the
browser runs `src/app/entry-client.tsx`, which imports the one page module and
hydrates. A React page exports `meta` (title, description, keywords, social
card); an MDX page takes its title and description from front matter.

## Layouts

One `Shell` (`src/layouts/Shell.tsx`: navbar, mobile menu, footer) frames every
page, and every page's copy is one `Prose` (`src/components/Prose.tsx`). The
layouts only arrange them:

| Layout | Routes | Where |
| --- | --- | --- |
| Doc | `/docs/*` | `src/layouts/DocLayout.tsx`: the docs sidebar (`DOCS_SIDEBAR` in `src/app/navigation.ts`), the reading column with its table of contents, previous and next |
| Article | the MDX pages in `src/pages` (`/react-mermaid`, `/compare/*`, …) | `src/layouts/ArticleLayout.tsx`: the reading column with its table of contents |
| Demo | `/markdown-renderer`, `/markdown-editor`, `/mermaid-editor`, `/markdown-slides` | `src/layouts/DemoLayout.tsx`: the demo filling the first viewport under the navbar, the copy below in the reading column |

The home page is the reading column on its own (`Page` in `src/components/landing/Page.tsx`).

A demo's code lives in `src/demos/<name>/`. `Demo.tsx` loads it in the browser
only (`ClientOnly` and a lazy chunk), behind a placeholder the height the demo
will take; `Landing.tsx` holds the title, description, copy, FAQ and structured
data, which render on the server into the built page. The demo root sizes
itself with `h-[var(--rmk-demo-height,100dvh)]`: DemoLayout sets the variable to
the viewport under the navbar, and with `?embed=1` the mermaid and slides pages
render the demo alone, so the variable is unset and the demo takes the frame.

## Where things live

| Path | What it is |
| --- | --- |
| `src/css/theme.css` | The one stylesheet. It imports zui (`@zuilib/primitives/tailwind.css`), Tailwind's theme and utilities (no preflight) and the renderer's typography in the `components` layer, then sets the zui tokens in the Foundry palette (light on `:root`, dark on `[data-theme='dark']`), the kit's `--rmk-*` properties, the two page widths, the prose rhythm and the code colours. Colours live only here. `check-theme` checks its contrast pairs. |
| `src/app/` | The build's app: the page list and loaders (`routes.ts`), the head (`head.ts`), the navbar, footer and docs sidebar as data (`navigation.ts`), the client and server entries. |
| `src/sites.json`, `src/sites.ts` | The public URLs (the site, each demo page, GitHub) and `docsUrl()`. Absolute links in structured data, share links and the demos read them. |
| `src/components/` | `Prose`, `CodeBlock` (Prism, colours from `--code-*`, a Copy button), `Toc`, `JsonLd` (every structured-data shape), the live examples, and `landing/` for the copy blocks of the home and demo pages (`Page`, `Hero`, `LinkRow`, `Features`, `Steps`, `Callout`, `Faq`). |
| `src/lib/share.ts` | The share-link format: the whole document in the URL hash, `#pako:` or `#base64:`, as on mermaid.live. Every demo that shares a document uses it. |
| `src/lib/Activity.tsx`, `src/lib/umami.ts` | `SiteActivity`, mounted around every page by `src/app/App.tsx`: the `@zuilib/primitives` `ActivityProvider`, reporting to the console in development and to the self-hosted Umami at stats.reactmarkdownkit.com in production. Controls name themselves with `track` (primitives) or `data-zui-tag` (plain elements), inside an `ActivityScope` feature. |
| `src/lib/useTheme.ts` | The colour mode a demo's own header toggles, in step with the navbar's toggle. |
| `static/llms.txt`, `static/llms-full.txt` | The model-facing summaries, served at the site root. |
| `brand/logo.svg` | The master logo. `node scripts/brand-icons.mjs` copies it to `static/img/` as `logo.svg` and `favicon.svg` and renders the favicons and `site.webmanifest`; run `node scripts/social-cards.mjs` after it, because the social cards (`static/img/social-card*.png`, one per demo) draw the same logo. Edit the master only. |

Styling rules: zui primitives and Tailwind token classes in the markup, and no
other CSS files. Body copy is full-size foreground text; muted and small text is
only for metadata. The kit's own stylesheets (`@react-markdown-kit/*/styles.css`)
are imported where a demo or example shows them, because they're the product.

## Old hosts

Until 2026-09-27 the docs lived on docs.reactmarkdownkit.com and each demo on
its own subdomain (renderer., editor., mermaid., slides.), plus a separate home
page at the apex. `nginx.container.conf` and `nginx.shipiru.conf` at the repo
root answer every old host with a permanent redirect to its new path, keeping
the query and, in the browser, the hash that carries a shared document. Keep
those redirects.

## The crawlable surface

`tests/seo-surface.test.ts` reads `build/` and fails on a missing h1, a wrong
title or description length, a missing canonical, an `og:image` that is not a
PNG on disk, structured data that does not parse, a missing robots, sitemap,
llms or 404 file, a container config that falls back to `/index.html`, or a
link to a 404. On the four demo pages it also checks that the canonical is the
page itself and that the structured data repeats the meta description.
`tests/seo-links.test.ts` checks every other href and src. Both run in the `site`
CI job after the build. `tests/published-figures.test.ts` checks every ratio,
median and byte count on the public surface against the committed files in
`docs/data/`.

## The examples are real

Nothing on this site is a screenshot or a re-implementation.

| Component | What it mounts | Where it runs |
| --- | --- | --- |
| `RenderExample` | a real `<Markdown>` | server, during the static build |
| `VariablesExample` | `compileMarkdown` with `variables({ data })`, then `<Markdown document>` | server, during the static build |
| `EditorExample` | a real `<MarkdownEditor>` | browser only, lazily |

`RenderExample` and `VariablesExample` server-render into the static HTML. That is not a
convenience, it is the proof: if the renderer or the variables plugin needed a browser,
the build would fail. You can check it after a build:

```bash
grep -o "<table>" build/markdown-variables/index.html          # a GFM table rendered at build time
grep -o "Acme Industrial" build/markdown-variables/index.html  # variables resolved at build time
```

The editor mounts client-side behind `ClientOnly` and a lazy import, because it needs a
DOM. That split mirrors how an application should use the packages.

## Styling

One system: zui primitives and Tailwind token classes for every component,
and the renderer's `.rmk-document` stylesheet for every page's prose, with its
`--rmk-*` variables set to the site's tokens under `[data-prose]`. The
stylesheet sits in the `components` layer, so a utility class in the markup
wins over it without `!`. The Markdown inside each live example is a nested
`.rmk-document` outside `[data-prose]`, so it shows the kit's defaults, which
is what a consumer gets from the same opt-in stylesheet.

## Page structure

Discovery pages, each a substantive page rather than a redirect (spec 13.2). The
renderer and editor have no overview page of their own: their demos
(`/markdown-renderer`, `/markdown-editor`) are the entry points, and the old
`/react-markdown-renderer` and `/react-markdown-editor` URLs 301 to them
(`nginx.container.conf`).

| Route | Intent |
| --- | --- |
| `/markdown-variables` | Markdown variables, personalization |
| `/migrate-from-react-markdown` | migration, with the differences first |
| `/nextjs-markdown` | server rendering |

`/docs/*` holds the reference. The landing page leads with the renderer and one
component, per spec 13.1, not with architecture. The interactive demos are
`/markdown-renderer`, `/markdown-editor`, `/mermaid-editor` and `/markdown-slides`,
with their code in `src/demos/`.

## Claims policy

No page says "drop-in replacement", "fastest", "smallest" or "100% compatible". Every
number on the site has a test behind it in the repo, and the compatibility matrix is
generated from the test run rather than written by hand.
