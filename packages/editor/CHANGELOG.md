# Changelog

## Unreleased

- `useOptionalMarkdownEditorContext()` is exported: the context hook that returns null outside a provider, for chrome that also takes an `editor` prop the way `<MarkdownEditorContent>` does.

## 0.1.0 (2026-09-20)

First release. `<MarkdownEditor>` with rich, source and preview modes, built on Lexical, plus `useMarkdownEditor`, the provider and content components, and `createMarkdownBridge` for headless use. Markdown in, Markdown out: the 22 round-trip cases from the audit save byte for byte.
