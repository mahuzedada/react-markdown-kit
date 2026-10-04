# React Markdown Renderer Playground

This document is rendered by React Markdown Kit. Open **Source** to edit it; the page updates as you type.

## Render a string

```sh
npm install @react-markdown-kit/renderer
```

```tsx
import Markdown from '@react-markdown-kit/renderer'

<Markdown>{'# Hello\n\nA document, rendered as React.'}</Markdown>
```

The component produces ordinary HTML. There is no required provider, theme, or stylesheet.

## Write familiar Markdown

Use **bold**, *emphasis*, `inline code`, and [links](/docs/renderer/components). Nest lists, quote a passage, or add a code fence.

> The document is the example. Change anything here in the source and watch it render.

1. Open the source panel.
2. Change this list or add a heading.
3. Close the panel and read your document.

## Add GitHub Flavored Markdown

This page enables GFM for tables, task lists, strikethrough, and autolinks.

```tsx
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

<Markdown preset={preset}>{source}</Markdown>
```

| Syntax | Example |
| --- | --- |
| Strong | **A useful detail** |
| Emphasis | *A softer note* |
| Strikethrough | ~~An old idea~~ |
| Inline code | `const ready = true` |

- [x] Render the document
- [x] Enable GFM
- [ ] Make it your own

## Use your own components

```tsx
<Markdown components={{
  a: ({ children, ...props }) => <a {...props} className="link">{children}</a>,
}}>
  {source}
</Markdown>
```

Component overrides receive the element's normal props. Your application controls their styling and behavior.

## Keep going

Read about [components](/docs/renderer/components), [presets](/docs/renderer/presets), [compiling a document](/docs/renderer/compiling), and [security defaults](/docs/security). To write directly on the page, open the [editor](/markdown-editor).
