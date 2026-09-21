/**
 * @react-markdown-kit/mermaid — Mermaid flowcharts as a plugin.
 *
 * `mermaid()` is the whole API: put it in a preset or an `extensions` prop
 * and a ```mermaid flowchart becomes a static SVG in the renderer, stays
 * literal in the template engine, and, with the `/editor` entry, opens on a
 * drawing canvas. Edits are written back as Mermaid syntax plus one
 * `%% rmk-layout v1 {…}` annotation holding the geometry, so the same fence
 * renders on GitHub, GitLab or Obsidian. The legacy ```diagram and
 * ```drawing JSON fences are still read. This entry loads no React and no
 * Lexical. LAYOUT_ANNOTATION.md specifies the annotation and
 * DRAWING_FORMAT.md the fences; the JSON Schemas are the same rules for
 * validators and generators.
 */
export { mermaid, DIAGRAM_NODE, isDiagramNode } from './extension.js'
export type { DiagramNode, DiagramFormat, MermaidPluginOptions } from './extension.js'
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
