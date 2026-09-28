/**
 * What `/present` and `/editor` both export besides `slides()`. The two
 * entries re-export this module, so their lists cannot drift apart. The
 * mdast node types are left to each entry: `/editor` has Lexical classes
 * with the same names and exports the mdast types as `…MdastNode`.
 */
export type { SlidesPresentOptions } from './options.js'
export type { SlidesOptions } from '../extension.js'
export { includeDeckFiles } from '../include-deck-files.js'
export type { DeckFile, ReadDeckFile, IncludeDeckFilesOptions } from '../include-deck-files.js'
export { SLIDES_LABELS } from './labels.js'
export type { SlidesLabels } from './labels.js'
export type { DeckMode, DeckState, DeckOverlay, DeckTool, DeckAction, DeckShape } from './state/deck-state.js'
export { createDeckController } from './state/controller.js'
export type { DeckController } from './state/controller.js'
export { useDeck } from './state/use-deck.js'
export { Controls } from './controls.js'
export type { DeckControlsProps } from './controls.js'
export { DECK_COMMANDS } from './commands/registry.js'
export type { DeckCommand } from './commands/registry.js'
export { broadcastTransport } from './sync.js'
export type { SyncTransport, ClosableTransport } from './sync.js'
export { SLIDE_MARKER_NODE, isSlideMarkerNode } from '../deck/markers.js'
export type { MarkerKind } from '../deck/marker-kinds/registry.js'
export { SLIDE_DIRECTIVE_NODE, isSlideDirectiveNode } from '../deck/directives.js'
export type { DirectiveKey } from '../deck/directive-keys/registry.js'
export { SLIDES_DIAGNOSTIC_CODES } from '../deck/diagnostics.js'
export type { SlidesDiagnosticCode } from '../deck/diagnostics.js'
export type { DeckModel, SlideModel, SlideAspect, SlideProperties, SlideBlock, SlideLayout, SlideTransition } from '../deck/model.js'
export { SLIDE_LAYOUTS, LAYOUT_SPECS } from '../deck/directive-keys/layout.js'
export type { LayoutSpec } from '../deck/directive-keys/layout.js'
export { SLIDE_TRANSITIONS } from '../deck/directive-keys/transition.js'
