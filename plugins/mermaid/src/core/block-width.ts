/**
 * Ported from @zuilib/text-editor (MIT). Block width vocabulary (full / text / content) shared by tables and drawings.
 */
/**
 * Horizontal sizing of a block that would otherwise span the editor:
 *
 * - `full` — the container width (the content pane, minus its gutters).
 *   The default; omitted when serialised.
 * - `text` — the text column: the block's edges align with the paragraphs
 *   around it. Only differs from `full` when a text-column cap is set
 *   (the editor's text measure); otherwise the
 *   two are visually identical.
 * - `content` — shrinks to fit what is inside (table columns, drawing
 *   shapes), left-aligned with the text and never wider than the column.
 */
export type BlockWidth = 'full' | 'text' | 'content'

export const BLOCK_WIDTHS: readonly BlockWidth[] = ['full', 'text', 'content']

export function isBlockWidth(value: unknown): value is BlockWidth {
  return typeof value === 'string' && (BLOCK_WIDTHS as readonly string[]).includes(value)
}

/**
 * Width written into the markdown when a new table / drawing is inserted
 * (the `newBlockWidth` option of `mermaid()`). Only affects insertion:
 * existing markdown without a width marker always means `full`.
 */
export type NewBlockWidths = Readonly<{
  table?: BlockWidth
  drawing?: BlockWidth
}>
