/**
 * What the sequence canvas can select and edit (docs/MERMAID_PLATFORM.md
 * section 9.5): one participant by column, or one item by flat index. An
 * item selection may carry an anchor, the item a Shift+click range started
 * from, so a frame can wrap a contiguous run of siblings; a frame selection
 * may name the section whose label was clicked, which "Add section" inserts
 * after. Kept apart from the component so the property bar and the canvas
 * share one definition.
 */

export type SequenceSelection =
  | { readonly kind: 'participant'; readonly column: number }
  | { readonly kind: 'item'; readonly index: number; readonly anchor?: number; readonly section?: number }

export type SequenceEditing =
  | { readonly target: 'participant'; readonly column: number }
  | { readonly target: 'item'; readonly index: number }
  | { readonly target: 'section'; readonly index: number; readonly section: number }

/** The flat range a selection with an anchor covers, low to high. */
export function selectionRange(selection: SequenceSelection): readonly [number, number] | undefined {
  if (selection.kind !== 'item') return undefined
  const anchor = selection.anchor ?? selection.index
  return [Math.min(anchor, selection.index), Math.max(anchor, selection.index)]
}
