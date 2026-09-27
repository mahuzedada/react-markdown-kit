# Public site

One Docusaurus site at reactmarkdownkit.com. It isn't a published package.

Before writing or editing any copy on the site, read [docs/writing-rules.md](../docs/writing-rules.md).

| Directory | What it is |
| --- | --- |
| `site/` | The site: docs, the funnel and comparison pages, and the four demos. Package `react-markdown-kit-site`. |
| `shared/` | The theme, the landing blocks and helpers the demo pages use, the share-link format, activity tracking, `llms.txt` and the site's URLs. Plain files, not a package. |

```bash
pnpm build                                     # the packages and plugins first
pnpm --filter react-markdown-kit-site start    # http://localhost:3000
pnpm --filter react-markdown-kit-site build    # into site/build/
```

## Layouts

Every route uses one of three layouts:

| Layout | Routes | Where |
| --- | --- | --- |
| Doc | `/docs/*` | the docs plugin, with its sidebar |
| Article | the Markdown pages in `site/src/pages` (`/react-mermaid`, `/compare/*`, …) | `site/src/layouts/ArticleLayout.tsx`, applied to every one of them by the swizzled `site/src/theme/MDXPage` |
| Demo | `/markdown-renderer`, `/markdown-editor`, `/mermaid-editor`, `/markdown-slides` | `site/src/layouts/DemoLayout.tsx`: the navbar, the demo filling the rest of the first viewport, the landing copy, the footer |

A demo's code lives in `site/src/demos/<name>/`. `Demo.tsx` loads it in the
browser only (`BrowserOnly` and a lazy chunk), behind a placeholder the height
the demo will take; `Landing.tsx` holds the copy, FAQ and structured data,
which render on the server into the built page. The demo root sizes itself
with `h-[var(--rmk-demo-height,100dvh)]`: DemoLayout sets the variable to the
viewport under the navbar, and with `?embed=1` the mermaid and slides pages
render the demo alone, so the variable is unset and the demo takes the frame.

## Old hosts

Until 2026-09-27 the docs lived on docs.reactmarkdownkit.com and each demo on
its own subdomain (renderer., editor., mermaid., slides.), plus a separate home
page at the apex. `nginx.container.conf` and `nginx.shipiru.conf` answer every
old host with a permanent redirect to its new path, keeping the query and, in
the browser, the hash that carries a shared document. Keep those redirects.

## The crawlable surface

`tests/seo-surface.test.ts` reads `site/build` and fails on a missing h1, a
wrong title or description length, a missing canonical, an `og:image` that is
not a PNG on disk, structured data that does not parse, a missing robots,
sitemap, llms or 404 file, a container config that falls back to
`/index.html`, or a link to a 404. On the four demo pages it also checks that
the canonical is the page itself and that the structured data repeats the meta
description. It runs in the `public-sites` CI job after the build.
`tests/published-figures.test.ts` checks every ratio, median and byte count on
the public surface against the committed files in `docs/data/`.

Social cards come from `scripts/social-cards.mjs` (one per demo, named
`static/img/social-card-<demo>.png`), and the logo, favicons and
`site.webmanifest` from `scripts/brand-icons.mjs` (source:
`shared/brand/logo.svg`).
