/**
 * `@react-markdown-kit/mermaid/editor` — `mermaid()` with the block editor.
 *
 * The same extension as the root entry (same `name`, so it replaces the
 * headless one in a preset) plus an `editor` capability: the Lexical node,
 * the block adapter that maps a ```mermaid, ```diagram or ```drawing fence
 * to it and back, the insert command and one toolbar button per kind. A
 * kind that writes and has a canvas component is edited on it: the built-in
 * map has the flowchart canvas and the sequence canvas, and `editors` adds
 * or replaces components by kind name. Every other kind is edited as text
 * with a live preview. This is the only entry that loads React and Lexical.
 */
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import { lexicalAdapter } from '@react-markdown-kit/editor/lexical'
import { mermaid as headlessMermaid, type MermaidPluginOptions } from './extension.js'
import type { BlockWidth } from './core/block-width.js'
import type { DrawingStyle } from './core/ink.js'
import { defaultKinds } from './core/kinds.js'
import type { DiagramAlign, DiagramCanvasOptions, DiagramKindEditors } from './canvas/options.js'
import { DiagramCanvas } from './canvas/drawing-canvas.js'
import { SequenceCanvas } from './canvas/sequence/sequence-canvas.js'
import { DiagramNode } from './node/diagram-node.js'
import { createDiagramBlockAdapter } from './node/adapter.js'
import { createDiagramPlugin, diagramCommands } from './node/plugin.js'

export interface MermaidEditorOptions extends MermaidPluginOptions {
  /** How the canvas draws shapes: `clean` (default) or hand-drawn `ink`. */
  readonly style?: DrawingStyle
  /** Block width written into a flowchart inserted from the toolbar. Default `full`. */
  readonly newBlockWidth?: BlockWidth
  /** `false` hides the source textarea: blocks edited as text show preview and problems only. Default `true`. */
  readonly sourceEditor?: boolean
  /**
   * Where the flowchart canvas shows a drawing smaller than its surface:
   * `start` (default) at the top-left, as a block sits in a document, or
   * `center` on both axes, for a host whose canvas is the page. The
   * drawing's coordinates stay as written; only the view moves.
   */
  readonly align?: DiagramAlign
  /**
   * Canvas components by kind name, for a kind that writes. A built-in name
   * (`flowchart`, `sequenceDiagram`) replaces the built-in component.
   */
  readonly editors?: DiagramKindEditors
}

/** The canvases the package ships, by kind name. */
function builtInEditors(): DiagramKindEditors {
  return { flowchart: DiagramCanvas, sequenceDiagram: SequenceCanvas }
}

export function mermaid(options: MermaidEditorOptions = {}): MarkdownExtension {
  // One registry instance for the headless parse and the editor, so the
  // memoised parses are shared between the syntax transform and the block.
  const kinds = options.kinds ?? defaultKinds()
  const headless = headlessMermaid({ ...options, kinds })
  const canvas: DiagramCanvasOptions = {
    style: options.style ?? 'clean',
    newBlockWidth: options.newBlockWidth,
    kinds,
    editors: { ...builtInEditors(), ...options.editors },
    sourceEditor: options.sourceEditor ?? true,
    align: options.align ?? 'start',
    fallbackTitle: options.fallbackTitle ?? 'Diagram',
  }
  return {
    ...headless,
    capabilities: {
      ...headless.capabilities,
      editor: lexicalAdapter({
        nodes: [DiagramNode],
        blocks: [createDiagramBlockAdapter(kinds)],
        plugins: [createDiagramPlugin(canvas)],
        commands: diagramCommands(kinds),
      }),
    },
  }
}

export { DIAGRAM_NODE, isDiagramNode } from './extension.js'
export type { DiagramFormat, MermaidPluginOptions } from './extension.js'
export type { DiagramNode as DiagramMdastNode } from './extension.js'
export { flowchart } from './core/flowchart-kind.js'
export { sequenceDiagram } from './core/sequence/index.js'
export { MERMAID_KEYWORDS } from './core/detect.js'
export type {
  DiagramKind,
  DiagramParse,
  DiagramParseError,
  DiagramProblem,
  DiagramRenderOptions,
  DiagramWriteOptions,
  RetainedLine,
} from './core/kind.js'
export { DRAWING_DATA_JSON_SCHEMA } from './core/schema.js'
export { DRAWING_SKELETON_JSON_SCHEMA } from './core/skeleton.js'
export type { DrawingData, DrawingShape, DrawingShapeType, BlockWidth, DrawingStyle } from './core/index.js'
/** The focus command lets an application know which block is active. */
export { DIAGRAM_FOCUS_COMMAND, INSERT_DIAGRAM_COMMAND } from './node/commands.js'
export type { InsertDiagramPayload } from './node/commands.js'
export type { DiagramAlign, DiagramKindEditor, DiagramKindEditorProps, DiagramKindEditors } from './canvas/options.js'
/** The slot a host mounts to take the canvases' tool rows out of the blocks (spec 9.6). */
export { DiagramToolbar } from './node/diagram-toolbar.js'
export type { DiagramToolbarProps } from './node/diagram-toolbar.js'
export { DIAGRAM_LABELS, DIAGRAM_LABEL_PREFIX } from './canvas/labels.js'
export type { DiagramLabels, DiagramLabelKey } from './canvas/labels.js'
