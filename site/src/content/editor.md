# Free Online Markdown Editor for React

You're already inside the editor. Click this paragraph and start writing. This guide is a Markdown document, and you can edit every part of it.

## Try the basics

Select a few words to make them **bold**, *italic*, or `inline code`. The **Aa** menu holds headings, lists, quotes, and code blocks. Undo brings your changes back.

- [x] Open the editor
- [ ] Edit a sentence
- [ ] Add something of your own

Open **Output** to see exactly what gets saved.

## Work with a table

Click a cell to reveal the table’s edge controls. Move along the left or top edge: **+** inserts at a boundary, and **−** removes the highlighted row or column. On touch screens, tap the edge to preview, then tap the control to apply. Drag across cells to select a rectangle, then copy or paste it.

| Action | How to try it |
| --- | --- |
| Move between cells | Tab or Shift + Tab |
| Add a row at the end | Tab from the last cell |
| Add or remove rows and columns | Use + and − along the table edges |
| Delete the whole table | Select the circle at the top-left corner, then Delete table |
| Align a column | Select a cell, then open ⋯ below the table |
| Insert a new table | Use the grid in the toolbar |

## Add the editor to React

```sh
npm install @react-markdown-kit/editor @react-markdown-kit/renderer
```

```tsx
import { useState } from 'react'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import '@react-markdown-kit/editor/styles.css'

export function Notes() {
  const [source, setSource] = useState('# My notes')
  return <MarkdownEditor value={source} onChange={setSource} />
}
```

You store a string. The editor manages selection, formatting, and history, while the renderer can display the same document elsewhere.

## Keep placeholders in the document

This guide is maintained by {{team.name}}. Its next review is {{launch.date | date:"long"}}.

The chips preview sample data. The saved Markdown keeps the placeholders, so the same document can resolve differently for each reader. Explore the [variables guide](/markdown-variables).

## Make the interface yours

The toolbar and stylesheet are optional. Use the [headless API](/docs/editor/headless) for your own controls, add [image uploads](/docs/editor/images), or read about [lossless round trips](/docs/editor/round-trip).

> Changes stay in your browser's page state. Copy a link to reopen or share this version. Reset restores the guide.
