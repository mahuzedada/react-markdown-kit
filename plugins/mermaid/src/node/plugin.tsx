/**
 * Ported from @zuilib/text-editor (MIT). The editor plugin: handles
 * `INSERT_DIAGRAM_COMMAND`, records `DIAGRAM_FOCUS_COMMAND`, publishes the
 * block options to the editor, and contributes one toolbar button per
 * registered kind.
 */
import { COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_LOW, type LexicalEditor, type NodeKey } from 'lexical'
import type { EditorCommandContribution, EditorPlugin } from '@react-markdown-kit/editor/lexical'
import { $insertNodeToNearestRoot } from '@lexical/utils'
import type { BlockWidth } from '../core/block-width.js'
import type { DrawingData } from '../core/drawing-data.js'
import type { DiagramKind } from '../core/kind.js'
import type { DiagramCanvasOptions } from '../canvas/options.js'
import { canvasKindOf, requestDiagramFocus, setDiagramOptions } from './options-store.js'
import { Icon, KindIcon, UI_ICONS } from '../canvas/icons.js'
import { DIAGRAM_FOCUS_COMMAND, INSERT_DIAGRAM_COMMAND } from './commands.js'
import { $createDiagramNode, FLOWCHART_KIND } from './diagram-node.js'

const focused = new WeakMap<LexicalEditor, NodeKey | null>()

/** Key of the block that currently has focus, if any. */
export function getFocusedDiagramKey(editor: LexicalEditor): NodeKey | null {
  return focused.get(editor) ?? null
}

/**
 * The source an insert writes: the kind's starter. A flowchart inserted with
 * a block width carries it in its layout annotation, so the starter is
 * parsed, widened and written back through the kind.
 */
function starterSource(kind: DiagramKind, width: BlockWidth | undefined): string {
  if (width === undefined || kind.name !== FLOWCHART_KIND || kind.write === undefined) return kind.starter
  const parsed = kind.parse(kind.starter)
  if ('error' in parsed) return kind.starter
  const model = { ...(parsed.model as DrawingData), width }
  return kind.write(model, { retained: parsed.retained })
}

/** The plugin for one `mermaid()` configuration. */
export function createDiagramPlugin(options: DiagramCanvasOptions): EditorPlugin {
  return (editor) => {
    const unregisterOptions = setDiagramOptions(editor, options)
    const unregisterInsert = editor.registerCommand(
      INSERT_DIAGRAM_COMMAND,
      (payload) => {
        const name = payload?.kind ?? FLOWCHART_KIND
        const kind = options.kinds.find((candidate) => candidate.name === name)
        if (kind === undefined) return false
        const node = $createDiagramNode(starterSource(kind, payload?.width ?? options.newBlockWidth), kind.name)
        $insertNodeToNearestRoot(node)
        requestDiagramFocus(editor, node.getKey())
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

/** The toolbar group every diagram button sits in. */
export const DIAGRAM_COMMAND_GROUP = 'diagram'

/**
 * One insert button per registered kind. The flowchart keeps the legacy id
 * `diagram`, so existing label overrides keep working; the others are
 * `diagram-<kind>`.
 */
export function diagramCommands(kinds: readonly DiagramKind[]): readonly EditorCommandContribution[] {
  const canvas = canvasKindOf(kinds)
  return kinds
    .filter((kind) => kind.starter !== '')
    .map((kind) => ({
      id: kind === canvas ? 'diagram' : `diagram-${kind.name}`,
      group: DIAGRAM_COMMAND_GROUP,
      label: kind === canvas ? 'Insert diagram' : `Insert ${kind.label.toLowerCase()}`,
      icon: kind.icon === undefined ? <Icon size={18}>{UI_ICONS.insertDiagram}</Icon> : <KindIcon size={18} path={kind.icon} />,
      run(editor) {
        // The editor's own commands commit discretely (a queued Lexical update
        // lands on a microtask); dispatching inside a discrete update matches
        // that, so the click has landed when the handler returns.
        editor.update(
          () => {
            editor.dispatchCommand(INSERT_DIAGRAM_COMMAND, { kind: kind.name })
          },
          { discrete: true },
        )
      },
    }))
}
