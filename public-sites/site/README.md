# reactmarkdownkit.com

Docusaurus, with every live example rendered by the kit's own packages: the docs,
the funnel and comparison pages, and the four demos. `../README.md` describes the
three layouts (doc, article, demo) and the redirects from the old hosts.

```bash
pnpm --filter react-markdown-kit-site start    # dev server
pnpm --filter react-markdown-kit-site build    # static build, into build/
pnpm --filter react-markdown-kit-site serve    # serve the build
pnpm --filter react-markdown-kit-site check-theme   # WCAG pairs of the shared theme
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

The site chrome is Docusaurus with Infima's defaults, themed through `@zuilib/tokens`:
`../shared/theme.css` (shared with the other sites) sets the token values and maps
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
