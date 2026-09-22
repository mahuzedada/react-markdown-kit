/**
 * The `EditorBlockAdapter` for the `diagram` mdast node: how a fence becomes
 * a `DiagramNode` and how the node goes back to mdast.
 *
 * Untouched blocks hand back the exact bytes they were imported with, so a
 * hand-written flowchart, a sequence diagram, a ```diagram skeleton or an
 * unparseable payload survives a session that never edits it. An edited
 * block is rebuilt from its source with `diagramNodeFrom`, the same function
 * the syntax transform uses, and written as ```mermaid whichever fence it
 * came from. The adapter is built per registry because the edited node's
 * kind, model and problems come from the registered kinds.
 */
import type { LexicalNode } from 'lexical'
import type { EditorBlockAdapter } from '@react-markdown-kit/editor/lexical'
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { EMPTY_DRAWING, type DrawingData } from '../core/drawing-data.js'
import type { DiagramKind } from '../core/kind.js'
import { DIAGRAM_NODE, diagramNodeFrom, type DiagramNode as DiagramMdastNode } from '../extension.js'
import { $createImportedDiagramNode, $isDiagramNode, FLOWCHART_KIND, legacySource, type DiagramNode } from './diagram-node.js'

export function createDiagramBlockAdapter(kinds: readonly DiagramKind[]): EditorBlockAdapter {
  return {
    type: DIAGRAM_NODE,

    $import(node: MarkdownNode, source: string): LexicalNode {
      const origin = node as DiagramMdastNode
      const raw = source === '' ? null : source
      if (origin.format === 'mermaid') return $createImportedDiagramNode(origin.value, origin.kind, origin, raw)
      // A legacy JSON fence is a flowchart from the first moment: its source
      // is the writer's output. A payload that did not parse opens empty but
      // still writes back its bytes until the user edits it.
      const model = (origin.model as DrawingData | undefined) ?? EMPTY_DRAWING
      return $createImportedDiagramNode(legacySource(model), FLOWCHART_KIND, origin, raw)
    },

    matches: $isDiagramNode,

    $export(node: LexicalNode) {
      const diagram = node as DiagramNode
      const origin = diagram.getOrigin()
      if (origin !== null) return { node: origin, raw: diagram.getRaw() }
      const meta = diagram.getMeta()
      const edited = diagramNodeFrom(diagram.getSource(), 'mermaid', kinds, meta === null ? {} : { meta })
      return { node: edited, raw: null }
    },
  }
}
