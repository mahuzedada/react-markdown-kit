/**
 * @react-markdown-kit/slides — slides from Markdown, as a plugin.
 *
 * `slides()` is the whole API: put it in a preset or an `extensions` prop
 * and a Markdown file whose slides are separated by `---` renders as one
 * <article data-rmk-deck> of <section>s, with speaker notes after `???`,
 * fragments after `--`, and `<!-- class | background | name: … -->`
 * directives per slide. The Markdown stays plain CommonMark: GitHub shows
 * the same file as a document with rules. This entry loads no React and no
 * Lexical; `/present` adds present mode and `/editor` the authoring
 * commands. DIALECT.md specifies what is read and written.
 */
export { slides } from './extension.js'
export type { SlidesOptions } from './extension.js'
export { SLIDE_MARKER_NODE, isSlideMarkerNode } from './deck/markers.js'
export type { SlideMarkerNode, MarkerKind } from './deck/markers.js'
export { SLIDE_DIRECTIVE_NODE, isSlideDirectiveNode } from './deck/directives.js'
export type { SlideDirectiveNode, DirectiveKey } from './deck/directives.js'
export { SLIDES_DIAGNOSTIC_CODES } from './deck/diagnostics.js'
export type { SlidesDiagnosticCode } from './deck/diagnostics.js'
export type { DeckModel, SlideModel, SlideAspect } from './deck/model.js'
