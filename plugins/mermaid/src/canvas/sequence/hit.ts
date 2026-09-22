/**
 * Hit testing for the sequence canvas (docs/MERMAID_PLATFORM.md section
 * 9.5), pure over the layout's geometry: what a pointer at a point is on,
 * which row it would insert at, and where the "add note" affordance sits.
 * Front-most things are tried first, in the order the renderer draws them
 * on top of each other: notes and messages over frame chrome over
 * lifelines, and participant boxes before all of them since they overlap
 * nothing.
 */
import type { Rect } from '../../core/geometry.js'
import {
  columnBottomRect,
  columnRect,
  frameBottomRect,
  insertionAt,
  messageHitRects,
  messageRect,
  noteRect,
  sectionRect,
  SEQUENCE_METRICS,
  within,
  type LayoutFrame,
  type SequenceLayout,
} from '../../core/sequence/layout.js'
import { flattenItems } from '../../core/sequence/model.js'
import type { Insertion } from '../../core/sequence/operations.js'

export type Hit =
  | { readonly kind: 'participant'; readonly column: number }
  | { readonly kind: 'message'; readonly index: number }
  | { readonly kind: 'note'; readonly index: number }
  /** A frame's label tab or a section's divider strip. */
  | { readonly kind: 'section'; readonly index: number; readonly section: number }
  /** The strip along a frame's bottom edge. */
  | { readonly kind: 'frame-bottom'; readonly index: number }
  | { readonly kind: 'lifeline'; readonly column: number }

/** How far from a lifeline a pointer still counts as on it. */
export const LIFELINE_REACH = 14

export function hitAt(layout: SequenceLayout, x: number, y: number): Hit | undefined {
  for (let column = 0; column < layout.columns.length; column += 1) {
    const c = layout.columns[column]
    if (c !== undefined && (within(columnRect(c), x, y) || within(columnBottomRect(c), x, y))) return { kind: 'participant', column }
  }
  for (const note of layout.notes) {
    if (within(noteRect(note), x, y)) return { kind: 'note', index: note.index }
  }
  for (const message of layout.messages) {
    if (messageHitRects(message).some((rect) => within(rect, x, y))) return { kind: 'message', index: message.index }
  }
  // Inner frames are laid out after their parents, so the innermost tab wins.
  for (const frame of [...layout.frames].reverse()) {
    const section = sectionAt(frame, x, y)
    if (section !== undefined) return { kind: 'section', index: frame.index, section }
    if (within(frameBottomRect(frame), x, y)) return { kind: 'frame-bottom', index: frame.index }
  }
  const column = lifelineAt(layout, x, y)
  return column === undefined ? undefined : { kind: 'lifeline', column }
}

function sectionAt(frame: LayoutFrame, x: number, y: number): number | undefined {
  for (let section = frame.sections.length - 1; section >= 0; section -= 1) {
    if (within(sectionRect(frame, section), x, y)) return section
  }
  return undefined
}

/** The column whose lifeline runs within reach of the point, between the participant boxes. */
export function lifelineAt(layout: SequenceLayout, x: number, y: number): number | undefined {
  if (y < layout.lifelineTop || y > layout.lifelineBottom) return undefined
  let best: number | undefined
  let distance = LIFELINE_REACH
  layout.columns.forEach((column, i) => {
    const d = Math.abs(column.x - x)
    if (d <= distance) {
      distance = d
      best = i
    }
  })
  return best
}

/** The y an item inserted at flat index `row` would sit at: between the rows around it, or beyond the last. */
export function insertionY(layout: SequenceLayout, row: number): number {
  const M = SEQUENCE_METRICS
  const before = layout.rows[row - 1]
  const after = layout.rows[row]
  if (before !== undefined && after !== undefined) return (before + after) / 2
  if (after !== undefined) return Math.max(layout.lifelineTop, after - M.row / 2)
  if (before !== undefined) return Math.min(layout.lifelineBottom, before + M.row / 2)
  return layout.lifelineTop + M.row / 2
}

/**
 * The y an item inserted at `at` would sit at: `insertionY` for a flat row;
 * for the end of a frame section, between the section's last row and its
 * bottom, or the middle of an empty section.
 */
export function insertionPointY(layout: SequenceLayout, at: Insertion): number {
  if (typeof at === 'number') return insertionY(layout, at)
  const M = SEQUENCE_METRICS
  const step = at.trail[at.trail.length - 1]
  const frame = step === undefined ? undefined : layout.frames.find((f) => f.index === step.index)
  if (step === undefined || frame === undefined) return insertionY(layout, layout.rows.length)
  const section = frame.sections[step.section]
  const top = section === undefined ? frame.y : step.section === 0 ? frame.y + (frame.frame.kind === 'rect' ? M.row / 2 : M.frameLabelHeight) : section.y
  const bottom = frame.sections[step.section + 1]?.y ?? frame.y + frame.height
  const last = lastRowOf(layout, frame, step.section)
  return last === undefined ? (top + bottom) / 2 : (last + bottom) / 2
}

/** The anchor y of the last row inside a frame section, nested frames included; undefined for an empty section. */
function lastRowOf(layout: SequenceLayout, frame: LayoutFrame, section: number): number | undefined {
  let base = frame.index + 1
  for (let i = 0; i < section; i += 1) base += flattenItems(frame.frame.sections[i]?.items ?? []).length
  const count = flattenItems(frame.frame.sections[section]?.items ?? []).length
  return count === 0 ? undefined : layout.rows[base + count - 1]
}

/** True when two insertion points name the same place. */
export function sameInsertion(a: Insertion, b: Insertion): boolean {
  if (typeof a === 'number' || typeof b === 'number') return a === b
  return a.position === b.position && a.trail.length === b.trail.length && a.trail.every((step, i) => step.index === b.trail[i]?.index && step.section === b.trail[i]?.section)
}

/** The rect of the item at a flat index, for the selection outline. */
export function itemRect(layout: SequenceLayout, index: number): Rect | undefined {
  const message = layout.messages.find((m) => m.index === index)
  if (message !== undefined) return messageRect(message)
  const note = layout.notes.find((n) => n.index === index)
  if (note !== undefined) return noteRect(note)
  const frame = layout.frames.find((f) => f.index === index)
  return frame === undefined ? undefined : { x: frame.x, y: frame.y, w: frame.width, h: frame.height }
}

/**
 * The lifeline gap under a hovering pointer, where a note can be added:
 * the column whose lifeline is within reach and where the pointer inserts
 * (the flat row it is in, or the end of the frame section it is under
 * every row of), unless the pointer is on a message or note already.
 */
export function gapAt(layout: SequenceLayout, x: number, y: number): { readonly column: number; readonly at: Insertion } | undefined {
  const hit = hitAt(layout, x, y)
  if (hit !== undefined && hit.kind !== 'lifeline') return undefined
  const column = lifelineAt(layout, x, y)
  if (column === undefined) return undefined
  return { column, at: insertionAt(layout, y) }
}

/** `rowAt` of the layout, kept here so the canvas has one import for pointer geometry. */
export function rowAtY(layout: SequenceLayout, y: number): number {
  return layout.rows.filter((row) => row <= y).length
}
