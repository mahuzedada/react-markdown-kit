/** `--`: the blocks after it form the next fragment group. Ignored inside the notes. */
import type { MarkerKindSpec } from './marker-kind.js'

export const pauseMarker = {
  kind: 'pause',
  spelling: '--',
  apply: (draft) => {
    if (draft.inNotes) return 'misplaced'
    draft.group += 1
    return undefined
  },
} as const satisfies MarkerKindSpec<'pause'>
