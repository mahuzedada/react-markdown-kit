/**
 * Ported from @zuilib/text-editor (MIT). Pure public API of the drawing
 * core: data model, parser, JSON Schemas, skeleton expansion, binding
 * helpers, shape definitions and the Mermaid exporter. No React, no
 * Lexical, no DOM.
 */
export type {
  DrawingData,
  DrawingShape,
  DrawingShapeType,
  NodeShapeType,
  ConnectorType,
  Binding,
  BindingSide,
  Point,
} from './drawing-data.js'
export {
  deserializeDrawingData,
  normalizeDrawingData,
  serializeDrawingData,
  isNodeShapeType,
  NODE_SHAPE_TYPES,
  CONNECTOR_TYPES,
  SHAPE_TYPES,
  SIDE_FIXED_POINTS,
  STROKE_COLORS,
  FILL_COLORS,
  EMPTY_DRAWING,
} from './drawing-data.js'
export { DRAWING_DATA_JSON_SCHEMA } from './schema.js'
export { findNodeShapeAt, createBinding } from './bindings.js'
export { NODE_SHAPE_DEFINITIONS } from './shapes/definitions.js'
export type { NodeShapeDefinition, TextField } from './shapes/definitions.js'
export {
  expandDrawingSkeleton,
  parseDrawingSkeleton,
  isDrawingSkeleton,
  COLOR_PRESETS,
  DRAWING_SKELETON_JSON_SCHEMA,
} from './skeleton.js'
export type {
  DrawingSkeleton,
  SkeletonBox,
  SkeletonConnector,
  SkeletonEnd,
  SkeletonText,
  ColorName,
} from './skeleton.js'
export { drawingToMermaid } from './mermaid.js'
export type { MermaidOptions, MermaidDirection } from './mermaid.js'
export { parseMermaidFlowchart, isMermaidFlowchart } from './mermaid-parse.js'
export type { MermaidParse } from './mermaid-parse.js'
export {
  readLayoutAnnotation,
  writeLayoutAnnotation,
  edgeKeys,
  LAYOUT_ANNOTATION_MARKER,
  LAYOUT_ANNOTATION_VERSION,
  LAYOUT_SLOTS,
  LAYOUT_NODE_TYPES,
} from './layout-annotation.js'
export type {
  LayoutAnnotation,
  LayoutNode,
  LayoutEdge,
  LayoutAnchor,
  LayoutSlot,
  LayoutNodeType,
  LayoutProblem,
  LayoutRead,
} from './layout-annotation.js'
export { LAYOUT_ANNOTATION_JSON_SCHEMA } from './layout-annotation-schema.js'
export type { DrawingStyle } from './ink.js'
export { BLOCK_WIDTHS, isBlockWidth } from './block-width.js'
export type { BlockWidth, NewBlockWidths } from './block-width.js'
