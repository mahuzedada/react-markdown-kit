# @react-markdown-kit/editor

A React Markdown editor with rich, source and preview modes. Markdown in,
Markdown out. Built on Lexical, but Lexical never appears in the public types.
Open a document and close it without typing, and the file is unchanged.

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

## Links

- Docs: [Editor basics](https://reactmarkdownkit.com/docs/editor/basics)
- Demo: [reactmarkdownkit.com/markdown-editor](https://reactmarkdownkit.com/markdown-editor)
- Round-trip guarantee: [the docs page](https://reactmarkdownkit.com/docs/editor/round-trip),
  backed by [`packages/editor/tests/roundtrip.test.ts`](https://github.com/mahuzedada/react-markdown-kit/blob/main/packages/editor/tests/roundtrip.test.ts)
  and [`tests/roundtrip.test.ts`](https://github.com/mahuzedada/react-markdown-kit/blob/main/tests/roundtrip.test.ts)
- Source: [github.com/mahuzedada/react-markdown-kit](https://github.com/mahuzedada/react-markdown-kit)

## The round trip is the point

A Markdown editor that parses into an editing model and serializes back out
can damage the document on every save, and the damage compounds.

This editor converts between a real CommonMark syntax tree and the editing
model, then writes unchanged blocks back from their **original source bytes**.
Opening a document and closing it changes nothing.

The test corpus comes from
[`docs/AUDIT.md`](https://github.com/mahuzedada/react-markdown-kit/blob/main/docs/AUDIT.md),
an audit of a prior editor with seven reproducible corruption bugs, expanded to
22 cases. All 22 round-trip byte for byte through the editor bridge, each
asserted twice: once with GitHub Flavored Markdown and once with plain
CommonMark
([`packages/editor/tests/roundtrip.test.ts`](https://github.com/mahuzedada/react-markdown-kit/blob/main/packages/editor/tests/roundtrip.test.ts)).
A second suite,
[`tests/roundtrip.test.ts`](https://github.com/mahuzedada/react-markdown-kit/blob/main/tests/roundtrip.test.ts),
checks the serializer path with no source bytes to fall back on: 22 of 22 keep
their meaning, 22 of 22 are idempotent, 14 of 22 are byte-identical, and the
14 may not shrink.

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

## Typing Markdown in rich mode

Markdown typed on the rich surface turns into the block or format it names.

| Type | Result |
|---|---|
| `# ` to `###### ` | Heading |
| `- `, `* `, `+ ` | Bullet list |
| `1. ` | Ordered list, starting at the typed number |
| `[ ] `, `[x] ` | Task item, also at the start of a bullet item |
| `> ` | Blockquote |
| ```` ```ts ```` then space or Enter | Code block with that language |
| `---`, `***`, `___` then Enter | Thematic break |
| `\| a \| b \|` then Enter | Table with that header; later row lines join it, and `\| :-- \| --: \|` sets alignment |
| `**bold**`, `*em*`, `` `code` ``, `~~strike~~` | Inline formats, on the closing character |
| `[text](url)`, `![alt](src)` | Link or image, on the closing `)` |

Undo after a shortcut gives back the typed text. Only a typed character
triggers one: loading, pasting, deleting or undoing never does. Nothing
converts inside a code block, and tables, task items and `~~` stay as typed in a CommonMark
document. In a list, Enter starts the next item, Enter on an empty item leaves
the list, and Backspace at the start of an item removes its checkbox and then
the bullet. In a blockquote, Enter on an empty last line leaves the quote.

## Editing tables

With the GFM preset, use **Insert table** to choose a grid size. The first row
is always the header; inserting above it adds a body row underneath, keeping
the column labels in place. Focus a cell to reveal its edge controls. A **+**
at a row or column boundary inserts there; a **−** over a row or column
deletes it. A line or tint previews the change. The circle at the top-left
corner selects the whole table and reveals **Delete table** above it. Delete
or Backspace also removes a selected table; Escape returns to cell editing.
Use **Table options** below the grid to align the selected column. Alignment
is displayed in rich mode and saved in the Markdown delimiter row.

- **Tab / Shift+Tab** move between cells with a collapsed caret. Tab from the
  final cell adds a row and moves to its first cell. Row edge actions keep
  the current column; modified Tab shortcuts remain available to the browser.
- **Shift-click or drag across cells** selects a rectangle; Escape clears it.
- **Copy / cut / paste** transfer rectangular values as TSV and HTML tables.
  Pasting spreadsheet values expands the table when needed. Pasting one value
  over a selected rectangle fills it. Delete clears selected cell contents.
- Press **Alt+F10** in a table to focus its edge controls. Use Tab to switch
  edges and arrow keys to choose an action, then Enter to
  apply. Escape returns to the table. On touch screens, tap an edge to preview,
  then tap the control to apply.
- Edge controls keep at least one row and column. Structural changes and paste
  can be undone. Using the command API to remove the last row or column
  leaves a paragraph ready for typing.

Custom toolbars can use `commands.insertTable(rows, columns)`,
`commands.tableAction('rowBelow')` (also `rowAbove`, `columnLeft`, `columnRight`,
`deleteRow`, `deleteColumn`, `deleteTable`), and
`commands.alignTableColumn('left' | 'center' | 'right' | null)`.
Insertion accepts 1–100 rows and 1–30 columns and requires GFM.
Clipboard transfers cell text; merged cells and spreadsheet formatting are
not part of the Markdown table format.

The optional theme provides subtle grid lines, padded cells, selection
outlines and contextual menus. Override `--rmk-table-popover-bg` and
`--rmk-table-popover-text` to match your application's light or dark surface.

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

## Table of contents

```tsx
<MarkdownEditor value={value} onChange={setValue} outline />
```

`outline` docks a table of contents beside the rich surface. It lists the
headings as you type, indents them from the shallowest level, scrolls to a
heading when you click it, and marks the section on screen. A button folds
it away. It is view only: nothing is written to the Markdown. Source and
preview modes hide it.

In a composed layout, place `<MarkdownOutline />` yourself anywhere inside
the provider. `offset` moves the reading line down by the height of a sticky
header.

The list itself, `TableOfContents`, and the scroll tracker,
`useActiveHeading`, work without an editor. Import them from
`@react-markdown-kit/editor/table-of-contents`, which carries no Lexical, to
draw the same table of contents over a page's own headings. Entries with an
`href` render as links:

```tsx
import { TableOfContents, useActiveHeading } from '@react-markdown-kit/editor/table-of-contents'

const entries = headings.map((h) => ({ id: h.id, text: h.text, depth: h.level, href: `#${h.id}` }))
const activeId = useActiveHeading(entries, (entry) => document.getElementById(entry.id))

<TableOfContents entries={entries} activeId={activeId} labels={{ 'outline.title': 'On this page' }} />
```

Labels: `outline.title`, `outline.empty`, `outline.untitled`. Class parts:
`body`, `outline`, `outlineToggle`, `outlineTitle`, `outlineList`,
`outlineItem`, `outlineItemActive`, `outlineEmpty`.

## Build your own interface

The default editor has a compact command bar: text formatting and insertion
menus, quick table/image/task controls, undo/redo, and an editing-mode menu.
Selecting text also opens a small formatting toolbar beside the selection.
`toolbarEnd` adds your own controls at the end of that bar, such as a share
or save button.
When you need your own interface, keep the engine and replace the chrome:

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

Define what Markdown means once, and use it in the renderer, the editor and the variables plugin:

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

The editor is **fully functional with no stylesheet loaded**.
[`packages/editor/tests/styling.test.tsx`](https://github.com/mahuzedada/react-markdown-kit/blob/main/packages/editor/tests/styling.test.tsx)
edits, switches mode and serializes with no CSS in the document. The optional
theme is opt-in and scoped:

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

Full contract in
[`docs/STYLING.md`](https://github.com/mahuzedada/react-markdown-kit/blob/main/docs/STYLING.md).

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
| `MarkdownOutline` | The table of contents, for composed layouts |
| `TableOfContents`, `useActiveHeading` | The heading list and scroll tracker, no editor needed (also on `/table-of-contents`) |
| `useMarkdownEditorContext` | Read the instance from context |
| `useOptionalMarkdownEditorContext` | The same, null outside a provider, for chrome that also takes an `editor` prop |
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
`@react-markdown-kit/variables/editor` (an inline) are the shipped examples.

## Plugins

Variables, Mermaid flowcharts and slides are separate packages, used only through `extensions`:

```tsx
import { variableChips } from '@react-markdown-kit/variables/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import { slides } from '@react-markdown-kit/slides/editor'

<MarkdownEditor
  value={source}
  onChange={setSource}
  extensions={[variableChips({ previewData: sample }), mermaid(), slides()]}
/>
```

Every `{{placeholder}}` becomes a chip with a sample-data preview (never
written back to the source), a ```` ```mermaid ```` flowchart opens on a
drawing canvas, and a deck gets numbered slide breaks, `???` / `--` dividers,
directive chips, four toolbar buttons and a Preview that is the interactive
deck. See each package's README:
[variables](https://www.npmjs.com/package/@react-markdown-kit/variables),
[mermaid](https://www.npmjs.com/package/@react-markdown-kit/mermaid),
[slides](https://www.npmjs.com/package/@react-markdown-kit/slides).

## License

MIT
