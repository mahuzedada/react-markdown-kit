# Shared between the public sites

Nothing here is a package. The sites import these files by relative path.

| File | What it is |
| --- | --- |
| `sites.json` | The public URL of each site. Every cross-site link on every site reads it, so a deploy to a new host is a one-line change. |
| `foundry.css` | The theme: `@zuilib/tokens` overrides in the Palantir Blueprint palette, light on `:root` and dark on `[data-theme='dark']`. `pnpm --filter react-markdown-kit-docs check-theme` checks its contrast pairs. |
| `kit.css` | Maps the kit's `--rmk-diagram-*` properties onto the tokens, so the diagram canvas and the static SVG follow the theme in both modes, and the slides plugin's `--rmk-slide-*` / `--rmk-deck-*` properties, so a slide is a card in the theme's colours and present mode keeps a dark backdrop with the theme's chrome. |
| `Seo.tsx` | `Faq` (the questions block with its `FAQPage` structured data), `JsonLd`, and the `WebApplication` and `SoftwareSourceCode` shapes the home page and the demos declare. |
| `vite-seo.ts` | The Vite plugin every site's config loads: after the build it prerenders `src/static.tsx` into `#root`, writes `sitemap.xml` and copies `llms/`. See `../README.md`. |
| `llms/` | `llms.txt` and `llms-full.txt`, served by all six hosts from this one source. |
| `Activity.tsx` | `SiteActivity`: the `@zuilib/primitives` `ActivityProvider` every site mounts at its root (`main.tsx`, and `docs/src/theme/Root.tsx`). Tags every event with its site; reports to the console in development and to the self-hosted Umami at stats.reactmarkdownkit.com in production (`umami.ts`, one website ID per site). Controls name themselves with `track` (primitives) or `data-zui-tag` (plain elements), inside an `ActivityScope` feature. |
| `demo.css`, `Shell.tsx` | The home page's and demo sites' shared chrome: the footer with the site links and the theme toggle, and the prose styles. There is no header and no toolbar, so the demo is the first element on every page. |

Load order on every site: `@zuilib/primitives/zui-no-preflight.css` (the components, with the tokens inside), then `foundry.css`, then `kit.css`, then the site's own CSS.
