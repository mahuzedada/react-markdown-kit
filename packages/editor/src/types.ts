/**
 * Public editor types (spec 7.1-7.6, 9.2).
 *
 * Nothing here references Lexical. An ordinary consumer can type every prop,
 * every handler and the editor instance without `lexical` in their type path
 * (spec 7.13, 17.2). The single escape hatch, `getNativeEditor()`, returns
 * `unknown` on purpose.
 */
import type { ReactNode } from 'react'
import type {
  MarkdownDocument,
  MarkdownNode,
} from '@internal/document-contracts/index.js'
import type {
  MarkdownExtension,
  MarkdownPreset,
} from '@internal/extension-contracts/index.js'
import type { MarkdownDiagnostic } from '@internal/diagnostics/index.js'
import type { EditorClassNames } from './class-names.js'

/** Spec 7.3. Replaces the legacy `edit-rich` / `edit-raw` / `view` names. */
export type MarkdownEditorMode = 'rich' | 'source' | 'preview'

export interface MarkdownImageValue {
  readonly src: string
  readonly alt?: string
  readonly title?: string
}

export interface MarkdownUploadContext {
  /** Aborted when the editor unmounts or the upload is cancelled (spec 7.8). */
  readonly signal: AbortSignal
  readonly documentKey?: string | undefined
}

export type MarkdownUploadImage = (
  file: File,
  context: MarkdownUploadContext,
) => Promise<MarkdownImageValue>

/** Block shapes the default toolbar can apply. */
export type MarkdownBlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'blockquote'
  | 'codeBlock'

export type MarkdownInlineMark = 'strong' | 'emphasis' | 'delete' | 'code'

/**
 * Editing verbs. Every default toolbar button is one of these, so a custom
 * toolbar built on `useMarkdownEditor` has the same power as the shipped one.
 */
export interface MarkdownEditorCommands {
  toggleMark(mark: MarkdownInlineMark): void
  setBlockType(type: MarkdownBlockType): void
  toggleBulletList(): void
  toggleOrderedList(): void
  toggleTaskList(): void
  insertLink(url: string, options?: { readonly title?: string; readonly text?: string }): void
  removeLink(): void
  insertImage(image: MarkdownImageValue): void
  insertThematicBreak(): void
  /** Parses `source` with the active preset and inserts it at the selection. */
  insertMarkdown(source: string): void
  /** Replaces the whole document. Used by source mode and by `documentKey`. */
  setMarkdown(source: string): void
  /** Runs `onUploadImage` and inserts the result. Rejects when unconfigured. */
  uploadImage(file: File): Promise<void>
}

/** Spec 7.6. The stable wrapper; Lexical is not the contract. */
export interface MarkdownEditorInstance {
  getMarkdown(): string
  getDocument(): MarkdownDocument
  focus(): void
  blur(): void
  undo(): void
  redo(): void
  setMode(mode: MarkdownEditorMode): void
  readonly mode: MarkdownEditorMode
  readonly commands: MarkdownEditorCommands
  readonly diagnostics: readonly MarkdownDiagnostic[]
  readonly readOnly: boolean
  /**
   * Advanced, implementation-coupled escape hatch (spec 7.6).
   *
   * Returns the underlying Lexical `LexicalEditor`. It is typed `unknown` so
   * Lexical never leaks into an ordinary consumer's type path, and it carries
   * **weaker stability guarantees than the rest of this interface**: the
   * editing engine may be replaced in a future major version without a
   * breaking change to anything else here. Cast at your own risk.
   */
  getNativeEditor(): unknown
}

export interface MarkdownToolbarItem {
  readonly id: string
  /** Accessible name. Already localized through `labels`. */
  readonly label: string
  readonly icon: ReactNode
  readonly active: boolean
  readonly disabled: boolean
  readonly group: string
  run(): void
}

export type MarkdownToolbarRenderer = (
  items: readonly MarkdownToolbarItem[],
  editor: MarkdownEditorInstance,
) => ReactNode

/** Editor chrome strings, so UI locale is independent of document locale. */
export type MarkdownEditorLabels = Partial<Record<string, string>>

export interface UseMarkdownEditorOptions {
  /** Controlled Markdown source. */
  readonly value?: string
  /** Uncontrolled initial Markdown source. */
  readonly defaultValue?: string
  readonly onChange?: (value: string) => void

  readonly mode?: MarkdownEditorMode
  readonly defaultMode?: MarkdownEditorMode
  readonly onModeChange?: (mode: MarkdownEditorMode) => void

  readonly preset?: MarkdownPreset
  readonly extensions?: readonly MarkdownExtension[]

  readonly readOnly?: boolean
  /**
   * Document identity (spec 7.10). Changing it is a deliberate document
   * replacement: the editor reloads and clears undo history. An echoed `value`
   * with an unchanged key never resets selection or history.
   */
  readonly documentKey?: string

  readonly onUploadImage?: MarkdownUploadImage
  readonly onDiagnostics?: (diagnostics: readonly MarkdownDiagnostic[]) => void
}

export interface MarkdownEditorProps extends UseMarkdownEditorOptions {
  readonly components?: Readonly<Record<string, unknown>>
  readonly classNames?: EditorClassNames
  readonly placeholder?: ReactNode
  readonly labels?: MarkdownEditorLabels
  /** `false` removes the toolbar; a function replaces it (spec 7.11, STYLING). */
  readonly toolbar?: boolean | MarkdownToolbarRenderer
  readonly children?: ReactNode
  readonly 'aria-label'?: string
  readonly 'aria-labelledby'?: string
  readonly 'aria-describedby'?: string
}

export type { MarkdownDocument, MarkdownNode, MarkdownPreset, MarkdownExtension, MarkdownDiagnostic }
