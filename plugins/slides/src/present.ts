/**
 * `@react-markdown-kit/slides/present` — `slides()` with present mode.
 *
 * The same extension as the root entry (same `name`, so it replaces the
 * headless one in a preset) plus one renderer component: the <article> the
 * static deck emits becomes an interactive deck with a Present button,
 * keyboard and pointer navigation, fragments, a presenter view, an
 * overview, deep links, a sync transport, and a controller for driving it
 * from outside. The static markup is unchanged, so server rendering and
 * hydration see the same DOM. This entry loads React.
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

export * from './present/public-api.js'
export type { SlideMarkerNode } from './deck/markers.js'
export type { SlideDirectiveNode } from './deck/directives.js'
