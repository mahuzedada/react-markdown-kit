# Changelog

## 0.1.0 (2026-09-20)

First release. `<Markdown>` renders CommonMark, with GFM through `gfm()`, safe by default: raw HTML is shown as text and unsafe URL schemes are emptied. `compileMarkdown` and `documentToMarkdown` expose the document contract; `defineMarkdownPreset` shares a dialect with the editor and the plugins. No `use client` directive, so it renders in React Server Components. Prop surface matches react-markdown 10 across the 39 comparisons in `docs/COMPATIBILITY.md`, with three documented differences and a codemod.
