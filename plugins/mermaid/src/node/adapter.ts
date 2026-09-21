/**
 * The `EditorBlockAdapter` for the `diagram` mdast node: how a fence becomes
 * a `DiagramNode` and how the node goes back to mdast.
 *
 * Untouched blocks hand back the exact bytes they were imported with, so a
 * hand-written flowchart, a ```diagram skeleton or an unparseable payload
 * survives a session that never edits it. The first edit writes the block
 * as ```mermaid with a `%% rmk-layout v1` annotation, whichever fence it came from.
 */
import type { LexicalNode } from 'lexical'
import type { EditorBlockAdapter } from '@react-markdown-kit/editor/lexical'
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { deserializeDrawingData, serializeDrawingData } from '../core/drawing-data.js'
import { drawingToMermaid } from '../core/mermaid.js'
import { DIAGRAM_NODE, type DiagramNode as DiagramMdastNode } from '../extension.js'
import { $createImportedDiagramNode, $isDiagramNode, type DiagramNode } from './diagram-node.js'

export const diagramBlockAdapter: EditorBlockAdapter = {
  type: DIAGRAM_NODE,

  $import(node: MarkdownNode, source: string): LexicalNode {
    const origin = node as DiagramMdastNode
    // `data` is already expanded and normalized by the extension; a payload
    // that did not parse opens as an empty canvas but still writes back its
    // source until the user edits it.
    const data = origin.data ?? deserializeDrawingData('')
    return $createImportedDiagramNode(serializeDrawingData(data), origin, source === '' ? null : source)
  },

  matches: $isDiagramNode,

  $export(node: LexicalNode) {
    const diagram = node as DiagramNode
    const origin = diagram.getOrigin()
    if (origin !== null) return { node: origin, raw: diagram.getSource() }
    const data = diagram.getData()
    const edited: DiagramMdastNode = {
      type: DIAGRAM_NODE,
      format: 'mermaid',
      // The exporter ends with a newline; the fence supplies its own.
      value: drawingToMermaid(data).replace(/\n$/, ''),
      data,
    }
    return { node: edited, raw: null }
  },
}
