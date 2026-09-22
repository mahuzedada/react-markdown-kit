/**
 * Ported from @zuilib/text-editor (MIT). The two Lexical commands of the
 * diagram block: insert a new diagram of a kind, and report which block has
 * focus.
 */
import { createCommand, type LexicalCommand, type NodeKey } from 'lexical'
import type { BlockWidth } from '../core/block-width.js'

/**
 * Dispatched by a block when it gains focus (its node key) or loses it
 * (`null`). A diagram is a decorator, so Lexical's selection does not
 * follow the caret into it; an application that needs to know which block
 * is active listens to this.
 */
export const DIAGRAM_FOCUS_COMMAND: LexicalCommand<NodeKey | null> = createCommand('DIAGRAM_FOCUS_COMMAND')

export interface InsertDiagramPayload {
  /** Kind name from the registry. Default `flowchart`. A kind that is not registered inserts nothing. */
  readonly kind?: string
  /** Block width written into an inserted flowchart. Absent: the editor's `newBlockWidth`. */
  readonly width?: BlockWidth
}

/**
 * Insert a kind's starter at the selection. Handled by the plugin that
 * `mermaid()` on the `/editor` entry registers; a no-op without it.
 */
export const INSERT_DIAGRAM_COMMAND: LexicalCommand<InsertDiagramPayload | undefined> = createCommand('INSERT_DIAGRAM_COMMAND')
