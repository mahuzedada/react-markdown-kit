# @react-markdown-kit/editor

Rich, source and preview Markdown editing for React. Markdown in, Markdown out.

```bash
npm install @react-markdown-kit/editor @react-markdown-kit/renderer
```

```tsx
'use client'

import { useState } from 'react'
import { MarkdownEditor } from '@react-markdown-kit/editor'

export function Notes() {
  const [value, setValue] = useState('# Notes\n\nStart writing.')
  return <MarkdownEditor value={value} onChange={setValue} />
}
```

Your application keeps storing Markdown strings. Nothing asks you to persist
editor JSON or a proprietary format.

## The round trip is the point

Most Markdown editors quietly damage documents. Opening one and closing it
without typing rewrites parts of it, and the damage compounds on every save.

This editor converts between a real CommonMark syntax tree and the editing
model, then writes unchanged blocks back from their **original source bytes**.
Opening a document and closing it changes nothing.

The test corpus comes from an audit of a prior editor with seven reproducible
corruption bugs. All 22 cases now round-trip byte for byte, each asserted twice:
once with GitHub Flavored Markdown and once with plain CommonMark.

```text
> a            blockquote with a blank line     unchanged
> 
> b

C:\path\to     Windows paths                    unchanged
~~~js          tilde fences                     unchanged
[t][ref]       reference links                  unchanged
<div>…</div>   HTML blocks                      unchanged
3. three       explicit list numbering          unchanged
```

**Unsupported syntax is preserved, not flattened.** Anything the editor has no
rich representation for becomes an opaque block that keeps its exact source
slice. Editing the paragraph next to it cannot touch it, and moving it around
keeps it intact.

## Three modes

```tsx
<MarkdownEditor mode={mode} onModeChange={setMode} />
```

`rich` for WYSIWYG, `source` for raw Markdown, `preview` for read-only output.

Preview delegates to `@react-markdown-kit/renderer` rather than shipping a
second renderer, so what you preview is what your application renders.

## Controlled or uncontrolled

```tsx
<MarkdownEditor value={value} onChange={setValue} />
<MarkdownEditor defaultValue="# Hello" onChange={handleChange} />
<MarkdownEditor />
```

An echoed `value` does not reset selection or undo history. To replace the
document deliberately, change `documentKey`:

```tsx
<MarkdownEditor documentKey={note.id} value={note.markdown} onChange={setMarkdown} />
```

## Build your own interface

The default editor ships a toolbar so it is useful immediately. When you need
your own, keep the engine and replace the chrome:

```tsx
const editor = useMarkdownEditor({ value, onChange, preset })

<MarkdownEditorProvider editor={editor}>
  <MyToolbar />
  <MarkdownEditorContent />
  <MyStatusBar />
</MarkdownEditorProvider>
```

The instance exposes `getMarkdown()`, `getDocument()`, `focus()`, `undo()`,
`redo()`, `setMode()` and `commands`. No Lexical type appears in the public
types, so your components never import the engine. `getNativeEditor()` is
available as an escape hatch and is explicitly implementation-coupled with
weaker stability guarantees.

## Images

The application owns storage. The editor owns the interaction.

```tsx
<MarkdownEditor
  onUploadImage={async (file, context) => {
    const asset = await upload(file, context.signal)
    return { src: asset.url, alt: asset.alt ?? '' }
  }}
/>
```

A `blob:` URL is never written into the document.

## Shared dialect

Define what Markdown means once, and use it in the renderer, the editor and the template engine:

```ts
import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

export const appMarkdown = defineMarkdownPreset({ extensions: [gfm()] })
```

```tsx
<MarkdownEditor preset={appMarkdown} value={value} onChange={setValue} />
```

## Styling

No styling dependency: no Tailwind, no design system, no icon package. Icons are
inline SVG.

The editor is **fully functional with no stylesheet loaded**, and a test asserts
it. The optional theme is opt-in and scoped:

```tsx
import '@react-markdown-kit/editor/styles.css'
```

```css
.rmk-editor { --rmk-border: #cfe0dd; --rmk-radius: 8px; }
```

Or pass your own classes per part, which replace rather than merge:

```tsx
<MarkdownEditor
  classNames={{
    root: 'rounded-lg border border-slate-200',
    toolbar: 'flex gap-1 border-b p-2',
    content: 'min-h-64 p-4',
  }}
/>
```

Full contract in [`docs/STYLING.md`](../../docs/STYLING.md).

## Headless, without React

The same bridge the React editor uses, for a server or a script:

```ts
import { createMarkdownBridge, serializeDocument } from '@react-markdown-kit/editor'
```

## Exports

| Export | Purpose |
| --- | --- |
| `MarkdownEditor` (also default) | The batteries-included editor |
| `useMarkdownEditor` | Headless instance |
| `MarkdownEditorProvider` | Context for composable layouts |
| `MarkdownEditorContent` | The editable surface |
| `useMarkdownEditorContext` | Read the instance from context |
| `createMarkdownBridge`, `serializeDocument` | Markdown in and out, no React |

## Extensions that bring their own block

The root entry never names Lexical. An extension that needs its own editor
node imports the one entry that does:

```ts
import { lexicalAdapter, type EditorBlockAdapter } from '@react-markdown-kit/editor/lexical'

export function myBlocks(): MarkdownExtension {
  return {
    name: 'my-blocks',
    capabilities: {
      syntax: { nodeTypes: ['myBlock'], transform, toMarkdownExtensions },
      editor: lexicalAdapter({
        nodes: [MyBlockNode],
        blocks: [adapter],          // mdast `myBlock` <-> MyBlockNode, and back
        plugins: [registerInsert],  // (editor) => unregister
        commands: [{ id: 'myBlock', label: 'Insert block', icon, run }],
      }),
    },
  }
}
```

A block adapter's `$export` returns the original source while the block is
untouched, so the writer hands back those exact bytes; once edited it returns
`null` and the block serializes through the extension's `toMarkdownExtensions`.
An inline adapter (`inlines`) does the same for an inline node such as a
chip; its `$export` returns the mdast plus its Markdown spelling, which is the
node's identity for the writer. A decorator component reaches the engine with
`useLexicalEditor()`. `@react-markdown-kit/mermaid/editor` (a block),
`@react-markdown-kit/slides/editor` (three blocks and an Enter shortcut) and
`@react-markdown-kit/template/editor` (an inline) are the shipped examples.

## Plugins

Templates, Mermaid diagrams and slides are separate packages, used only through `extensions`:

```tsx
import { templateVariables } from '@react-markdown-kit/template/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import { slides } from '@react-markdown-kit/slides/editor'

<MarkdownEditor
  value={source}
  onChange={setSource}
  extensions={[templateVariables({ previewData: sample }), mermaid(), slides()]}
/>
```

Every `{{placeholder}}` becomes a chip with a sample-data preview (never
written back to the source), a ```` ```mermaid ```` flowchart opens on a
drawing canvas, and a deck gets numbered slide breaks, `???` / `--` dividers,
directive chips, four toolbar buttons and a Preview that is the interactive
deck. See each package's README.

## License

MIT
