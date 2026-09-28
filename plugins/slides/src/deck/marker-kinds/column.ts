/**
 * `::right::` (Slidev's spelling): the blocks after it go in the slide's
 * second column. One per slide, before the notes. Fragment groups carry
 * across it, so a pause on the left still counts on the right.
 */
import type { MarkerKindSpec } from './marker-kind.js'

export const columnMarker = {
  kind: 'column',
  spelling: '::right::',
  apply: (draft) => {
    if (draft.inNotes || draft.column > 0) return 'misplaced'
    draft.column = 1
    return undefined
  },
} as const satisfies MarkerKindSpec<'column'>
