# Changelog

## 0.2.1 (2026-10-04)

- Table editing with the GFM preset: **Insert table** picks a grid size; edge controls insert or delete rows and columns at the focused cell; the corner control selects the whole table; **Table options** aligns a column, saved in the delimiter row. Tab and Shift+Tab move between cells, Tab from the last cell adds a row, Shift-click or drag selects a rectangle, and copy, cut and paste move rectangles as TSV and HTML. Alt+F10 reaches the edge controls from the keyboard. New commands `insertTable(rows, columns)`, `tableAction(action)` and `alignTableColumn(align)`.
- `outline` docks a table of contents beside the rich surface. It lists headings as you type, scrolls to one on click and marks the section on screen; nothing is written to the Markdown. `<MarkdownOutline>` places it in a composed layout.
- `TableOfContents` and `useActiveHeading`, also on the new `@react-markdown-kit/editor/table-of-contents` entry with no Lexical, draw the same list over a page's own headings.
- The default toolbar is a compact bar: text formatting and insert menus, table, task list and image buttons, undo and redo, and an editing-mode menu. Selecting text opens a small formatting toolbar beside the selection.
- `toolbarEnd` renders extra controls at the end of the default toolbar, such as an app's share or save buttons.
- Peer range raised to `@react-markdown-kit/renderer` ^0.1.1.
- New class parts `body`, `outline`, `outlineToggle`, `outlineTitle`, `outlineList`, `outlineItem`, `outlineItemActive` and `outlineEmpty`; new labels `outline.title`, `outline.empty` and `outline.untitled`.

## 0.2.0 (2026-09-27)

- Markdown typing shortcuts on the rich surface. On a space: `# ` to `###### `, `> `, `- ` / `* ` / `+ `, `1. `, `[ ] ` / `[x] ` (also at the start of a bullet item), ```` ```lang ```` and `---`. On Enter: `---` / `***` / `___`, ```` ```lang ````, and table rows (`| a | b |` starts a table, later row lines join it, a delimiter line after the header sets alignment). Inline, on the closing character: `**bold**`, `*em*`, `_em_`, `***both***`, `` `code` ``, `~~strike~~`, `[text](url)` and `![alt](src)`. Each shortcut builds the same node as the matching toolbar command or an import, and is one undo step. Only a typed character triggers a shortcut, never a load, paste, deletion or undo; nothing fires inside a code block; and GFM-only syntax (tables, task items, strikethrough) is left as typed in a CommonMark document.
- Enter in a list item starts the next item (an unchecked one after a task item) instead of adding a paragraph to the same item; Enter on an empty item leaves the list. Backspace at the start of an item drops its checkbox, then lifts it out of the list, keeping the numbering of the items after it. In a blockquote, Enter on an empty last line leaves the quote and Backspace at the start of its first line lifts that line out.
- `useOptionalMarkdownEditorContext()` is exported: the context hook that returns null outside a provider, for chrome that also takes an `editor` prop the way `<MarkdownEditorContent>` does.

## 0.1.0 (2026-09-20)

First release. `<MarkdownEditor>` with rich, source and preview modes, built on Lexical, plus `useMarkdownEditor`, the provider and content components, and `createMarkdownBridge` for headless use. Markdown in, Markdown out: the 22 round-trip cases from the audit save byte for byte.
