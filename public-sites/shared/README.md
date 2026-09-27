# Shared by the public site

Nothing here is a package. `site/` imports these files by relative path.

| File | What it is |
| --- | --- |
| `sites.json` | The public URLs: the site, each demo page and GitHub. Absolute links (structured data, share links, the demos' own links) read it. |
| `theme.css` | The one stylesheet the site loads. It imports zui (`@zuilib/primitives/tailwind.css`) and Tailwind's theme and utilities (no preflight), then only overrides variables: the zui tokens in the Foundry palette (light on `:root`, dark on `[data-theme='dark']`), the kit's `--rmk-*` properties, and Docusaurus' `--ifm-*` variables. Colours live only here. `pnpm --filter react-markdown-kit-site check-theme` checks its contrast pairs. |
| `Seo.tsx` | `Faq` (the questions block with its `FAQPage` structured data), `JsonLd`, and the `WebApplication` and `SoftwareSourceCode` shapes the demo pages declare. |
| `llms/` | `llms.txt` and `llms-full.txt`, served at the site root (Docusaurus `staticDirectories`). |
| `Activity.tsx` | `SiteActivity`: the `@zuilib/primitives` `ActivityProvider` the site mounts at its root (`site/src/theme/Root.tsx`). Tags every event with the site; reports to the console in development and to the self-hosted Umami at stats.reactmarkdownkit.com in production (`umami.ts`). Controls name themselves with `track` (primitives) or `data-zui-tag` (plain elements), inside an `ActivityScope` feature. |
| `CopyCode.tsx` | `CopyCode`: a code block with a Copy button. Every install command and snippet on the demo pages uses it, so each pastes as it stands. Docs and article pages keep Docusaurus's own copy button. |
| `Shell.tsx` | `useTheme` (the colour mode a demo's own header toggles, in step with the navbar's), `docsUrl` and `sites`. |
| `Page.tsx` | The blocks of a demo page's landing copy: `Page`, `Hero`, `LinkRow`, `Features`, `Prose`, `Steps` and `Callout`, built from zui primitives and Tailwind classes. |
| `brand/logo.svg` | The master logo: a blue perspective stack of cards with an M. `node scripts/brand-icons.mjs` copies it to the site as `logo.svg` and `favicon.svg`, and renders `favicon.ico` (16, 32, 48), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `site.webmanifest`. Run `node scripts/social-cards.mjs` after it, because the social cards draw the same logo. Edit the master only; the copies are generated. |

Styling rules: zui primitives and Tailwind token classes in the markup, and no other CSS files. Body copy is full-size foreground text; muted and small text is only for metadata. The kit's own stylesheets (`@react-markdown-kit/*/styles.css`) are still imported where a demo shows them, because they're the product being demoed.
