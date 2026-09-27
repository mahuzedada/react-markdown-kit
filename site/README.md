# reactmarkdownkit.com

The one public site, in Docusaurus, with every live example rendered by the kit's
own packages: the docs, the funnel and comparison pages, and the four demos. It
isn't a published package. Before writing or editing any copy here, read
[docs/writing-rules.md](../docs/writing-rules.md).

```bash
pnpm --filter react-markdown-kit-site start    # dev server
pnpm --filter react-markdown-kit-site build    # static build, into build/
pnpm --filter react-markdown-kit-site serve    # serve the build
pnpm --filter react-markdown-kit-site check-theme   # WCAG pairs of src/css/theme.css
```

The site depends on the workspace packages and plugins, so run `pnpm build` in the repo
root first if you have not built them.

## Layouts

Every route uses one of three layouts:

| Layout | Routes | Where |
| --- | --- | --- |
| Doc | `/docs/*` | the docs plugin, with its sidebar |
| Article | the Markdown pages in `src/pages` (`/react-mermaid`, `/compare/*`, …) | `src/layouts/ArticleLayout.tsx`, applied to every one of them by the swizzled `src/theme/MDXPage` |
| Demo | `/markdown-renderer`, `/markdown-editor`, `/mermaid-editor`, `/markdown-slides` | `src/layouts/DemoLayout.tsx`: the navbar, the demo filling the rest of the first viewport, the landing copy, the footer |

A demo's code lives in `src/demos/<name>/`. `Demo.tsx` loads it in the browser
only (`BrowserOnly` and a lazy chunk), behind a placeholder the height the demo
will take; `Landing.tsx` holds the title, description, copy, FAQ and structured
data, which render on the server into the built page. The demo root sizes
itself with `h-[var(--rmk-demo-height,100dvh)]`: DemoLayout sets the variable to
the viewport under the navbar, and with `?embed=1` the mermaid and slides pages
render the demo alone, so the variable is unset and the demo takes the frame.

## Where things live

| Path | What it is |
| --- | --- |
| `src/css/theme.css` | The one stylesheet. It imports zui (`@zuilib/primitives/tailwind.css`) and Tailwind's theme and utilities (no preflight), then only overrides variables: the zui tokens in the Foundry palette (light on `:root`, dark on `[data-theme='dark']`), the kit's `--rmk-*` properties, and Docusaurus' `--ifm-*` variables. Colours live only here. `check-theme` checks its contrast pairs. |
| `src/sites.json`, `src/sites.ts` | The public URLs (the site, each demo page, GitHub) and `docsUrl()`. Absolute links in structured data, share links and the demos read them. |
| `src/components/landing/` | The demo pages' landing blocks: `Page.tsx` (`Page`, `Hero`, `LinkRow`, `Features`, `Prose`, `Steps`, `Callout`), `Seo.tsx` (`Faq` with its `FAQPage` data, `JsonLd`, the `WebApplication` and `SoftwareSourceCode` shapes) and `CopyCode.tsx` (a code block with a Copy button). |
| `src/lib/share.ts` | The share-link format: the whole document in the URL hash, `#pako:` or `#base64:`, as on mermaid.live. Every demo that shares a document uses it. |
| `src/lib/Activity.tsx`, `src/lib/umami.ts` | `SiteActivity`, mounted at the root by `src/theme/Root.tsx`: the `@zuilib/primitives` `ActivityProvider`, reporting to the console in development and to the self-hosted Umami at stats.reactmarkdownkit.com in production. Controls name themselves with `track` (primitives) or `data-zui-tag` (plain elements), inside an `ActivityScope` feature. |
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
| `TemplateExample` | `compileMarkdown` with `template({ data })`, then `<Markdown document>` | server, during the static build |
| `EditorExample` | a real `<MarkdownEditor>` | browser only, lazily |

`RenderExample` and `TemplateExample` server-render into the static HTML. That is not a
convenience, it is the proof: if the renderer or the template plugin needed a browser,
the build would fail. You can check it after a build:

```bash
grep -o "<table>" build/index.html          # a GFM table rendered at build time
grep -o "Acme Industrial" build/index.html  # a template resolved at build time
```

The editor mounts client-side behind `BrowserOnly` and a lazy import, because it needs a
DOM. That split mirrors how an application should use the packages.

## Styling

The site chrome is Docusaurus with Infima's defaults, themed through `@zuilib/tokens`:
`src/css/theme.css` sets the token values and maps
Infima's variables onto them. Pages and components use zui primitives and Tailwind
classes, with no CSS files of their own. The rendered Markdown inside
every example is styled only by `@react-markdown-kit/renderer/styles.css`, scoped to
`.rmk-document`, which is the same opt-in stylesheet a consumer would import. The site
does not restyle the kit's output, so what you see is what you get.

## Page structure

Three discovery funnels, each a substantive page rather than a redirect (spec 13.2):

| Route | Intent |
| --- | --- |
| `/react-markdown-renderer` | React markdown renderer |
| `/react-markdown-editor` | React markdown editor |
| `/markdown-template-engine` | Markdown template engine, variables |
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
