# Public sites

Six sites, each deployed on its own. None is a published package.

| Directory | Site | Stack | Filter |
| --- | --- | --- | --- |
| `home/` | The home page at the apex: what the kit is, install, the packages | Vite | `react-markdown-kit-home` |
| `docs/` | Documentation, the discovery funnels, the reference | Docusaurus | `react-markdown-kit-docs` |
| `renderer-demo/` | One page: the renderer with every option, the HTML, the tree, the code, and a side-by-side with `react-markdown` | Vite | `react-markdown-kit-renderer-demo` |
| `editor-demo/` | One page: the editor with the template and diagram plugins, resolved per customer | Vite | `react-markdown-kit-editor-demo` |
| `mermaid-demo/` | One page: a Mermaid live editor, syntax on the left and the visual canvas on the right | Vite | `react-markdown-kit-mermaid-demo` |
| `slides-demo/` | One page: a slides workbench, the rich editor on the left and the deck on the right, with present mode, a presenter window, share links and print | Vite | `react-markdown-kit-slides-demo` |
| `shared/` | The theme, the kit's diagram and slide token maps, the demo chrome and the sites' URLs | files, not a package | |

```bash
pnpm build                                            # the packages and plugins first
pnpm --filter react-markdown-kit-home start           # http://localhost:5173
pnpm --filter react-markdown-kit-docs start           # http://localhost:3000
pnpm --filter react-markdown-kit-renderer-demo start  # http://localhost:5173
pnpm --filter react-markdown-kit-editor-demo start    # http://localhost:5173
pnpm --filter react-markdown-kit-mermaid-demo start   # http://localhost:5173
pnpm --filter react-markdown-kit-slides-demo start    # http://localhost:5173
pnpm -r --filter './public-sites/*' build             # every site, into <site>/build/
```

Cross-site links read `shared/sites.json`. Change a URL there and every site follows.

## The crawlable surface

Each Vite site is a single page whose app mounts on `#root`. So that a crawler
(or a model) that runs no JavaScript still reads it, `shared/vite-seo.ts`
runs after `vite build` and renders the site's `src/static.tsx` into `#root`:
the space the demo will take, the landing copy in `src/Landing.tsx` (one h1,
the lede, three features, install and how-to, an FAQ with its `FAQPage`
structured data, and the `WebApplication` block) and the footer. The app then
mounts over that markup with `createRoot`. The same step writes `sitemap.xml`
with the site's last commit date, writes a `404.html`, and copies
`shared/llms/*.txt`, which the docs site serves from the same folder. Every
route is a file (a demo has only `/`; slides switches views with `?view=`),
so `nginx.container.conf` answers any other path with a real 404 and that
page, never the site root with a 200. `public/robots.txt` and the head tags
(title, description, canonical, Open Graph, Twitter) are hand-written in each
`index.html`; `public/social-card.png` comes from `scripts/social-cards.mjs`.

`tests/seo-surface.test.ts` reads the six build folders and fails on a
missing h1, a wrong title or description length, a missing canonical, an
`og:image` that is not a PNG on disk, structured data that does not parse, a
missing robots, sitemap, llms or 404 file, a container config that falls
back to `/index.html`, or a link to a 404 on any of the six hosts. It runs in
the `public-sites` CI job after the builds. `tests/published-figures.test.ts`
checks every ratio, median and byte count on the public surface against the
committed files in `docs/data/`.
