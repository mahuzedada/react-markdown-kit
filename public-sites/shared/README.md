# Shared between the public sites

Nothing here is a package. The sites import these files by relative path.

| File | What it is |
| --- | --- |
| `sites.json` | The public URL of each site. Every cross-site link on every site reads it, so a deploy to a new host is a one-line change. |
| `theme.css` | The one stylesheet every site loads. It imports zui (`@zuilib/primitives/tailwind.css`) and Tailwind's theme and utilities (no preflight), then only overrides variables: the zui tokens in the Foundry palette (light on `:root`, dark on `[data-theme='dark']`), the kit's `--rmk-*` properties, and Docusaurus' `--ifm-*` variables. Colours live only here. `pnpm --filter react-markdown-kit-docs check-theme` checks its contrast pairs. |
| `Seo.tsx` | `Faq` (the questions block with its `FAQPage` structured data), `JsonLd`, and the `WebApplication` and `SoftwareSourceCode` shapes the home page and the demos declare. |
| `vite-seo.ts` | The Vite plugin every site's config loads: after the build it prerenders `src/static.tsx` into `#root`, writes `sitemap.xml` and copies `llms/`. See `../README.md`. |
| `llms/` | `llms.txt` and `llms-full.txt`, served by all six hosts from this one source. |
| `Activity.tsx` | `SiteActivity`: the `@zuilib/primitives` `ActivityProvider` every site mounts at its root (`main.tsx`, and `docs/src/theme/Root.tsx`). Tags every event with its site; reports to the console in development and to the self-hosted Umami at stats.reactmarkdownkit.com in production (`umami.ts`, one website ID per site). Controls name themselves with `track` (primitives) or `data-zui-tag` (plain elements), inside an `ActivityScope` feature. |
| `CopyCode.tsx` | `CopyCode`: a code block with a Copy button. Every install command and snippet on the home page and the demos uses it, so each pastes as it stands. The docs site keeps Docusaurus's own copy button. |
| `Shell.tsx` | The home page's and demo sites' shared footer, with the site links and the theme toggle. There is no header and no toolbar, so the demo is the first element on every page. |
| `Page.tsx` | The landing layout every site shares: `Page`, `Hero`, `LinkRow`, `Features`, `Prose`, `Steps` and `Callout`, built from zui primitives and Tailwind classes. |
| `brand/logo.svg` | The master logo: a blue perspective stack of cards with an M. `node scripts/brand-icons.mjs` copies it to every site as `logo.svg` and `favicon.svg`, and renders `favicon.ico` (16, 32, 48), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `site.webmanifest`. Run `node scripts/social-cards.mjs` after it, because the social cards draw the same logo. Edit the master only; the per-site copies are generated. |

Styling rules: zui primitives and Tailwind token classes in the markup, and no other CSS files. Body copy is full-size foreground text; muted and small text is only for metadata. The kit's own stylesheets (`@react-markdown-kit/*/styles.css`) are still imported where a demo shows them, because they're the product being demoed.
