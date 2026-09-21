/**
 * `@react-markdown-kit/slides/present` — `slides()` with present mode.
 *
 * The same extension as the root entry (same `name`, so it replaces the
 * headless one in a preset) plus one renderer component: the <article> the
 * static deck emits becomes an interactive deck with a Present button,
 * keyboard and pointer navigation, fragments, a presenter view, deep links
 * and a cross-window sync channel. The static markup is unchanged, so server
 * rendering and hydration see the same DOM. This entry loads React.
 */
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import { slides as headlessSlides } from './extension.js'
import { createDeckArticle } from './present/deck-article.js'
import type { SlidesPresentOptions } from './present/options.js'

export function slides(options: SlidesPresentOptions = {}): MarkdownExtension {
  const headless = headlessSlides(options)
  return {
    ...headless,
    capabilities: {
      ...headless.capabilities,
      renderer: {
        ...headless.capabilities?.renderer,
        components: { article: createDeckArticle(options) },
      },
    },
  }
}

export type { SlidesPresentOptions } from './present/options.js'
export type { SlidesOptions } from './extension.js'
export { SLIDES_LABELS } from './present/labels.js'
export type { SlidesLabels } from './present/labels.js'
export type { DeckMode } from './present/use-deck-state.js'
export { SLIDE_MARKER_NODE, isSlideMarkerNode } from './deck/markers.js'
export type { SlideMarkerNode, MarkerKind } from './deck/markers.js'
export { SLIDE_DIRECTIVE_NODE, isSlideDirectiveNode } from './deck/directives.js'
export type { SlideDirectiveNode, DirectiveKey } from './deck/directives.js'
export { SLIDES_DIAGNOSTIC_CODES } from './deck/diagnostics.js'
export type { SlidesDiagnosticCode } from './deck/diagnostics.js'
export type { DeckModel, SlideModel, SlideAspect } from './deck/model.js'
