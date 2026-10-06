/**
 * `@react-markdown-kit/slides/canvas` — `<SlideCanvas>`, a deck as a slide
 * editor: the current slide on a canvas, every slide in a strip or a grid,
 * text edited in place on the slide, speaker notes under it. The deck stays
 * one Markdown string. Re-exports the `/editor` entry's `slides()`, the one
 * the canvas's preset should hold. This entry loads React and Lexical.
 */
export { SlideCanvas } from './canvas/slide-canvas.js'
export type { SlideCanvasProps } from './canvas/slide-canvas.js'
export { SLIDE_CANVAS_LABELS } from './canvas/labels.js'
export type { SlideCanvasLabels } from './canvas/labels.js'
export { CanvasMenu } from './canvas/popover.js'
export type { CanvasMenuItem, CanvasMenuProps } from './canvas/popover.js'
export { CANVAS_TOOLS } from './canvas/tools.js'
export type { CanvasTool } from './canvas/tools.js'
export { slideSpans } from './canvas/outline.js'
export type { SourceSpan } from './canvas/outline.js'
export * from './editor.js'
