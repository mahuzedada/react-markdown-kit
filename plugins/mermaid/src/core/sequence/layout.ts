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
 */
import { FONT_SIZE, LINE_HEIGHT, SMALL_FONT_SIZE } from '../drawing-data.js'
import { textBoxSize, wrapText } from '../geometry.js'
import type { Frame, Message, Note, Participant, SequenceItem, SequenceModel } from './model.js'

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
        messages.push({ message: item, fromX, toX, y, self, lines, number })
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
        notes.push({ note: item, x, y, width, height, lines })
        continue
      }
      const y = cursor + M.row / 2
      anchors.push(y)
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
      frames.push({ frame: item, x, y, width, height: bottom - y, sections })
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
