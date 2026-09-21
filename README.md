# React Markdown Kit

Render Markdown. Add editing. Personalize the same document.

Two core packages that share one Markdown mental model, plus plugin packages
that add to both, so an application can grow from displaying Markdown to
authoring and personalizing it without changing storage formats or replacing
the rendering stack.

```text
renderer  = display Markdown
editor    = create and modify Markdown
template  = plugin: personalize Markdown   (template({ data }) in the renderer, chips in the editor)
mermaid   = plugin: Mermaid flowcharts     (static SVG in the renderer, a drawing canvas in the editor)
slides    = plugin: slides from Markdown   (a deck of <section>s in the renderer, present mode in /present, authoring in the editor)
```

| Package | Install | Use it for |
| --- | --- | --- |
| [`@react-markdown-kit/renderer`](packages/renderer) | `npm i @react-markdown-kit/renderer` | Markdown to React, safely |
| [`@react-markdown-kit/editor`](packages/editor) | `npm i @react-markdown-kit/editor` | Rich, source and preview authoring |
| [`@react-markdown-kit/template`](plugins/template) | `npm i @react-markdown-kit/template` | Typed variables, schemas, formatting, localization |
| [`@react-markdown-kit/mermaid`](plugins/mermaid) | `npm i @react-markdown-kit/mermaid` | ```` ```mermaid ```` flowcharts as static SVG, edited on a canvas, saved as Mermaid |
| [`@react-markdown-kit/slides`](plugins/slides) | `npm i @react-markdown-kit/slides` | A deck from one Markdown file: `---` splits slides, `???` starts the notes, `--` is a pause; presented, printed and edited |

The renderer never requires the editor, and neither carries template,
diagram or slide code. The three plugin packages have no standalone API: each
exports extensions (`template()`, `templateVariables()`, `mermaid()`,
`slides()`) that go into a preset or an `extensions` prop, and its `/editor`
entry adds the editing half (`slides` also has a `/present` entry for the
show). Their root entries call no React, so `template()` resolves in a worker,
a CLI or an email job through `compileMarkdown`, and `slides()` renders a
static deck in a server component.

## Start here

```tsx
import Markdown from '@react-markdown-kit/renderer'

<Markdown>{content}</Markdown>
```

Later, the same content becomes editable:

```tsx
<MarkdownEditor value={content} onChange={setContent} />
```

Later still, it becomes personalized, with a plugin:

```tsx
import { template } from '@react-markdown-kit/template'

<Markdown extensions={[template({ data: customer, schema: ReportSchema })]}>{content}</Markdown>
```

It is Markdown at every step. There is no "renderer content" to migrate into
"editor content" into "template content".

## Two constraints this project holds itself to

**No design system.** The kit ships no styling dependency: no Tailwind, no ZUI,
no CSS-in-JS runtime, no theme provider. Default output is plain semantic HTML.
Four styling approaches all work against the same unmodified renderer, and a
test suite proves it: bring your own CSS, opt into the shipped typography and
retint it with custom properties, pass utility classes per part, or replace
elements with your own components from any library. See
[`docs/STYLING.md`](docs/STYLING.md) and
[`examples/styling-approaches`](examples/styling-approaches).

**No unproven claims.** We do not say "drop-in replacement", "fastest" or
"100% compatible". [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md) classifies
every feature against a pinned `react-markdown@10.1.0` as `compatible`,
`compatible with documented change`, `not supported yet` or `intentionally
different`, with the test that proves each one.

## Repository layout

```text
packages/renderer     Markdown to React, compilation, policies
packages/editor       Rich/source/preview authoring on a mdast <-> Lexical bridge
plugins/template      Plugin: template({ data }) resolves placeholders; templateVariables() edits them as chips
plugins/mermaid       Plugin: ```mermaid flowcharts as static SVG, edited on a canvas, written back as Mermaid
plugins/slides        Plugin: slides() reads a deck from plain Markdown; /present shows it, /editor authors it
internal/             Build-time shared contracts, not a fifth package
fixtures/             CommonMark, GFM, compatibility, round-trip, security corpora
examples/             Runnable applications
docs/                 Specification, styling contract, audit, compatibility matrix
public-sites/         The home page, the documentation site and the renderer, editor, Mermaid and slides demos
```

`packages/` holds the two cores and `plugins/` the packages that only work
through them. `internal/` holds the shared contracts: the document,
diagnostics, presets and extensions. It compiles into each package, which is what lets the kit
have no shared runtime core.

## Design decisions worth knowing

**One document representation.** `MarkdownDocument` is plain JSON: an mdast
tree, a profile, diagnostics and optionally the source. No React elements, no
editor instances, no closures. It is what the template engine produces and the
renderer consumes, so personalization costs no stringify/reparse cycle.

**Markdown is the storage format.** The editor reads and writes Markdown.
Nothing asks you to persist editor JSON or a proprietary format.

**The editor parses properly.** It converts between mdast and the editing model
rather than matching Markdown line by line with regular expressions. That is a
direct response to [`docs/AUDIT.md`](docs/AUDIT.md), which found seven
reproducible save-corruption bugs in a prior editor built the other way. All
seven are regression fixtures here.

**Data can never inject Markdown structure.** Template values are placed
structurally into a parsed tree, never substituted into source text. A value of
`**Administrator**` renders as those literal characters, and no value can create
a heading, a table row, a link destination or a code fence.

## Status

| Phase | State |
| --- | --- |
| A — Audit of the prior editor | done, `docs/AUDIT.md` |
| B — Shared contracts | done, `internal/` |
| C — Renderer | done. CommonMark 554/652 exact, 96% counting raw HTML dropped by design. 39/39 prop comparisons match `react-markdown@10.1.0` |
| D — Editor | done. All 22 audited corruption cases round-trip byte-identically |
| E — Template core | done. `template({ data })`, a plugin; resolves with no React |
| F — Template integrations | done. `templateVariables()` with chips in the editor |
| G — Migration tooling | done. `rmk-migrate` codemod and `rmk-compare` corpus runner |
| H — Launch and distribution | not started |

823 tests across 28 files. Three security fixes came out of building it, each
with a regression suite: a Markdown injection through serialized template
output, a silently non-functional `remark-gfm` plugin route, and an
unpublishable dependency range that made a tarball uninstallable.

The full specification is [`docs/SPEC.md`](docs/SPEC.md).

## Development

```bash
pnpm install
pnpm test              # full suite
pnpm build             # build all five packages
pnpm pack:check        # install real tarballs into clean consumers
node scripts/check-css-scope.mjs   # enforce the styling contract
pnpm -r --filter './public-sites/*' build   # the docs site and the four demo sites
```

## License

MIT
