/**
 * Deterministic layout for a `SequenceModel` (docs/MERMAID_PLATFORM.md
 * section 8.3). Pure: the same model always gives the same geometry, so a
 * sequence diagram needs no layout annotation and server and client agree.
 *
 * Participants are columns in declaration order, sized by their label. The
 * gap between two columns grows until the widest message or note between
 * them fits. Rows go down at a fixed pitch: one per message, note and frame
 * boundary, with extra height only for multi-line text. Frames span what
 * they contain plus a margin per nesting level, so nested frames stay
 * inside their parents. Everything is finally shifted so the leftmost
 * element starts at the margin, which keeps notes left of the first
 * participant and wide frames inside the picture.
 *
 * The layout is also the canvas's hit geometry (docs/MERMAID_PLATFORM.md
 * section 9.5): every message, note and frame carries its flat index, the
 * anchor row of every flat index is listed in `rows`, and the rect helpers
 * at the end give the box a pointer must be in to pick a column, a
 * message, a frame tab or a section, and `insertionAt` turns a pointer
 * into the place a drawn message or note goes, inside the frame section
 * under it. What is edited is what is drawn.
 */
import { FONT_SIZE, LINE_HEIGHT, SMALL_FONT_SIZE } from '../drawing-data.js'
import { textBoxSize, wrapText, type Rect } from '../geometry.js'
import type { Frame, Message, Note, Participant, SequenceItem, SequenceModel } from './model.js'
import { flattenItems } from './model.js'
import type { Insertion, SectionStep } from './operations.js'

export const SEQUENCE_METRICS = {
  /** Space around the whole picture. */
  margin: 24,
  /** Narrowest participant column. */
  columnMinWidth: 100,
  /** Horizontal padding inside a participant box. */
  columnPad: 14,
  /** Height of a participant box; a stick figure adds its own. */
  participantHeight: 48,
  actorHeight: 64,
  /** Default distance between two column edges. */
  columnGap: 50,
  /** Vertical pitch of a row. */
  row: 40,
  /** Horizontal room kept around message text inside a gap. */
  textPad: 12,
  /** Widest a message or note text runs before wrapping. */
  textMaxWidth: 320,
  notePad: 8,
  noteMargin: 10,
  noteMinWidth: 50,
  /** How far a note over two participants reaches past their lifelines. */
  noteOverhang: 20,
  selfLoopWidth: 36,
  selfLoopHeight: 24,
  /** Outset of a frame from what it contains. */
  framePad: 12,
  frameLabelHeight: 22,
  activationWidth: 10,
  boxPad: 8,
  boxLabelHeight: 24,
  numberRadius: 8,
} as const

const LINE_H = FONT_SIZE * LINE_HEIGHT

export interface LayoutColumn {
  readonly participant: Participant
  /** Lifeline x. */
  readonly x: number
  readonly width: number
  /** Top edge of the top participant box. */
  readonly top: number
  /** Top edge of the mirrored bottom box. */
  readonly bottom: number
  readonly height: number
}

export interface LayoutBox {
  readonly label: string | undefined
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface LayoutMessage {
  readonly message: Message
  /** Index into the depth-first flattening of the model's items. */
  readonly index: number
  readonly fromX: number
  readonly toX: number
  /** The line's y; for a self message the top of the loop. */
  readonly y: number
  readonly self: boolean
  readonly lines: readonly string[]
  readonly number: number | undefined
}

export interface LayoutNote {
  readonly note: Note
  /** Index into the depth-first flattening of the model's items. */
  readonly index: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly lines: readonly string[]
}

export interface LayoutSection {
  readonly label: string
  /** Top of the section: the frame's top for the first, the divider's y after. */
  readonly y: number
}

export interface LayoutFrame {
  readonly frame: Frame
  /** Index into the depth-first flattening of the model's items. */
  readonly index: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly sections: readonly LayoutSection[]
}

export interface LayoutActivation {
  readonly participantId: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface SequenceLayout {
  readonly width: number
  readonly height: number
  readonly lifelineTop: number
  readonly lifelineBottom: number
  /**
   * The anchor y of every flat item index, in order: a message's line (or
   * the top of its self loop), a note's centre, a frame's top. Insertion
   * rows and drop targets are read off it.
   */
  readonly rows: readonly number[]
  readonly columns: readonly LayoutColumn[]
  readonly boxes: readonly LayoutBox[]
  readonly messages: readonly LayoutMessage[]
  readonly notes: readonly LayoutNote[]
  readonly frames: readonly LayoutFrame[]
  readonly activations: readonly LayoutActivation[]
}

interface Span {
  readonly from: number
  readonly to: number
  readonly width: number
}

interface Extent {
  min: number
  max: number
}

export function layoutSequence(model: SequenceModel): SequenceLayout {
  const M = SEQUENCE_METRICS
  const columnIndex = new Map(model.participants.map((p, i) => [p.id, i]))
  const col = (id: string): number => columnIndex.get(id) ?? 0
  const widths = model.participants.map((p) => Math.max(M.columnMinWidth, textBoxSize(p.label).w + 2 * M.columnPad))
  const xs = columnPositions(widths, spanRequirements(model, col, widths))

  const hasActor = model.participants.some((p) => p.kind === 'actor')
  const headerHeight = hasActor ? M.actorHeight : M.participantHeight
  const hasBoxLabel = model.boxes.some((b) => b.label !== undefined)
  const top = M.margin + (model.boxes.length === 0 ? 0 : M.boxPad + (hasBoxLabel ? M.boxLabelHeight : 0))
  const lifelineTop = top + headerHeight

  const messages: LayoutMessage[] = []
  const notes: LayoutNote[] = []
  const frames: LayoutFrame[] = []
  const anchors: number[] = []
  let cursor = lifelineTop
  let messageCount = 0
  const numbering = model.numbering

  const place = (items: readonly SequenceItem[], extent: Extent): void => {
    for (const item of items) {
      if (item.type === 'message') {
        const lines = textLines(item.text)
        const extra = Math.max(0, lines.length - 1) * LINE_H
        const fromX = xs[col(item.from)] ?? 0
        const toX = xs[col(item.to)] ?? 0
        const self = item.from === item.to
        const number = numbering === undefined ? undefined : numbering.start + numbering.step * messageCount
        messageCount += 1
        let y: number
        if (self) {
          y = cursor + M.row / 2 + extra
          cursor = y + M.selfLoopHeight
          const textWidth = lines.length === 0 ? 0 : textBoxSize(lines.join('\n')).w
          widen(extent, fromX, fromX + M.selfLoopWidth + M.textPad + textWidth)
        } else {
          y = cursor + M.row + extra
          cursor = y
          widen(extent, Math.min(fromX, toX), Math.max(fromX, toX))
        }
        anchors.push(y)
        messages.push({ message: item, index: anchors.length - 1, fromX, toX, y, self, lines, number })
        continue
      }
      if (item.type === 'note') {
        const lines = textLines(item.text)
        const textWidth = lines.length === 0 ? 0 : textBoxSize(lines.join('\n')).w
        let width = Math.max(M.noteMinWidth, textWidth + 2 * M.notePad)
        const height = Math.max(1, lines.length) * LINE_H + 2 * M.notePad
        const y = cursor + M.row / 2
        cursor = y + height
        const first = xs[col(item.participantIds[0] ?? '')] ?? 0
        let x: number
        if (item.placement === 'left') x = first - M.noteMargin - width
        else if (item.placement === 'right') x = first + M.noteMargin
        else {
          const last = xs[col(item.participantIds[item.participantIds.length - 1] ?? '')] ?? first
          const left = Math.min(first, last)
          const right = Math.max(first, last)
          width = Math.max(width, right - left + 2 * M.noteOverhang)
          x = (left + right) / 2 - width / 2
        }
        anchors.push(y + height / 2)
        widen(extent, x, x + width)
        notes.push({ note: item, index: anchors.length - 1, x, y, width, height, lines })
        continue
      }
      const y = cursor + M.row / 2
      anchors.push(y)
      const index = anchors.length - 1
      cursor = y + (item.kind === 'rect' ? M.row / 2 : M.frameLabelHeight)
      const inner: Extent = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
      const sections: LayoutSection[] = []
      item.sections.forEach((section, i) => {
        if (i > 0) {
          const dividerY = cursor + M.row / 2
          cursor = dividerY + M.row / 2
          sections.push({ label: section.label, y: dividerY })
        } else {
          sections.push({ label: section.label, y })
        }
        place(section.items, inner)
      })
      if (inner.min === Number.POSITIVE_INFINITY) {
        inner.min = xs[0] ?? 0
        inner.max = xs[xs.length - 1] ?? 0
        cursor += M.row / 2
      }
      const bottom = cursor + M.row / 2
      cursor = bottom
      const x = inner.min - M.framePad
      const width = inner.max - inner.min + 2 * M.framePad
      widen(extent, x, x + width)
      frames.push({ frame: item, index, x, y, width, height: bottom - y, sections })
    }
  }

  const body: Extent = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
  place(model.items, body)
  const lifelineBottom = cursor + M.row
  // Outer frames first, so a nested frame draws on top of its parent.
  frames.sort((a, b) => a.y - b.y || b.width - a.width)

  const activations = model.activations.map((activation, index): LayoutActivation => {
    const depth = model.activations.filter(
      (other, i) =>
        i !== index &&
        other.participantId === activation.participantId &&
        other.start <= activation.start &&
        other.end >= activation.end &&
        (other.start < activation.start || other.end > activation.end || i < index),
    ).length
    const x = (xs[col(activation.participantId)] ?? 0) - M.activationWidth / 2 + (depth * M.activationWidth) / 2
    const y = anchors[activation.start] ?? lifelineTop
    const end = anchors[activation.end] ?? y
    return { participantId: activation.participantId, x, y, width: M.activationWidth, height: Math.max(M.row / 2, end - y) }
  })

  const columns = model.participants.map((participant, i): LayoutColumn => ({
    participant,
    x: xs[i] ?? 0,
    width: widths[i] ?? M.columnMinWidth,
    top,
    bottom: lifelineBottom,
    height: headerHeight,
  }))

  const boxes = model.boxes.map((box): LayoutBox => {
    const indices = box.participantIds.map(col)
    const first = Math.min(...indices)
    const last = Math.max(...indices)
    const left = (xs[first] ?? 0) - (widths[first] ?? 0) / 2 - M.boxPad
    const right = (xs[last] ?? 0) + (widths[last] ?? 0) / 2 + M.boxPad
    const y = M.margin
    return { label: box.label, x: left, y, width: right - left, height: lifelineBottom + headerHeight + M.boxPad - y }
  })

  const everything: Extent = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
  for (const c of columns) widen(everything, c.x - c.width / 2, c.x + c.width / 2)
  for (const b of boxes) widen(everything, b.x, b.x + b.width)
  widen(everything, body.min, body.max)
  if (everything.min === Number.POSITIVE_INFINITY) everything.min = everything.max = M.margin
  const shift = M.margin - everything.min

  return {
    width: everything.max + shift + M.margin,
    height: lifelineBottom + headerHeight + (model.boxes.length === 0 ? 0 : M.boxPad) + M.margin,
    lifelineTop,
    lifelineBottom,
    rows: anchors,
    columns: columns.map((c) => ({ ...c, x: c.x + shift })),
    boxes: boxes.map((b) => ({ ...b, x: b.x + shift })),
    messages: messages.map((m) => ({ ...m, fromX: m.fromX + shift, toX: m.toX + shift })),
    notes: notes.map((note) => ({ ...note, x: note.x + shift })),
    frames: frames.map((f) => ({ ...f, x: f.x + shift })),
    activations: activations.map((a) => ({ ...a, x: a.x + shift })),
  }
}

/** Text as drawn: explicit line breaks kept, long lines wrapped. Empty text has no lines. */
export function textLines(value: string): string[] {
  if (value === '') return []
  return wrapText(value, SEQUENCE_METRICS.textMaxWidth, FONT_SIZE)
}

/** Width a frame's label tab needs. */
export function frameTabWidth(label: string): number {
  return textBoxSize(label, SMALL_FONT_SIZE).w + 16
}

/* ---------------------------------------------------------- hit geometry */

/** The top participant box of a column. */
export function columnRect(column: LayoutColumn): Rect {
  return { x: column.x - column.width / 2, y: column.top, w: column.width, h: column.height }
}

/** The mirrored bottom box of a column. */
export function columnBottomRect(column: LayoutColumn): Rect {
  return { x: column.x - column.width / 2, y: column.bottom, w: column.width, h: column.height }
}

/**
 * The boxes a pointer picks a message in: the strip along its line (or
 * around its self loop) and, when it has text, the text's own box. Two
 * boxes rather than their union, so the lifeline gap between two rows
 * stays free beside a message's text and a note can be added there.
 */
export function messageHitRects(message: LayoutMessage, pad = 6): Rect[] {
  const M = SEQUENCE_METRICS
  const textHeight = message.lines.length * LINE_H
  const textWidth = message.lines.length === 0 ? 0 : textBoxSize(message.lines.join('\n')).w
  if (message.self) {
    const loop = { x: message.fromX - pad, y: message.y - pad, w: M.selfLoopWidth + 2 * pad, h: M.selfLoopHeight + 2 * pad }
    if (textHeight === 0) return [loop]
    const textX = message.fromX + M.selfLoopWidth + M.textPad / 2
    return [loop, { x: textX - pad, y: message.y + M.selfLoopHeight / 2 - textHeight / 2 - pad, w: textWidth + 2 * pad, h: textHeight + 2 * pad }]
  }
  const left = Math.min(message.fromX, message.toX)
  const right = Math.max(message.fromX, message.toX)
  const line = { x: left - pad, y: message.y - pad, w: right - left + 2 * pad, h: 2 * pad }
  if (textHeight === 0) return [line]
  const cx = (left + right) / 2
  return [line, { x: cx - textWidth / 2 - pad, y: message.y - 6 - textHeight - pad, w: textWidth + 2 * pad, h: textHeight + 2 * pad }]
}

/** The union of `messageHitRects`, for the selection outline. */
export function messageRect(message: LayoutMessage, pad = 6): Rect {
  const rects = messageHitRects(message, pad)
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.w))
  const bottom = Math.max(...rects.map((r) => r.y + r.h))
  return { x, y, w: right - x, h: bottom - y }
}

export function noteRect(note: LayoutNote): Rect {
  return { x: note.x, y: note.y, w: note.width, h: note.height }
}

export function frameRect(frame: LayoutFrame): Rect {
  return { x: frame.x, y: frame.y, w: frame.width, h: frame.height }
}

/** The label tab at a frame's top left; a `rect` frame, which draws no tab, gets a strip along its top edge. */
export function frameTabRect(frame: LayoutFrame): Rect {
  const M = SEQUENCE_METRICS
  if (frame.frame.kind === 'rect') return { x: frame.x, y: frame.y, w: frame.width, h: M.row / 2 }
  const label = frame.sections[0]?.label ?? ''
  const w = frameTabWidth(frame.frame.kind) + (label === '' ? 0 : textBoxSize(`[${label}]`, SMALL_FONT_SIZE).w + 8)
  return { x: frame.x, y: frame.y, w: Math.min(frame.width, w), h: M.frameLabelHeight }
}

/** The strip along a section's divider where its label sits; the first section's is its frame's tab. */
export function sectionRect(frame: LayoutFrame, section: number): Rect {
  const M = SEQUENCE_METRICS
  const current = frame.sections[section]
  if (current === undefined) return frameRect(frame)
  if (section === 0) return frameTabRect(frame)
  return { x: frame.x, y: current.y - M.row / 4, w: frame.width, h: M.frameLabelHeight }
}

/** The strip along a frame's bottom edge, dragged to extend or shrink it. */
export function frameBottomRect(frame: LayoutFrame, pad = 5): Rect {
  return { x: frame.x, y: frame.y + frame.height - pad, w: frame.width, h: 2 * pad }
}

/** The x of the column nearest a point, as an index into `columns`. */
export function columnAt(layout: SequenceLayout, x: number): number {
  let best = 0
  let distance = Number.POSITIVE_INFINITY
  layout.columns.forEach((column, i) => {
    const d = Math.abs(column.x - x)
    if (d < distance) {
      distance = d
      best = i
    }
  })
  return best
}

/**
 * The flat insertion index for a pointer at `y`: how many rows sit above
 * it, so a new item goes before the row under the pointer and after the
 * last row when the pointer is below every row.
 */
export function rowAt(layout: SequenceLayout, y: number): number {
  return layout.rows.filter((row) => row <= y).length
}

/** The frame sections a pointer is in, from `sectionAt`. */
export interface SectionHit {
  /** The sections down to the pointer, outermost first; the last step is the innermost section. */
  readonly trail: readonly SectionStep[]
  /**
   * True when the pointer is under every row of the innermost section, an
   * empty section included: an item inserted there goes last in it, where
   * the flat row under the pointer would put it in the next section or
   * after the frame.
   */
  readonly belowLastRow: boolean
}

/**
 * The innermost frame section whose vertical extent holds `y`, with the
 * sections above it: a section runs from the frame's top (the first) or
 * its divider to the next divider or the frame's bottom edge, bottom pad
 * included. Undefined outside every frame. Only `y` counts, as for the
 * flat rows: a frame grows to what it holds.
 */
export function sectionAt(layout: SequenceLayout, y: number): SectionHit | undefined {
  const trail: SectionStep[] = []
  let belowLastRow = false
  // Outer frames come first, and frames nest or are vertically disjoint, so the matches are the trail.
  for (const frame of layout.frames) {
    if (y < frame.y || y > frame.y + frame.height) continue
    let section = 0
    frame.sections.forEach((entry, i) => {
      if (entry.y <= y) section = i
    })
    trail.push({ index: frame.index, section })
    belowLastRow = y > lastRowOfSection(layout, frame, section)
  }
  return trail.length === 0 ? undefined : { trail, belowLastRow }
}

/**
 * Where a pointer at `y` inserts, for `addMessage` and `addNote`: the flat
 * row under it, or the end of the frame section it is in when it is under
 * every row of that section, so an empty section and the tail of a middle
 * section can be drawn into.
 */
export function insertionAt(layout: SequenceLayout, y: number): Insertion {
  const hit = sectionAt(layout, y)
  const step = hit?.trail[hit.trail.length - 1]
  if (hit === undefined || step === undefined || !hit.belowLastRow) return rowAt(layout, y)
  const frame = layout.frames.find((entry) => entry.index === step.index)
  return { trail: hit.trail, position: frame?.frame.sections[step.section]?.items.length ?? 0 }
}

/** The anchor y of the last row inside a frame section, nested frames included; negative infinity for an empty section. */
function lastRowOfSection(layout: SequenceLayout, frame: LayoutFrame, section: number): number {
  let base = frame.index + 1
  for (let i = 0; i < section; i += 1) base += flattenItems(frame.frame.sections[i]?.items ?? []).length
  const count = flattenItems(frame.frame.sections[section]?.items ?? []).length
  if (count === 0) return Number.NEGATIVE_INFINITY
  return layout.rows[base + count - 1] ?? Number.NEGATIVE_INFINITY
}

/** True when the point is inside the rect. */
export function within(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

function widen(extent: Extent, min: number, max: number): void {
  extent.min = Math.min(extent.min, min)
  extent.max = Math.max(extent.max, max)
}

/** Every distance two lifelines must keep so the text between them fits. */
function spanRequirements(model: SequenceModel, col: (id: string) => number, widths: readonly number[]): Span[] {
  const M = SEQUENCE_METRICS
  const spans: Span[] = []
  const last = widths.length - 1
  const halfWidth = (i: number): number => (widths[i] ?? 0) / 2
  const walk = (items: readonly SequenceItem[]): void => {
    for (const item of items) {
      if (item.type === 'frame') {
        for (const section of item.sections) walk(section.items)
        continue
      }
      const lines = textLines(item.text)
      const textWidth = lines.length === 0 ? 0 : textBoxSize(lines.join('\n')).w
      if (item.type === 'message') {
        const a = col(item.from)
        const b = col(item.to)
        if (a === b) {
          if (a < last) spans.push({ from: a, to: a + 1, width: M.selfLoopWidth + M.textPad + textWidth + M.textPad })
        } else {
          spans.push({ from: Math.min(a, b), to: Math.max(a, b), width: textWidth + 2 * M.textPad })
        }
        continue
      }
      const a = col(item.participantIds[0] ?? '')
      const noteWidth = Math.max(M.noteMinWidth, textWidth + 2 * M.notePad)
      if (item.placement === 'right' && a < last) {
        spans.push({ from: a, to: a + 1, width: M.noteMargin + noteWidth + halfWidth(a + 1) + M.boxPad })
      } else if (item.placement === 'left' && a > 0) {
        spans.push({ from: a - 1, to: a, width: M.noteMargin + noteWidth + halfWidth(a - 1) + M.boxPad })
      }
    }
  }
  walk(model.items)
  return spans
}

/** Lifeline x per column: default gaps, widened for the requirements, nearest pairs first. */
function columnPositions(widths: readonly number[], requirements: readonly Span[]): number[] {
  const M = SEQUENCE_METRICS
  const gaps: number[] = []
  for (let i = 0; i + 1 < widths.length; i += 1) {
    gaps.push((widths[i] ?? 0) / 2 + M.columnGap + (widths[i + 1] ?? 0) / 2)
  }
  const sorted = [...requirements].sort((a, b) => a.to - a.from - (b.to - b.from))
  for (const span of sorted) {
    let current = 0
    for (let i = span.from; i < span.to; i += 1) current += gaps[i] ?? 0
    if (current >= span.width) continue
    const extra = (span.width - current) / (span.to - span.from)
    for (let i = span.from; i < span.to; i += 1) gaps[i] = (gaps[i] ?? 0) + extra
  }
  const xs: number[] = []
  let x = M.margin + (widths[0] ?? 0) / 2
  widths.forEach((_, i) => {
    xs.push(x)
    x += gaps[i] ?? 0
  })
  return xs
}
