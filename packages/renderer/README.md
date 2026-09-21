# @react-markdown-kit/renderer

A React Markdown renderer with safe defaults and no configuration. Pass a
Markdown string, get semantic HTML as React elements. CommonMark by default,
GitHub Flavored Markdown one import away, and a document format you can
compile once and render anywhere.

```bash
npm install @react-markdown-kit/renderer
```

```tsx
import Markdown from '@react-markdown-kit/renderer'
import { GfmMarkdown } from '@react-markdown-kit/renderer/gfm'

export function Article({ content }: { content: string }) {
  return <Markdown>{content}</Markdown>
}

export function Readme({ content }: { content: string }) {
  return <GfmMarkdown>{content}</GfmMarkdown>
}
```

That is the whole first-use experience. No provider, no stylesheet, no account,
no design system, no configuration.

## Links

- Docs: [React Markdown renderer](https://docs.reactmarkdownkit.com/react-markdown-renderer)
- Demo: [renderer.reactmarkdownkit.com](https://renderer.reactmarkdownkit.com)
- Compatibility with `react-markdown`: [the table](https://docs.reactmarkdownkit.com/docs/compatibility),
  generated from [`docs/COMPATIBILITY.md`](https://github.com/mahuzedada/react-markdown-kit/blob/main/docs/COMPATIBILITY.md)
- Source: [github.com/mahuzedada/react-markdown-kit](https://github.com/mahuzedada/react-markdown-kit)

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

The `remark-gfm` plugin also works.
[`tests/gfm.test.ts`](https://github.com/mahuzedada/react-markdown-kit/blob/main/tests/gfm.test.ts)
asserts that `gfm()` and `remark-gfm` produce the same output.

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

Full contract in
[`docs/STYLING.md`](https://github.com/mahuzedada/react-markdown-kit/blob/main/docs/STYLING.md).
Each of the four approaches is asserted in
[`tests/styling.dom.test.tsx`](https://github.com/mahuzedada/react-markdown-kit/blob/main/tests/styling.dom.test.tsx).

## Security

Raw HTML in the source is not executed, and `href`/`src`-style attributes are
restricted to safe schemes. The URL algorithm is the same one `react-markdown`
uses.

```tsx
<Markdown>{'[x](javascript:alert(1))'}</Markdown>
// href is emptied, nothing executes
```

Both behaviours are asserted in
[`packages/renderer/tests/render.dom.test.tsx`](https://github.com/mahuzedada/react-markdown-kit/blob/main/packages/renderer/tests/render.dom.test.tsx)
under `security (RENDER-08)`.

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

[`docs/COMPATIBILITY.md`](https://github.com/mahuzedada/react-markdown-kit/blob/main/docs/COMPATIBILITY.md)
is the evidence-backed matrix against a pinned `react-markdown@10.1.0`. It is
generated from
[`tests/compatibility.test.tsx`](https://github.com/mahuzedada/react-markdown-kit/blob/main/tests/compatibility.test.tsx),
which renders the same input through both packages and compares normalized
HTML: 39 comparisons across 11 props, 39 identical. Every feature is classified
`compatible`, `compatible with documented change`, `not supported yet` or
`intentionally different`. The same table is published at
[docs.reactmarkdownkit.com/docs/compatibility](https://docs.reactmarkdownkit.com/docs/compatibility).

Read the matrix and decide.

## The rest of the kit

All optional. The renderer never requires them, and carries none of their code.

- [`@react-markdown-kit/editor`](https://www.npmjs.com/package/@react-markdown-kit/editor):
  rich, source and preview editing that reads and writes the same Markdown.
- [`@react-markdown-kit/template`](https://www.npmjs.com/package/@react-markdown-kit/template):
  a plugin. `template({ data })` resolves typed placeholders while this
  renderer parses.
- [`@react-markdown-kit/mermaid`](https://www.npmjs.com/package/@react-markdown-kit/mermaid):
  a plugin. `mermaid()` draws ```` ```mermaid ```` flowchart fences as static
  SVG. Flowcharts only.
- [`@react-markdown-kit/slides`](https://www.npmjs.com/package/@react-markdown-kit/slides):
  a plugin. `slides()` renders a deck from plain Markdown (`---` splits
  slides) as static `<section>`s; its `/present` entry adds present mode.

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
