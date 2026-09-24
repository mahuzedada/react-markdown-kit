/**
 * Ported from @zuilib/text-editor (MIT). The canvas options (drawing style,
 * width of a newly inserted block, the kind registry, the canvas component
 * of each kind, whether the source editor is shown), in place of zui's
 * `EditorContext`, and the contract a canvas component is written to
 * (docs/MERMAID_PLATFORM.md section 9.2). A canvas reads them from its host
 * (host.tsx); the editor keeps them per `LexicalEditor` in
 * node/options-store.ts.
 */
import type { ComponentType } from 'react'
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
  /** The block's node key in a document; the component's own id standalone. */
  readonly nodeKey: string
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

export type DiagramAlign = 'start' | 'center'

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
  /**
   * Where the flowchart canvas shows a drawing smaller than its surface:
   * `start` at the top-left, as a document lays out a block, or `center`
   * on both axes, as a page-as-canvas editor shows a diagram. A view
   * choice: the drawing's coordinates are not moved.
   */
  readonly align: DiagramAlign
  /** Accessible name of a preview whose model has no `title`. */
  readonly fallbackTitle: string
}

export const DEFAULT_CANVAS_OPTIONS: DiagramCanvasOptions = {
  style: 'clean',
  newBlockWidth: undefined,
  align: 'start',
  kinds: defaultKinds(),
  // The built-in components are registered by the editor entry; without a
  // plugin, every block is edited as text.
  editors: {},
  sourceEditor: true,
  fallbackTitle: 'Diagram',
}

