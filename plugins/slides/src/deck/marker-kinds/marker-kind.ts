/**
 * The contract every marker kind implements. A marker is a paragraph that
 * holds exactly its spelling; `apply` is what reading one does to the
 * slide being built. Registering a spec in `registry.ts` is all a new
 * marker needs: the transform, the reader, the serializer and the editor's
 * Enter shortcut all look spellings up there.
 */
import type { SlideDraft } from '../slide-draft.js'

export interface MarkerKindSpec<Kind extends string = string> {
  readonly kind: Kind
  readonly spelling: string
  /** Moves the draft on. Returns `misplaced` when the marker cannot apply where it stands; the draft is then unchanged. */
  readonly apply: (draft: SlideDraft) => 'misplaced' | undefined
}
