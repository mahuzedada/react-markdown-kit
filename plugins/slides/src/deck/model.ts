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

export type SlideAspect = '16:9' | '4:3'

export interface SlideModel {
  /** Zero-based. The rendered number is `index + 1`. */
  readonly index: number
  /** From `<!-- name: … -->`; absent when unset or a duplicate. */
  readonly name?: string
  /** Plain text of the slide's first heading. */
  readonly title?: string
  /** Deck classes first, then the slide's own, in source order. */
  readonly classes: readonly string[]
  /** The slide's `background` directive, else the deck's. */
  readonly background?: string
  /**
   * Content blocks by fragment group: `groups[0]` is always visible,
   * `groups[k]` appears after the k-th `--` marker.
   */
  readonly groups: readonly (readonly MarkdownNode[])[]
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
