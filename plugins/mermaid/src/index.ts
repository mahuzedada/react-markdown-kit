/**
 * @react-markdown-kit/mermaid — Mermaid diagrams as a plugin.
 *
 * `mermaid()` is the API: put it in a preset or an `extensions` prop and a
 * ```mermaid fence becomes a static SVG in the renderer, stays literal in
 * the template engine, and, with the `/editor` entry, opens on a drawing
 * canvas or in a source editor. Diagram kinds are configuration values like
 * `gfm()`: `flowchart()` and `sequenceDiagram()` are the built-in ones, and
 * `mermaid({ kinds })` takes the ordered list to register. Fences of any
 * other Mermaid type (`MERMAID_KEYWORDS`) are named and shown as source.
 * Flowchart edits are written back as Mermaid syntax plus one
 * `%% rmk-layout v1 {…}` annotation holding the geometry, so the same fence
 * renders on GitHub, GitLab or Obsidian. The legacy ```diagram and
 * ```drawing JSON fences are still read. This entry loads no React and no
 * Lexical. LAYOUT_ANNOTATION.md specifies the annotation and
 * DRAWING_FORMAT.md the fences; the JSON Schemas are the same rules for
 * validators and generators.
 */
export { mermaid, DIAGRAM_NODE, isDiagramNode } from './extension.js'
export type { DiagramNode, DiagramFormat, MermaidPluginOptions } from './extension.js'
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
export { LAYOUT_ANNOTATION_JSON_SCHEMA } from './core/layout-annotation-schema.js'
export {
  readLayoutAnnotation,
  writeLayoutAnnotation,
  LAYOUT_ANNOTATION_MARKER,
  LAYOUT_ANNOTATION_VERSION,
} from './core/layout-annotation.js'
export type {
  LayoutAnnotation,
  LayoutNode,
  LayoutEdge,
  LayoutAnchor,
  LayoutSlot,
  LayoutProblem,
  LayoutRead,
} from './core/layout-annotation.js'
export type { DrawingData, DrawingShape, DrawingShapeType, BlockWidth, DrawingStyle } from './core/index.js'
