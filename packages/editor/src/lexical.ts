/**
 * `@react-markdown-kit/editor/lexical` — the Lexical-aware entry for extension
 * authors.
 *
 * The root entry never names Lexical (spec 7.13, 17.2), and an ordinary
 * consumer never needs this file. An extension that brings its own block
 * node does: it declares an `editor` capability whose fields are typed here,
 * and the editor package narrows the opaque contract to these types when it
 * mounts. Everything on this entry carries the same weaker stability
 * guarantee as `getNativeEditor()`.
 */
import type { ReactNode } from 'react'
import type { Klass, LexicalEditor, LexicalNode } from 'lexical'
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import type { EditorAdapter } from '@internal/extension-contracts/index.js'

export type { EditorAdapter }

/**
 * Owns one mdast node type inside the rich surface.
 *
 * Without an adapter, an mdast node the bridge does not model becomes an
 * opaque block: preserved byte for byte, shown as source, not editable. With
 * one, it becomes the extension's own node and the writer asks the adapter
 * for the mdast to serialize.
 */
export interface EditorBlockAdapter {
  /** The mdast `type` this adapter owns, e.g. `diagram`. */
  readonly type: string
  /**
   * Builds the editor node for an imported block. `source` is the block's
   * exact bytes when the document carried its source, else the empty string.
   * Runs inside `editor.update()`.
   */
  $import(node: MarkdownNode, source: string): LexicalNode
  /** True when `node` is one of this adapter's editor nodes. */
  matches(node: LexicalNode): boolean
  /**
   * Back to mdast. Return the original `source` as `raw` while the block is
   * unchanged, and the writer hands back those exact bytes (spec 7.9);
   * return `null` once it has been edited and the block is serialized through
   * the extension's `toMarkdownExtensions`. Runs inside `editor.read()`.
   */
  $export(node: LexicalNode): { readonly node: MarkdownNode; readonly raw: string | null }
}

/**
 * Owns one *inline* mdast node type: a chip, a mention, a variable.
 *
 * Without an adapter an unknown inline node is preserved as read-only source;
 * with one it becomes the extension's own inline node. Unlike a block, an
 * inline node is never written back on its own: `$export` returns the mdast
 * plus its Markdown spelling (`raw`), and the writer uses that spelling as the
 * node's identity, so a paragraph whose chips are untouched still compares
 * equal to what was imported and is written back from its original bytes.
 */
export interface EditorInlineAdapter {
  /** The mdast `type` this adapter owns, e.g. `templateVariable`. */
  readonly type: string
  /** Builds the editor node for an imported inline node. Runs inside `editor.update()`. */
  $import(node: MarkdownNode, source: string): LexicalNode
  /** True when `node` is one of this adapter's editor nodes. */
  matches(node: LexicalNode): boolean
  /** Back to mdast, with the exact text the node serializes to. Runs inside `editor.read()`. */
  $export(node: LexicalNode): { readonly node: MarkdownNode; readonly raw: string }
}

/**
 * Registers behaviour on the engine (commands, listeners). Called once per
 * editor instance; return the unregister function.
 */
export type EditorPlugin = (editor: LexicalEditor) => (() => void) | undefined

/** A button the default toolbar shows, and `useMarkdownEditor` users receive as an item. */
export interface EditorCommandContribution {
  readonly id: string
  /** Toolbar group. Default `insert`. */
  readonly group?: string
  /** Fallback accessible name; `labels[id]` wins when the app provides one. */
  readonly label?: string
  readonly icon?: ReactNode
  run(editor: LexicalEditor): void
}

/** The `editor` capability, as the editor package reads it. */
export interface LexicalEditorAdapter {
  readonly nodes?: readonly Klass<LexicalNode>[]
  readonly blocks?: readonly EditorBlockAdapter[]
  readonly inlines?: readonly EditorInlineAdapter[]
  readonly plugins?: readonly EditorPlugin[]
  readonly commands?: readonly EditorCommandContribution[]
}

/**
 * Types an `editor` capability. The contract stores these fields as opaque
 * lists so the renderer and template packages never load Lexical types; this
 * is the typed door for the one package that does.
 */
export function lexicalAdapter(adapter: LexicalEditorAdapter): EditorAdapter {
  return adapter
}

export { useLexicalEditor } from './react/native-context.js'
export type { LexicalEditorContextValue } from './react/native-context.js'
