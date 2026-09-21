/**
 * @react-markdown-kit/editor
 *
 * Markdown in, Markdown out. The document is mdast the whole way through: the
 * renderer's parser produces it, a bridge maps it to Lexical nodes for editing,
 * and the writer hands unchanged regions back as their original bytes.
 *
 * Lexical is an implementation detail (spec 17.2). Nothing exported here
 * requires a Lexical type to use, and `getNativeEditor()` returns `unknown`.
 */
'use client'

export { MarkdownEditor, default } from './react/editor.js'
export { useMarkdownEditor } from './react/use-markdown-editor.js'
export { MarkdownEditorProvider, useMarkdownEditorContext } from './react/context.js'
export { MarkdownEditorContent } from './react/content.js'
export type { MarkdownEditorProviderProps } from './react/context.js'
export type { MarkdownEditorContentProps, EditorAriaProps } from './react/content.js'

export type {
  MarkdownEditorMode,
  MarkdownEditorProps,
  MarkdownEditorInstance,
  MarkdownEditorCommands,
  MarkdownEditorLabels,
  MarkdownBlockType,
  MarkdownInlineMark,
  MarkdownImageValue,
  MarkdownUploadContext,
  MarkdownUploadImage,
  MarkdownToolbarItem,
  MarkdownToolbarRenderer,
  UseMarkdownEditorOptions,
} from './types.js'

export type { EditorClassNames, EditorClassNamePart } from './class-names.js'

/**
 * Headless Markdown-in / Markdown-out, with no React and no DOM. Useful on a
 * server, in a worker, and in tests; it is also the exact pipeline the React
 * editor runs, so a round-trip proved here holds in the browser.
 */
export { createMarkdownBridge, serializeDocument } from './bridge/session.js'
export type { MarkdownBridge, BridgeOptions } from './bridge/session.js'

export type {
  MarkdownDocument,
  MarkdownNode,
  MarkdownPreset,
  MarkdownExtension,
  MarkdownDiagnostic,
} from './types.js'
