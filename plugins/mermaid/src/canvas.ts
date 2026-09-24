/**
 * `@react-markdown-kit/mermaid/canvas`: the Mermaid canvas on its own, no
 * Markdown editor (docs/MERMAID_PLATFORM.md section 9.7).
 *
 * `<MermaidCanvas value onChange />` fills its container with the drawing
 * surface and floats the tools over it; `createMermaidCanvas(container)`
 * does the same for a page that is not written in React. The source in and
 * out is Mermaid text, exactly what the editor's block stores in a
 * ```mermaid fence, so a diagram moves between the two unchanged. This
 * entry loads React and ReactDOM but neither Lexical nor the editor
 * package; import `@react-markdown-kit/mermaid/styles.css` with it.
 */
export { MermaidCanvas } from './standalone/mermaid-canvas.js'
export type { MermaidCanvasProps, MermaidCanvasToolbar } from './standalone/mermaid-canvas.js'
export { createMermaidCanvas } from './standalone/mount.js'
export type { MermaidCanvasHandle, MermaidCanvasOptions } from './standalone/mount.js'
export { flowchart } from './core/flowchart-kind.js'
export { sequenceDiagram } from './core/sequence/index.js'
export { MERMAID_KEYWORDS } from './core/detect.js'
export type { DiagramKind, DiagramParse, DiagramParseError, DiagramProblem, RetainedLine } from './core/kind.js'
export type { DrawingStyle } from './core/index.js'
export type { DiagramAlign, DiagramKindEditor, DiagramKindEditorProps, DiagramKindEditors } from './canvas/options.js'
export { DIAGRAM_LABELS } from './canvas/labels.js'
export type { DiagramLabels, DiagramLabelKey } from './canvas/labels.js'
