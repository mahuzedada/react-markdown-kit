/**
 * Ported from @zuilib/text-editor (MIT). The two Lexical commands of the
 * diagram block: insert a new drawing, and report which canvas has focus.
 */
import { createCommand, type LexicalCommand, type NodeKey } from 'lexical'
import type { BlockWidth } from '../core/block-width.js'

/**
 * Dispatched by a canvas when it gains focus (its node key) or loses it
 * (`null`). A drawing is a decorator, so Lexical's selection does not
 * follow the caret into it; an application that needs to know which block
 * is active listens to this.
 */
export const DIAGRAM_FOCUS_COMMAND: LexicalCommand<NodeKey | null> = createCommand('DIAGRAM_FOCUS_COMMAND')

/**
 * Insert an empty drawing at the selection. Handled by the plugin that
 * `mermaid()` on the `/editor` entry registers; a no-op without it.
 */
export const INSERT_DIAGRAM_COMMAND: LexicalCommand<{ readonly width?: BlockWidth } | undefined> =
  createCommand('INSERT_DIAGRAM_COMMAND')
