/**
 * Ported from @zuilib/text-editor (MIT). Per-editor block options (drawing
 * style, width of a newly inserted block, the kind registry, the canvas
 * component of each kind, whether the source editor is shown), in place of
 * zui's `EditorContext`, and the contract a canvas component is written to
 * (docs/MERMAID_PLATFORM.md section 9.2).
 *
 * The block is rendered through a decorator portal the editor package owns,
 * so an extension cannot wrap it in a provider of its own. Instead the plugin
 * registers the options against the `LexicalEditor` it is mounted on and the
 * block subscribes: a block decorated before the plugin ran still picks the
 * options up. Nothing about kinds is module state: the registry travels
 * here, per editor. The same channel carries the one-shot focus request an
 * insert leaves for the block it created.
 */
import { useCallback, useSyncExternalStore, type ComponentType } from 'react'
import type { LexicalEditor, NodeKey } from 'lexical'
import type { BlockWidth } from '../core/block-width.js'
import type { DrawingStyle } from '../core/ink.js'
import type { DiagramKind, DiagramParse } from '../core/kind.js'
import { defaultKinds } from '../core/kinds.js'

/**
 * What the block hands a canvas component. The block owns the mode, the
 * lossy lock and the commit; the component draws the parse and writes
 * source back through `commit`. It never touches the node itself, so every
 * canvas kind gets the same history and echo handling. After an insert the
 * block focuses the component's first `.rmk-diagram-canvas` or
 * `[data-rmk-diagram-focus]` element.
 */
export interface DiagramKindEditorProps {
  readonly nodeKey: NodeKey
  readonly kind: DiagramKind
  readonly source: string
  readonly parse: DiagramParse<unknown>
  /**
   * True while the block locks the canvas behind the lossy notice: the
   * source holds a feature the writer cannot keep and the author has not
   * acknowledged the loss. A read-only editor never mounts the component;
   * the block renders the kind's `render` output there instead.
   */
  readonly readOnly: boolean
  /** Writes `source` to the node in a discrete update. `merge` coalesces with the previous commit under the 300 ms rule. */
  readonly commit: (source: string, options?: { readonly merge?: boolean }) => void
}

export type DiagramKindEditor = ComponentType<DiagramKindEditorProps>

/** Canvas components by kind name. */
export type DiagramKindEditors = Readonly<Record<string, DiagramKindEditor>>

export interface DiagramCanvasOptions {
  /** `clean` (default) or the hand-drawn `ink` renderer. */
  readonly style: DrawingStyle
  /** Width written into a flowchart inserted from the toolbar. Absent: `full`. */
  readonly newBlockWidth: BlockWidth | undefined
  /** The kinds in detection order; the same list the headless extension parses with. */
  readonly kinds: readonly DiagramKind[]
  /** The canvas component of each kind that has one, by kind name; a kind edits on it only while it also writes. */
  readonly editors: DiagramKindEditors
  /** `false` hides the textarea: the block shows preview and problems only. */
  readonly sourceEditor: boolean
  /** Accessible name of a preview whose model has no `title`. */
  readonly fallbackTitle: string
}

export const DEFAULT_CANVAS_OPTIONS: DiagramCanvasOptions = {
  style: 'clean',
  newBlockWidth: undefined,
  kinds: defaultKinds(),
  // The built-in components are registered by the editor entry; without a
  // plugin, every block is edited as text.
  editors: {},
  sourceEditor: true,
  fallbackTitle: 'Diagram',
}

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
