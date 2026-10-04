# React Markdown Kit

Markdown in, React out. A renderer, an editor, and a few optional plugins that share the same document.

This site is built around those documents. Read a page, open its source, and change an example to see what happens.

## Start with a string

```sh
npm install @react-markdown-kit/renderer
```

```tsx
import Markdown from '@react-markdown-kit/renderer'

export function Document({ source }: { source: string }) {
  return <Markdown>{source}</Markdown>
}
```

No provider or stylesheet is required. The output is ordinary HTML, ready for your own components and CSS.

## Explore the kit

| Document | What you can try |
| --- | --- |
| [Rendering](/markdown-renderer) | Edit the source of the documentation you're reading. |
| [Editing](/markdown-editor) | Write directly in the document and inspect the saved Markdown. |
| [Streaming](/markdown-streaming) | Watch this guide arrive a few words at a time. |
| [Variables](/markdown-variables) | Change the data behind a document's placeholders. |
| [Slides](/markdown-slides) | Read a deck that explains its own syntax, then present it. |
| [Mermaid](/mermaid-editor) | Draw a diagram and keep its Mermaid source. |

## Add only what you need

The renderer works on its own. GitHub Flavored Markdown, rich editing, variables, diagrams, and slides are opt-in.

```tsx
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

<Markdown preset={preset}>{source}</Markdown>
```

Pass the same preset to the renderer and editor to keep the same Markdown features in both.

## Guides

- [How to render Markdown in React](/docs/guides/render-markdown-in-react) — from a string to custom components.
- [Streaming Markdown in React](/streaming-markdown) — render an AI response as it arrives.
- [Markdown in Next.js](/nextjs-markdown) — server components, client boundaries, and precompiled documents.
- [Lossless Markdown editing](/markdown-round-trip) — keep the source intact through an editing round trip.
- [Build a Lexical Markdown editor](/docs/guides/lexical-markdown-editor) — connect rich text editing to plain Markdown.
- [Variables in a Markdown file](/docs/guides/markdown-variables) — add typed placeholders to a document.
- [Personalized Markdown](/personalized-markdown) — reuse one document with different data.
- [Mermaid in React](/react-mermaid) — render diagrams alongside your text.
- [Markdown presentations in React](/docs/slides) — slides, layouts, notes, and presentation tools.

## Compare and migrate

- [Choosing a React Markdown library](/compare) — compare rendering, editing, streaming, and templates.
- [A react-markdown alternative](/react-markdown-alternative) — when to consider the kit.
- [React Markdown Kit vs react-markdown](/compare/react-markdown)
- [React Markdown Kit vs markdown-to-jsx](/compare/markdown-to-jsx)
- [React Markdown Kit vs Streamdown](/compare/streamdown)
- [React Markdown Kit vs MDXEditor](/compare/mdxeditor)
- [React Markdown Kit vs Milkdown](/compare/milkdown)
- [Markdown variables vs Handlebars](/compare/handlebars)
- [A Marp alternative](/marp-alternative) — Markdown slides in a React application.
- [A Mermaid Live Editor alternative](/mermaid-live-editor-alternative) — a visual diagram editor with Mermaid source.
- [Migrating from react-markdown](/migrate-from-react-markdown) — move an existing application step by step.

## Reference

- [Getting started](/docs/getting-started) — installation and your first component.
- [Styling](/docs/styling) — ordinary CSS and custom React components.
- [Server rendering](/docs/server-rendering) — render on the server or precompile a document.
- [Security](/docs/security) — HTML, links, and untrusted content.
- [Variable syntax](/docs/variables/basics) — placeholders, paths, and typed values.
- [Compatibility](/docs/compatibility) — supported syntax and test coverage.

The code is [open source](https://github.com/mahuzedada/react-markdown-kit), under the MIT license.
