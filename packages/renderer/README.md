# @react-markdown-kit/renderer

Render Markdown as React.

```bash
npm install @react-markdown-kit/renderer
```

```tsx
import Markdown from '@react-markdown-kit/renderer'

export function Article({ content }: { content: string }) {
  return <Markdown>{content}</Markdown>
}
```

That is the whole first-use experience. No provider, no stylesheet, no account,
no design system, no configuration.

## What you get by default

- **CommonMark**, parsed with micromark rather than regular expressions.
- **Safe rendering.** Raw HTML is not executed and unsafe URL schemes are
  blocked. See [Security](#security).
- **Unstyled semantic HTML.** No classes, no inline styles, no CSS to fight.
- **Server-ready.** No `"use client"` on this entry, so it works in server
  components, SSR and static rendering.

## Custom components

```tsx
<Markdown components={{ a: AppLink, img: AppImage, code: CodeBlock }}>
  {content}
</Markdown>
```

## GitHub Flavored Markdown

Tables, task lists, strikethrough, autolinks and footnotes. Two equivalent
routes:

```tsx
import { GfmMarkdown } from '@react-markdown-kit/renderer/gfm'

<GfmMarkdown>{content}</GfmMarkdown>
```

```tsx
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

<Markdown preset={preset}>{content}</Markdown>
```

The `remark-gfm` plugin also works, and the test suite asserts the two produce
the same output.

## Presets: define your dialect once

A preset is your application's answer to "what does Markdown mean here?" Define
it once and reuse it in the renderer, the editor and the template engine.

```ts
// markdown.ts
import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

export const appMarkdown = defineMarkdownPreset({
  extensions: [gfm()],
  components: { a: AppLink, img: AppImage },
})
```

```tsx
<Markdown preset={appMarkdown}>{content}</Markdown>
```

Compose presets rather than copying them:

```ts
export const docsMarkdown = defineMarkdownPreset({
  extends: [appMarkdown],
  components: { a: DocsLink },
})
```

Merge rules are deterministic and documented: extensions merge by name with the
later one replacing the earlier in place, components and class names shallow
merge with the later winning, and a policy option overrides the preset only when
you pass it explicitly.

## Compile once, render many times

```tsx
import { compileMarkdown } from '@react-markdown-kit/renderer'

const doc = compileMarkdown(source, { preset: appMarkdown })

<Markdown document={doc} />
```

`compileMarkdown` is deterministic and does no I/O. The document it returns is
plain JSON: no React elements, no class instances, no closures. You can cache
it, send it over the wire, or hand it to the template engine.

`children` and `document` are mutually exclusive in the types, so there is no
"which one wins" rule to remember.

A precompiled document still runs every transform and the full security policy.
Passing a document is not a way around sanitization.

## Styling

The kit ships **no styling dependency**: no Tailwind, no design system, no
CSS-in-JS runtime. Four approaches all work against the same renderer.

**Bring your own CSS.** The default output is clean semantic HTML, so style it
however you like.

**Opt into the shipped typography** and retint it with custom properties:

```tsx
import '@react-markdown-kit/renderer/styles.css'

<div className="rmk-document">
  <Markdown>{content}</Markdown>
</div>
```

```css
.rmk-document { --rmk-link: rebeccapurple; --rmk-measure: 60ch; }
```

**Utility classes**, passed per part. They replace rather than merge, so there
is nothing to `!important` away:

```tsx
<Markdown classNames={{ heading: 'text-2xl font-bold', code: 'rounded bg-slate-100 px-1' }}>
  {content}
</Markdown>
```

**Your own components**, from any library:

```tsx
<Markdown components={{ a: AppLink, table: AppTable }}>{content}</Markdown>
```

Full contract in [`docs/STYLING.md`](../../docs/STYLING.md).

## Security

Raw HTML in the source is not executed, and `href`/`src`-style attributes are
restricted to safe schemes. The URL algorithm is the same one `react-markdown`
uses, because it is well tested against protocol-obfuscation corpora.

```tsx
<Markdown>{'[x](javascript:alert(1))'}</Markdown>
// href is emptied, nothing executes
```

To allow raw HTML, opt in explicitly and sanitize:

```tsx
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

<Markdown skipHtml={false} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
  {content}
</Markdown>
```

Plugins and components you pass are trusted application code. They are not
sandboxed, and the documentation does not claim otherwise.

## remark and rehype

The existing ecosystem keeps working:

```tsx
<Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
  {content}
</Markdown>
```

Policy runs after every plugin, so a plugin cannot inject markup that skips
sanitization.

## Coming from react-markdown

The prop surface is intentionally familiar: `children`, `components`,
`remarkPlugins`, `rehypePlugins`, `remarkRehypeOptions`, `allowedElements`,
`disallowedElements`, `allowElement`, `skipHtml`, `unwrapDisallowed` and
`urlTransform`.

See [`docs/COMPATIBILITY.md`](../../docs/COMPATIBILITY.md) for the evidence-backed
matrix against a pinned `react-markdown@10.1.0`, where every feature is
classified `compatible`, `compatible with documented change`, `not supported yet`
or `intentionally different`.

We do not claim "drop-in replacement". Read the matrix and decide.

## The rest of the kit

All optional. The renderer never requires them, and carries none of their code.

- [`@react-markdown-kit/editor`](../editor) — rich, source and preview editing
  that reads and writes the same Markdown.
- [`@react-markdown-kit/template`](../../plugins/template) — a plugin: `template({ data })`
  resolves typed placeholders while this renderer parses.
- [`@react-markdown-kit/mermaid`](../../plugins/mermaid) — a plugin: `mermaid()` draws
  ```` ```diagram ```` fences as static SVG.
- [`@react-markdown-kit/slides`](../../plugins/slides) — a plugin: `slides()` renders a
  deck from plain Markdown (`---` splits slides) as static `<section>`s; its
  `/present` entry adds present mode.

## API

| Export | Purpose |
| --- | --- |
| `Markdown` (also default) | The component |
| `compileMarkdown(source, options?)` | Markdown to `MarkdownDocument` |
| `documentToMarkdown(document, options?)` | Back to a Markdown string |
| `defineMarkdownPreset(options?)` | Define a dialect once |
| `gfm(options?)` | GitHub Flavored Markdown extension |
| `defaultUrlTransform(url)` | The default URL policy, for reuse |
| `isMarkdownDocument(value)` | Runtime guard |

## License

MIT
