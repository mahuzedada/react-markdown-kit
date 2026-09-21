/**
 * Ported from @zuilib/text-editor (MIT). The editor plugin: handles
 * `INSERT_DIAGRAM_COMMAND`, records `DIAGRAM_FOCUS_COMMAND`, publishes the
 * canvas options to the editor, and contributes the toolbar button.
 */
import { COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_LOW, type LexicalEditor, type NodeKey } from 'lexical'
import type { EditorCommandContribution, EditorPlugin } from '@react-markdown-kit/editor/lexical'
import { EMPTY_DRAWING, serializeDrawingData, type DrawingData } from '../core/drawing-data.js'
import { setDiagramOptions, type DiagramCanvasOptions } from '../canvas/options.js'
import { Icon, UI_ICONS } from '../canvas/icons.js'
import { DIAGRAM_FOCUS_COMMAND, INSERT_DIAGRAM_COMMAND } from './commands.js'
import { $createDiagramNode } from './diagram-node.js'
import { $insertNodeToNearestRoot } from '@lexical/utils'

const focused = new WeakMap<LexicalEditor, NodeKey | null>()

/** Key of the canvas that currently has focus, if any. */
export function getFocusedDiagramKey(editor: LexicalEditor): NodeKey | null {
  return focused.get(editor) ?? null
}

/** The plugin for one `mermaid()` configuration. */
export function createDiagramPlugin(options: DiagramCanvasOptions): EditorPlugin {
  return (editor) => {
    const unregisterOptions = setDiagramOptions(editor, options)
    const unregisterInsert = editor.registerCommand(
      INSERT_DIAGRAM_COMMAND,
      (payload) => {
        const width = payload?.width ?? options.newBlockWidth
        const data: DrawingData =
          width === undefined
            ? EMPTY_DRAWING
            : { version: 3, canvasHeight: EMPTY_DRAWING.canvasHeight, width, shapes: [] }
        $insertNodeToNearestRoot($createDiagramNode(serializeDrawingData(data)))
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )
    const unregisterFocus = editor.registerCommand(
      DIAGRAM_FOCUS_COMMAND,
      (key) => {
        focused.set(editor, key)
        // Recorded, not consumed: an application listener still hears it.
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
    return () => {
      unregisterFocus()
      unregisterInsert()
      unregisterOptions()
      focused.delete(editor)
    }
  }
}

/** The default toolbar's "Insert diagram" button. */
export const DIAGRAM_COMMAND: EditorCommandContribution = {
  id: 'diagram',
  label: 'Insert diagram',
  icon: <Icon size={18}>{UI_ICONS.insertDiagram}</Icon>,
  run(editor) {
    // The editor's own commands commit discretely (a queued Lexical update
    // lands on a microtask); dispatching inside a discrete update matches
    // that, so the click has landed when the handler returns.
    editor.update(
      () => {
        editor.dispatchCommand(INSERT_DIAGRAM_COMMAND, undefined)
      },
      { discrete: true },
    )
  },
}
