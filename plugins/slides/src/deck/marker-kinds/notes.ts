/** `???`: every block after it, up to the next break, is speaker notes. A second one is ignored. */
import type { MarkerKindSpec } from './marker-kind.js'

export const notesMarker = {
  kind: 'notes',
  spelling: '???',
  apply: (draft) => {
    if (draft.inNotes) return 'misplaced'
    draft.inNotes = true
    return undefined
  },
} as const satisfies MarkerKindSpec<'notes'>
