/**
 * "Did the user just type one character here?"
 *
 * True only when the text under a collapsed caret grew by exactly one
 * character, just before the caret. A load, a paste, an undo, a deletion or a
 * toolbar command never passes, so text that only happens to look like a
 * shortcut is never rewritten; that would change a document nobody typed
 * into, which the round trip does not allow.
 */
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COLLABORATION_TAG,
  HISTORIC_TAG,
  type LexicalEditor,
  type NodeKey,
  type UpdateListener,
} from 'lexical'

export type UpdatePayload = Parameters<UpdateListener>[0]

export interface TypedCaret {
  readonly key: NodeKey
  readonly offset: number
  /** The character just typed. */
  readonly character: string
}

export function typedCaret(editor: LexicalEditor, payload: UpdatePayload): TypedCaret | null {
  const { tags, dirtyLeaves, editorState, prevEditorState } = payload
  if (tags.has(COLLABORATION_TAG) || tags.has(HISTORIC_TAG) || editor.isComposing()) return null
  const selection = editorState.read($getSelection)
  const previous = prevEditorState.read($getSelection)
  if (!$isRangeSelection(previous) || !$isRangeSelection(selection) || !selection.isCollapsed()) return null
  const { key, offset } = selection.anchor
  if (!dirtyLeaves.has(key)) return null
  const now = editorState.read(() => $getNodeByKey(key)?.getTextContent())
  const before = prevEditorState.read(() => $getNodeByKey(key)?.getTextContent())
  if (now === undefined || !editorState.read(() => $isTextNode($getNodeByKey(key)))) return null
  const grewAtCaret =
    before === undefined
      ? offset === 1 && now.length === 1
      : previous.anchor.key === key &&
        offset === previous.anchor.offset + 1 &&
        now.length === before.length + 1 &&
        now.slice(0, offset - 1) === before.slice(0, offset - 1) &&
        now.slice(offset) === before.slice(offset - 1)
  return grewAtCaret ? { key, offset, character: now.charAt(offset - 1) } : null
}
