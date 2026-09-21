# React Markdown Kit documentation site

Docusaurus, with every live example rendered by the kit's own packages. One of the
three public sites in `public-sites/`; the renderer and editor demos are their own
single-page sites next to it, and this site only links to them.

```bash
pnpm --filter react-markdown-kit-docs start    # dev server
pnpm --filter react-markdown-kit-docs build    # static build, into build/
pnpm --filter react-markdown-kit-docs serve    # serve the build
pnpm --filter react-markdown-kit-docs check-theme   # WCAG pairs of the shared theme
```

The site depends on the workspace packages and plugins, so run `pnpm build` in the repo
root first if you have not built them.

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

The site chrome is Docusaurus, themed through `@zuilib/tokens`: the theme lives in
`../shared/foundry.css` (shared with the demo sites) and `src/css/custom.css` maps
Infima's variables onto the tokens without naming a colour. The rendered Markdown inside
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
component, per spec 13.1, not with architecture. The interactive demos live on the
renderer demo and editor demo sites; their URLs come from `../shared/sites.json`.

## Claims policy

No page says "drop-in replacement", "fastest", "smallest" or "100% compatible". Every
number on the site has a test behind it in the repo, and the compatibility matrix is
generated from the test run rather than written by hand.
