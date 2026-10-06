/**
 * What every part of the canvas reads: the deck, the selection, the edit
 * session and the view. `SlideCanvas` owns it; the stage, the slide list,
 * the bars and the inline editor are its consumers.
 */
import { createContext, useContext, type ReactNode } from 'react'
import type { MarkdownEditorCommands, MarkdownEditorInstance } from '@react-markdown-kit/editor'
import type { MarkdownExtension, MarkdownPreset } from '@react-markdown-kit/renderer'
import type { MarkdownDiagnostic } from '@internal/diagnostics/index.js'
import type { SlideCanvasLabels } from './labels.js'
import type { DeckOutline } from './outline.js'

export type CanvasView = 'strip' | 'grid'

/** A zoom factor of the slide's 1280px design width, or `fit`. */
export type CanvasZoom = number | 'fit'

export type EditorCommand = (commands: MarkdownEditorCommands) => void

/** Opening the inline editor: where the caret goes, and a tool to run once it is ready. */
export interface EditRequest {
  readonly column?: 0 | 1
  readonly block?: number
  readonly point?: { readonly x: number; readonly y: number }
  readonly command?: EditorCommand
}

/** The latest source and its outline, read at the moment of a write rather than at render. */
export interface SourceAccess {
  readonly value: () => string
  readonly outline: () => DeckOutline
  readonly emit: (value: string, group?: string) => void
}

export interface CanvasState {
  readonly actions: ReactNode
  readonly onPresent: ((index: number) => void) | undefined
  readonly labels: SlideCanvasLabels
  readonly preset: MarkdownPreset | undefined
  readonly extensions: readonly MarkdownExtension[] | undefined
  readonly editable: boolean
  readonly source: SourceAccess
  readonly count: number
  readonly problems: readonly MarkdownDiagnostic[]
  readonly index: number
  readonly select: (index: number) => void
  readonly selectedBlock: number | undefined
  readonly selectBlock: (block: number | undefined) => void
  readonly focused: boolean
  readonly setFocused: (focused: boolean) => void
  readonly moveBlock: (from: number, to: number) => void
  readonly propertiesOpen: boolean
  readonly setPropertiesOpen: (open: boolean) => void
  readonly revealSource: (() => void) | undefined
  readonly editing: EditRequest | undefined
  readonly edit: (request: EditRequest) => void
  readonly stopEditing: () => void
  /** The inline editor's instance while it is open, so the tools can drive it. */
  readonly editor: MarkdownEditorInstance | undefined
  readonly setEditor: (editor: MarkdownEditorInstance | undefined) => void
  /** Counts edits made outside the canvas; the open fields reload on a new one. */
  readonly revision: number
  readonly view: CanvasView
  readonly setView: (view: CanvasView) => void
  readonly stripOpen: boolean
  readonly setStripOpen: (open: boolean) => void
  readonly notesOpen: boolean
  readonly setNotesOpen: (open: boolean) => void
  readonly zoom: CanvasZoom
  readonly setZoom: (zoom: CanvasZoom) => void
  /** The rendered slide width over the design width, as the stage measured it. */
  readonly scale: number
  readonly setScale: (scale: number) => void
  readonly undo: () => void
  readonly redo: () => void
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly addSlide: () => void
  readonly duplicateSlide: (index: number) => void
  readonly removeSlide: (index: number) => void
  readonly moveSlide: (from: number, to: number) => void
}

export const CanvasContext = createContext<CanvasState | null>(null)

export function useCanvas(): CanvasState {
  const state = useContext(CanvasContext)
  if (state === null) throw new Error('A slide canvas part was rendered outside <SlideCanvas>.')
  return state
}
