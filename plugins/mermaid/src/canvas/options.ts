/**
 * Ported from @zuilib/text-editor (MIT). Per-editor canvas options (drawing
 * style, width of a newly inserted block), in place of zui's `EditorContext`.
 *
 * The canvas is rendered through a decorator portal the editor package owns,
 * so an extension cannot wrap it in a provider of its own. Instead the plugin
 * registers the options against the `LexicalEditor` it is mounted on and the
 * canvas subscribes: a canvas decorated before the plugin ran still picks the
 * options up.
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { LexicalEditor } from 'lexical'
import type { BlockWidth } from '../core/block-width.js'
import type { DrawingStyle } from '../core/ink.js'

export interface DiagramCanvasOptions {
  /** `clean` (default) or the hand-drawn `ink` renderer. */
  readonly style: DrawingStyle
  /** Width written into a drawing inserted from the toolbar. Absent: `full`. */
  readonly newBlockWidth: BlockWidth | undefined
}

export const DEFAULT_CANVAS_OPTIONS: DiagramCanvasOptions = { style: 'clean', newBlockWidth: undefined }

const options = new WeakMap<LexicalEditor, DiagramCanvasOptions>()
const listeners = new WeakMap<LexicalEditor, Set<() => void>>()

function notify(editor: LexicalEditor): void {
  for (const listener of listeners.get(editor) ?? []) listener()
}

/** Registers `next` for `editor`; returns the function that removes it again. */
export function setDiagramOptions(editor: LexicalEditor, next: DiagramCanvasOptions): () => void {
  options.set(editor, next)
  notify(editor)
  return () => {
    if (options.get(editor) !== next) return
    options.delete(editor)
    notify(editor)
  }
}

export function diagramOptionsOf(editor: LexicalEditor): DiagramCanvasOptions {
  return options.get(editor) ?? DEFAULT_CANVAS_OPTIONS
}

function subscribe(editor: LexicalEditor, listener: () => void): () => void {
  let set = listeners.get(editor)
  if (set === undefined) {
    set = new Set()
    listeners.set(editor, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

export function useDiagramOptions(editor: LexicalEditor): DiagramCanvasOptions {
  const subscribeTo = useCallback((listener: () => void) => subscribe(editor, listener), [editor])
  const read = useCallback(() => diagramOptionsOf(editor), [editor])
  return useSyncExternalStore(subscribeTo, read, read)
}
