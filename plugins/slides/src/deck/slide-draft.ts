/**
 * A slide while the reader is still walking it. Directives write its
 * properties, markers move it between fragment groups, columns and notes,
 * and every other block lands in `blocks` (or `notes`) where it stands.
 * `finishSlides` turns the drafts into `SlideModel`s once the walk is over.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import type { SourceRange } from '@internal/diagnostics/index.js'
import type { SlideBlock, SlideProperties } from './model.js'

export type WritableProperties = { -readonly [K in keyof SlideProperties]: SlideProperties[K] }

export interface SlideDraft {
  readonly properties: WritableProperties
  /** Where each directive key was last set, so a diagnostic can point at it. */
  readonly ranges: Map<string, SourceRange | undefined>
  readonly blocks: SlideBlock[]
  /** The fragment group the next block joins: 0, then one more per `--`. */
  group: number
  /** The column the next block joins: 0, then 1 after `::right::`. */
  column: number
  readonly notes: MarkdownNode[]
  inNotes: boolean
  first: SourceRange | undefined
  last: SourceRange | undefined
  /** The break that opened the slide; undefined for the first one. */
  readonly opener: SourceRange | undefined
  contentSeen: number
}

/** A slide that starts from the deck's defaults (front matter), copied so the slide's own directives never leak back. */
export function newDraft(opener: SourceRange | undefined, defaults: SlideProperties): SlideDraft {
  return {
    properties: { ...defaults, classes: [...defaults.classes] },
    ranges: new Map(),
    blocks: [],
    group: 0,
    column: 0,
    notes: [],
    inNotes: false,
    first: undefined,
    last: undefined,
    opener,
    contentSeen: 0,
  }
}

/** A content block: into the notes after `???`, else into the current group and column. */
export function addBlock(draft: SlideDraft, node: MarkdownNode): void {
  draft.contentSeen += 1
  if (draft.inNotes) draft.notes.push(node)
  else draft.blocks.push({ node, group: draft.group, column: draft.column })
}
