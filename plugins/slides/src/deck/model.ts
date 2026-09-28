/**
 * The deck model: what `readDeck` produces and the root handler renders.
 *
 * A deck is a flat mdast root read a second way. Nothing here references the
 * DOM or React; the model is plain data so the syntax transform (which only
 * wants diagnostics) and the renderer handler (which wants structure) can
 * share one reader.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import type { MarkdownDiagnostic, SourceRange } from '@internal/diagnostics/index.js'
import type { SlideLayout } from './directive-keys/layout.js'
import type { SlideTransition } from './directive-keys/transition.js'

export type { SlideLayout, SlideTransition }

export type SlideAspect = '16:9' | '4:3'

/**
 * What directives set on a slide. Front matter sets the deck-wide default
 * of every key that allows it; the slide's own directive wins, except
 * `classes`, which accumulate after the deck's.
 */
export interface SlideProperties {
  /** Deck classes first, then the slide's own, in source order. */
  readonly classes: readonly string[]
  /** From `<!-- name: … -->`; absent when unset or a duplicate. */
  readonly name?: string
  readonly background?: string
  readonly layout?: SlideLayout
  /** The picture an `image-left` or `image-right` layout places. */
  readonly image?: string
  readonly transition?: SlideTransition
  readonly footer?: string
  /** Show the slide number in the footer. */
  readonly paginate?: boolean
  /** Reveal the items of every root-level list one step at a time. */
  readonly incremental?: boolean
}

/** One content block and where it stands: its fragment group (0 before any `--`) and column (1 after `::right::`). */
export interface SlideBlock {
  readonly node: MarkdownNode
  readonly group: number
  readonly column: number
}

export interface SlideModel extends SlideProperties {
  /** Zero-based. The rendered number is `index + 1`. */
  readonly index: number
  /** Plain text of the slide's first heading. */
  readonly title?: string
  /**
   * Content blocks by fragment group: `groups[0]` is always visible,
   * `groups[k]` appears after the k-th `--` marker.
   */
  readonly groups: readonly (readonly MarkdownNode[])[]
  /** Every content block in source order, with its group and column. */
  readonly blocks: readonly SlideBlock[]
  /** 1, or 2 when the slide has a `::right::` marker. */
  readonly columns: number
  /** Blocks after `???`. */
  readonly notes: readonly MarkdownNode[]
  /** No content blocks and no notes. Still rendered. */
  readonly empty: boolean
  /** Spans the slide's nodes, or the break that opened it when it has none. */
  readonly position?: SourceRange
}

export interface DeckModel {
  /** Front matter `title`, else the first slide's title. */
  readonly title?: string
  /** Front matter `aspect`, when it named a supported ratio. */
  readonly aspect?: SlideAspect
  /** Front matter `class` tokens, prepended to every slide. */
  readonly class: readonly string[]
  /** Front matter `background`, the default for slides without their own. */
  readonly background?: string
  readonly slides: readonly SlideModel[]
  /** What the reader noticed about structure. The transform reports these. */
  readonly diagnostics: readonly MarkdownDiagnostic[]
}
