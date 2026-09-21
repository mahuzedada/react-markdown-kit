/**
 * `@react-markdown-kit/mermaid/editor` — `mermaid()` with the canvas.
 *
 * The same extension as the root entry (same `name`, so it replaces the
 * headless one in a preset) plus an `editor` capability: the Lexical node,
 * the block adapter that maps a ```diagram / ```drawing fence to it and back,
 * the insert command and the toolbar button. This is the only entry that
 * loads React and Lexical.
 */
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import { lexicalAdapter } from '@react-markdown-kit/editor/lexical'
import { mermaid as headlessMermaid, type MermaidPluginOptions } from './extension.js'
import type { BlockWidth } from './core/block-width.js'
import type { DrawingStyle } from './core/ink.js'
import type { DiagramCanvasOptions } from './canvas/options.js'
import { DiagramNode } from './node/diagram-node.js'
import { diagramBlockAdapter } from './node/adapter.js'
import { DIAGRAM_COMMAND, createDiagramPlugin } from './node/plugin.js'

export interface MermaidEditorOptions extends MermaidPluginOptions {
  /** How the canvas draws shapes: `clean` (default) or hand-drawn `ink`. */
  readonly style?: DrawingStyle
  /** Block width written into a drawing inserted from the toolbar. Default `full`. */
  readonly newBlockWidth?: BlockWidth
}

export function mermaid(options: MermaidEditorOptions = {}): MarkdownExtension {
  const headless = headlessMermaid(options)
  const canvas: DiagramCanvasOptions = { style: options.style ?? 'clean', newBlockWidth: options.newBlockWidth }
  return {
    ...headless,
    capabilities: {
      ...headless.capabilities,
      editor: lexicalAdapter({
        nodes: [DiagramNode],
        blocks: [diagramBlockAdapter],
        plugins: [createDiagramPlugin(canvas)],
        commands: [DIAGRAM_COMMAND],
      }),
    },
  }
}

export { DIAGRAM_NODE, isDiagramNode } from './extension.js'
export type { DiagramFormat, MermaidPluginOptions } from './extension.js'
export type { DiagramNode as DiagramMdastNode } from './extension.js'
export { DRAWING_DATA_JSON_SCHEMA } from './core/schema.js'
export { DRAWING_SKELETON_JSON_SCHEMA } from './core/skeleton.js'
export type { DrawingData, DrawingShape, DrawingShapeType, BlockWidth, DrawingStyle } from './core/index.js'
/** The focus command lets an application know which canvas is active. */
export { DIAGRAM_FOCUS_COMMAND, INSERT_DIAGRAM_COMMAND } from './node/commands.js'
export { DIAGRAM_LABELS, DIAGRAM_LABEL_PREFIX } from './canvas/labels.js'
export type { DiagramLabels, DiagramLabelKey } from './canvas/labels.js'
