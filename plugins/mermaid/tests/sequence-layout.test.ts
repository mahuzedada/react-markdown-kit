/**
 * The sequence layout (docs/MERMAID_PLATFORM.md section 8.3): columns in
 * declaration order sized by their label, gaps that grow for the text
 * between them, rows at a fixed pitch, activations and frames placed from
 * the items they cover, and the whole picture shifted to the margin.
 */
import { describe, expect, it } from 'vitest'
import { insertionAt, layoutSequence, rowAt, sectionAt, SEQUENCE_METRICS, type SequenceLayout } from '../src/core/sequence/layout.js'
import type { SequenceModel } from '../src/core/sequence/model.js'
import { parseSequenceDiagram } from '../src/core/sequence/parse.js'

const M = SEQUENCE_METRICS

function layout(source: string): SequenceLayout {
  const parsed = parseSequenceDiagram(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return layoutSequence(parsed.model)
}

function model(source: string): SequenceModel {
  const parsed = parseSequenceDiagram(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.model
}

describe('layoutSequence: columns', () => {
  it('places participants as columns in declaration order, left to right', () => {
    const l = layout('sequenceDiagram\n    participant C\n    participant A\n    B->>A: hi\n')
    expect(l.columns.map((c) => c.participant.id)).toEqual(['C', 'A', 'B'])
    const xs = l.columns.map((c) => c.x)
    expect(xs[0]).toBeLessThan(xs[1]!)
    expect(xs[1]).toBeLessThan(xs[2]!)
    expect(l.columns[0]!.x - l.columns[0]!.width / 2).toBe(M.margin)
  })

  it('gives a column the wider of its label box plus padding and the minimum width', () => {
    const short = layout('sequenceDiagram\n    participant A\n')
    expect(short.columns[0]!.width).toBe(M.columnMinWidth)
    const long = layout('sequenceDiagram\n    participant A as A participant with a very long label\n')
    expect(long.columns[0]!.width).toBeGreaterThan(M.columnMinWidth)
  })

  it('keeps the default gap between columns with short messages', () => {
    const l = layout('sequenceDiagram\n    A->>B: hi\n')
    const [a, b] = l.columns
    expect(b!.x - a!.x).toBe(a!.width / 2 + M.columnGap + b!.width / 2)
  })

  it('widens the gap to fit the widest message between two columns', () => {
    const short = layout('sequenceDiagram\n    A->>B: hi\n')
    const long = layout('sequenceDiagram\n    A->>B: a considerably longer message text between them\n')
    const gap = (l: SequenceLayout): number => l.columns[1]!.x - l.columns[0]!.x
    expect(gap(long)).toBeGreaterThan(gap(short))
    expect(long.messages[0]!.toX - long.messages[0]!.fromX).toBeGreaterThanOrEqual(long.messages[0]!.lines[0]!.length * 15 * 0.6 + 2 * M.textPad)
  })

  it('widens a span across several columns for a message that skips one', () => {
    // 34 characters: wider than two default gaps (300) once padded, and under the wrap width.
    const l = layout('sequenceDiagram\n    participant A\n    participant B\n    participant C\n    A->>C: 0123456789012345678901234567890123\n')
    const [a, b, c] = l.columns
    expect(b!.x - a!.x).toBeGreaterThan(a!.width / 2 + M.columnGap + b!.width / 2)
    expect(c!.x - b!.x).toBeGreaterThan(b!.width / 2 + M.columnGap + c!.width / 2)
  })

  it('mirrors the participant boxes at the bottom of the lifelines', () => {
    const l = layout('sequenceDiagram\n    A->>B: hi\n')
    for (const column of l.columns) {
      expect(column.top).toBe(M.margin)
      expect(column.bottom).toBe(l.lifelineBottom)
      expect(column.height).toBe(M.participantHeight)
    }
    expect(l.lifelineTop).toBe(M.margin + M.participantHeight)
    expect(l.height).toBe(l.lifelineBottom + M.participantHeight + M.margin)
  })

  it('uses the taller header when any participant is an actor', () => {
    const l = layout('sequenceDiagram\n    actor A\n    A->>B: hi\n')
    expect(l.columns.every((c) => c.height === M.actorHeight)).toBe(true)
  })
})

describe('layoutSequence: rows', () => {
  it('gives each message one row at the fixed pitch', () => {
    const l = layout('sequenceDiagram\n    A->>B: one\n    B->>A: two\n    A->>B: three\n')
    const ys = l.messages.map((m) => m.y)
    expect(ys[0]).toBe(l.lifelineTop + M.row)
    expect(ys[1]! - ys[0]!).toBe(M.row)
    expect(ys[2]! - ys[1]!).toBe(M.row)
    expect(l.lifelineBottom).toBe(ys[2]! + M.row)
  })

  it('adds height for a multi-line message text and keeps the text above the line', () => {
    const one = layout('sequenceDiagram\n    A->>B: one\n    B->>A: two\n')
    const two = layout('sequenceDiagram\n    A->>B: one<br/>more\n    B->>A: two\n')
    expect(two.messages[0]!.lines).toEqual(['one', 'more'])
    expect(two.messages[1]!.y - two.messages[0]!.y).toBe(one.messages[1]!.y - one.messages[0]!.y)
    expect(two.messages[0]!.y).toBeGreaterThan(one.messages[0]!.y)
  })

  it('draws a self message as a loop on the right of its lifeline', () => {
    const l = layout('sequenceDiagram\n    A->>A: think\n    A->>B: hi\n')
    const self = l.messages[0]!
    expect(self.self).toBe(true)
    expect(self.fromX).toBe(self.toX)
    expect(l.messages[1]!.y).toBeGreaterThanOrEqual(self.y + M.selfLoopHeight + M.row / 2)
  })

  it('gives a note a row and places it left, right or over its participants', () => {
    const l = layout('sequenceDiagram\n    participant A\n    participant B\n    Note right of A: r\n    Note left of B: l\n    Note over A: o\n    Note over A,B: both\n')
    const [a, b] = l.columns
    const [right, left, over, both] = l.notes
    expect(right!.x).toBe(a!.x + M.noteMargin)
    expect(left!.x + left!.width).toBe(b!.x - M.noteMargin)
    expect(over!.x + over!.width / 2).toBeCloseTo(a!.x)
    expect(both!.x).toBeLessThan(a!.x)
    expect(both!.x + both!.width).toBeGreaterThan(b!.x)
    expect(right!.y).toBeGreaterThan(l.lifelineTop)
    expect(left!.y).toBeGreaterThan(right!.y + right!.height)
  })

  it('keeps a note right of a participant clear of the next participant box', () => {
    const l = layout('sequenceDiagram\n    participant A\n    participant B\n    Note right of A: a note that is quite a bit wider than the gap\n')
    const note = l.notes[0]!
    const b = l.columns[1]!
    expect(note.x + note.width).toBeLessThanOrEqual(b.x - b.width / 2)
  })

  it('shifts the picture right so a note left of the first participant starts at the margin', () => {
    const l = layout('sequenceDiagram\n    participant A\n    Note left of A: a wide note on the far left side\n')
    expect(l.notes[0]!.x).toBe(M.margin)
    expect(l.columns[0]!.x - l.columns[0]!.width / 2).toBeGreaterThan(M.margin)
    expect(l.width).toBeGreaterThanOrEqual(l.columns[0]!.x + l.columns[0]!.width / 2 + M.margin)
  })
})

describe('layoutSequence: activations', () => {
  it('runs a bar from the activating message to the deactivating one, centred on the lifeline', () => {
    const l = layout('sequenceDiagram\n    A->>+B: hi\n    B->>A: working\n    B-->>-A: done\n')
    const [bar] = l.activations
    const b = l.columns[1]!
    expect(bar!.participantId).toBe('B')
    expect(bar!.x + bar!.width / 2).toBe(b.x)
    expect(bar!.y).toBe(l.messages[0]!.y)
    expect(bar!.y + bar!.height).toBe(l.messages[2]!.y)
  })

  it('offsets a nested activation by its depth', () => {
    const l = layout('sequenceDiagram\n    A->>+B: one\n    A->>+B: two\n    B-->>-A: three\n    B-->>-A: four\n')
    const [outer, inner] = l.activations
    expect(outer!.y).toBe(l.messages[0]!.y)
    expect(inner!.y).toBe(l.messages[1]!.y)
    expect(inner!.x).toBe(outer!.x + M.activationWidth / 2)
  })

  it('gives an activation with the same start and end a minimum height', () => {
    const l = layout('sequenceDiagram\n    A->>B: hi\n    activate B\n    deactivate B\n')
    expect(l.activations[0]!.height).toBe(M.row / 2)
  })
})

describe('layoutSequence: frames and boxes', () => {
  it('spans a frame from the leftmost to the rightmost participant it touches, plus padding', () => {
    const l = layout('sequenceDiagram\n    participant A\n    participant B\n    participant C\n    loop x\n        A->>B: hi\n    end\n')
    const frame = l.frames[0]!
    const [a, b] = l.columns
    expect(frame.x).toBe(a!.x - M.framePad)
    expect(frame.x + frame.width).toBe(b!.x + M.framePad)
    expect(frame.y).toBeLessThan(l.messages[0]!.y)
    expect(frame.y + frame.height).toBeGreaterThan(l.messages[0]!.y)
    expect(frame.sections).toEqual([{ label: 'x', y: frame.y }])
  })

  it('splits sections with a divider row and nests frames inside their parent', () => {
    const l = layout('sequenceDiagram\n    alt yes\n        A->>B: one\n    else no\n        loop again\n            B->>A: two\n        end\n    end\n')
    const [alt, loop] = l.frames
    expect(alt!.frame.kind).toBe('alt')
    expect(loop!.frame.kind).toBe('loop')
    expect(alt!.sections.map((s) => s.label)).toEqual(['yes', 'no'])
    expect(alt!.sections[1]!.y).toBeGreaterThan(l.messages[0]!.y)
    expect(alt!.sections[1]!.y).toBeLessThan(loop!.y)
    expect(loop!.x).toBeGreaterThan(alt!.x)
    expect(loop!.x + loop!.width).toBeLessThan(alt!.x + alt!.width)
    expect(loop!.y + loop!.height).toBeLessThan(alt!.y + alt!.height)
  })

  it('spans every column for a frame without content', () => {
    const l = layout('sequenceDiagram\n    participant A\n    participant B\n    opt nothing\n    end\n')
    const frame = l.frames[0]!
    expect(frame.x).toBe(l.columns[0]!.x - M.framePad)
    expect(frame.x + frame.width).toBe(l.columns[1]!.x + M.framePad)
    expect(frame.height).toBeGreaterThan(0)
  })

  it('encloses the participants of a box and reserves a label row above them', () => {
    const l = layout('sequenceDiagram\n    box Team\n    participant A\n    participant B\n    end\n    participant C\n    A->>C: hi\n')
    const box = l.boxes[0]!
    const [a, b, c] = l.columns
    expect(box.label).toBe('Team')
    expect(box.x).toBe(a!.x - a!.width / 2 - M.boxPad)
    expect(box.x + box.width).toBe(b!.x + b!.width / 2 + M.boxPad)
    expect(box.x + box.width).toBeLessThan(c!.x - c!.width / 2)
    expect(a!.top).toBe(M.margin + M.boxPad + M.boxLabelHeight)
    expect(box.y + box.height).toBe(l.lifelineBottom + M.participantHeight + M.boxPad)
  })
})

describe('layoutSequence: numbering and determinism', () => {
  it('numbers messages from the autonumber start by its step, across frames', () => {
    const l = layout('sequenceDiagram\n    autonumber 10 5\n    A->>B: one\n    loop x\n        B->>B: two\n    end\n    B->>A: three\n')
    expect(l.messages.map((m) => m.number)).toEqual([10, 15, 20])
  })

  it('has no numbers without autonumber', () => {
    const l = layout('sequenceDiagram\n    A->>B: one\n')
    expect(l.messages[0]!.number).toBeUndefined()
  })

  it('is a pure function of the model', () => {
    const m = model('sequenceDiagram\n    autonumber\n    A->>+B: one\n    Note over A,B: n\n    alt x\n        B-->>-A: two\n    else y\n        A->>A: three\n    end\n')
    expect(layoutSequence(m)).toEqual(layoutSequence(JSON.parse(JSON.stringify(m)) as SequenceModel))
  })

  it('lays out an empty diagram without participants', () => {
    const l = layout('sequenceDiagram\n')
    expect(l.columns).toEqual([])
    expect(l.width).toBeGreaterThan(0)
    expect(l.height).toBeGreaterThan(0)
  })
})

describe('layoutSequence: sections under a pointer', () => {
  // Flat rows: alt 0, one 1, two 2, loop 3, three 4, four 5; the middle section is empty.
  const source = 'sequenceDiagram\n    alt a\n        A->>B: one\n    else\n    else b\n        B->>A: two\n        loop l\n            A->>B: three\n        end\n    end\n    A->>B: four'

  it('sectionAt finds the innermost section holding y, with the sections above it, and whether y is under its last row', () => {
    const l = layout(source)
    const alt = l.frames[0]!
    const loop = l.frames[1]!
    expect(sectionAt(l, alt.y - 1)).toBeUndefined()
    expect(sectionAt(l, alt.y + alt.height + 1)).toBeUndefined()
    // The tab area of the first section is above its first row.
    expect(sectionAt(l, alt.y + 1)).toEqual({ trail: [{ index: 0, section: 0 }], belowLastRow: false })
    // Between `one` and the first divider: under the last row of section 0.
    expect(sectionAt(l, (l.rows[1]! + alt.sections[1]!.y) / 2)).toEqual({ trail: [{ index: 0, section: 0 }], belowLastRow: true })
    // The empty middle section is under its (missing) last row everywhere.
    expect(sectionAt(l, (alt.sections[1]!.y + alt.sections[2]!.y) / 2)).toEqual({ trail: [{ index: 0, section: 1 }], belowLastRow: true })
    expect(sectionAt(l, alt.sections[1]!.y)).toEqual({ trail: [{ index: 0, section: 1 }], belowLastRow: true })
    // Section 2 above `two`, then inside the nested loop, then the loop's bottom pad, then the alt's bottom pad.
    expect(sectionAt(l, l.rows[2]! - 1)).toEqual({ trail: [{ index: 0, section: 2 }], belowLastRow: false })
    expect(sectionAt(l, loop.y + 1)).toEqual({ trail: [{ index: 0, section: 2 }, { index: 3, section: 0 }], belowLastRow: false })
    expect(sectionAt(l, loop.y + loop.height - 1)).toEqual({ trail: [{ index: 0, section: 2 }, { index: 3, section: 0 }], belowLastRow: true })
    expect(sectionAt(l, loop.y + loop.height + 1)).toEqual({ trail: [{ index: 0, section: 2 }], belowLastRow: true })
    expect(sectionAt(l, alt.y + alt.height)).toEqual({ trail: [{ index: 0, section: 2 }], belowLastRow: true })
  })

  it('insertionAt gives the flat row above a section\'s last row and the end of the section under it', () => {
    const l = layout(source)
    const alt = l.frames[0]!
    const loop = l.frames[1]!
    expect(insertionAt(l, alt.y - 1)).toBe(0)
    expect(insertionAt(l, alt.y + 1)).toBe(1)
    expect(insertionAt(l, (l.rows[1]! + alt.sections[1]!.y) / 2)).toEqual({ trail: [{ index: 0, section: 0 }], position: 1 })
    expect(insertionAt(l, (alt.sections[1]!.y + alt.sections[2]!.y) / 2)).toEqual({ trail: [{ index: 0, section: 1 }], position: 0 })
    expect(insertionAt(l, l.rows[2]! - 1)).toBe(2)
    expect(insertionAt(l, loop.y + 1)).toBe(4)
    expect(insertionAt(l, loop.y + loop.height - 1)).toEqual({ trail: [{ index: 0, section: 2 }, { index: 3, section: 0 }], position: 1 })
    expect(insertionAt(l, loop.y + loop.height + 1)).toEqual({ trail: [{ index: 0, section: 2 }], position: 2 })
    expect(insertionAt(l, alt.y + alt.height + 1)).toBe(5)
    // Where the flat row is used it is `rowAt`, and outside every frame it always is.
    const plain = layout('sequenceDiagram\n    A->>B: one\n    B->>A: two')
    for (const y of [0, plain.rows[0]! - 1, plain.rows[0]!, plain.rows[1]! + 1, plain.height]) expect(insertionAt(plain, y)).toBe(rowAt(plain, y))
    // An empty frame is one section under its last row.
    const empty = layout('sequenceDiagram\n    participant A\n    opt\n    end')
    const frame = empty.frames[0]!
    expect(insertionAt(empty, frame.y + frame.height / 2)).toEqual({ trail: [{ index: 0, section: 0 }], position: 0 })
  })
})
