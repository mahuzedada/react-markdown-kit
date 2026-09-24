/**
 * Per-editor block options. The block is rendered through a decorator
 * portal the editor package owns, so an extension cannot wrap it in a
 * provider of its own. Instead the plugin registers the options against the
 * `LexicalEditor` it is mounted on and the block subscribes: a block
 * decorated before the plugin ran still picks the options up. Nothing about
 * kinds is module state: the registry travels here, per editor. The same
 * channel carries the one-shot focus request an insert leaves for the block
 * it created.
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { LexicalEditor, NodeKey } from 'lexical'
import type { DiagramKind } from '../core/kind.js'
import { DEFAULT_CANVAS_OPTIONS, type DiagramCanvasOptions } from '../canvas/options.js'

const options = new WeakMap<LexicalEditor, DiagramCanvasOptions>()
const listeners = new WeakMap<LexicalEditor, Set<() => void>>()
/** The block an insert just created, waiting to take focus once it mounts. */
const pendingFocus = new WeakMap<LexicalEditor, NodeKey>()

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

/** The registered kind named `flowchart` when it writes: the legacy toolbar id and the width-annotated starter are its. */
export function canvasKindOf(kinds: readonly DiagramKind[]): DiagramKind | undefined {
  const kind = kinds.find((candidate) => candidate.name === 'flowchart')
  return kind?.write === undefined ? undefined : kind
}

/** Asks the block with `key` to take focus when it mounts. */
export function requestDiagramFocus(editor: LexicalEditor, key: NodeKey): void {
  pendingFocus.set(editor, key)
}

/** True once for the block the last insert created; clears the request. */
export function takeDiagramFocus(editor: LexicalEditor, key: NodeKey): boolean {
  if (pendingFocus.get(editor) !== key) return false
  pendingFocus.delete(editor)
  return true
}
