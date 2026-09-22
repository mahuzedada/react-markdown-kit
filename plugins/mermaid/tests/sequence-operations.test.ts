/**
 * The pure model operations behind the sequence canvas
 * (docs/MERMAID_PLATFORM.md section 9.5): one per gesture, each leaving the
 * input untouched, returning the same model when nothing changes, carrying
 * activations across by the items they cover, and producing a model the
 * writer and parser round-trip (`parse(write(m)).model` equals `m`).
 */
import { describe, expect, it } from 'vitest'
import type { Frame, Message, SequenceModel } from '../src/core/sequence/model.js'
import { flattenItems } from '../src/core/sequence/model.js'
import { insertionAt, layoutSequence, SEQUENCE_METRICS } from '../src/core/sequence/layout.js'
import {
  addMessage,
  addNote,
  addParticipant,
  addSection,
  areSiblings,
  canDeactivate,
  extendFrame,
  removeItem,
  removeParticipant,
  renameParticipant,
  reorderItem,
  reorderParticipant,
  setActivation,
  setMessageStyle,
  setNotePlacement,
  setNumbering,
  setParticipantKind,
  setSectionLabel,
  setText,
  swapEnds,
  unwrapFrame,
  wrapInFrame,
} from '../src/core/sequence/operations.js'
import { parseSequenceDiagram } from '../src/core/sequence/parse.js'
import { writeSequenceDiagram } from '../src/core/sequence/write.js'

function parse(source: string): SequenceModel {
  const parsed = parseSequenceDiagram(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.model
}

/** The written text of a model, asserting it parses back to the same model and that the input was not mutated. */
function written(model: SequenceModel, before?: { readonly model: SequenceModel; readonly snapshot: string }): string {
  const text = writeSequenceDiagram(model)
  expect(parse(text)).toEqual(model)
  if (before !== undefined) expect(JSON.stringify(before.model)).toBe(before.snapshot)
  return text
}

function snapshot(model: SequenceModel): { readonly model: SequenceModel; readonly snapshot: string } {
  return { model, snapshot: JSON.stringify(model) }
}

const messageOf = (model: SequenceModel, index: number): Message => {
  const item = flattenItems(model.items)[index]
  if (item === undefined || item.type !== 'message') throw new Error(`No message at ${index}.`)
  return item
}
const frameOf = (model: SequenceModel, index: number): Frame => {
  const item = flattenItems(model.items)[index]
  if (item === undefined || item.type !== 'frame') throw new Error(`No frame at ${index}.`)
  return item
}
const lines = (model: SequenceModel): string[] => writeSequenceDiagram(model).split('\n').slice(1).map((line) => line.trim())

const BASIC = 'sequenceDiagram\n    A->>B: one\n    B-->>A: two\n    A->>B: three'

describe('participants', () => {
  it('addParticipant appends a fresh id that is its own label, per kind, and never reuses one', () => {
    const before = snapshot(parse('sequenceDiagram\n    participant Participant1\n    A->>B: x'))
    const first = addParticipant(before.model, 'participant')
    expect(first.id).toBe('Participant2')
    expect(first.model.participants.map((p) => [p.id, p.label, p.kind])).toEqual([
      ['Participant1', 'Participant1', 'participant'],
      ['A', 'A', 'participant'],
      ['B', 'B', 'participant'],
      ['Participant2', 'Participant2', 'participant'],
    ])
    const actor = addParticipant(first.model, 'actor')
    expect(actor.id).toBe('Actor1')
    expect(actor.model.participants[4]).toEqual({ id: 'Actor1', label: 'Actor1', kind: 'actor' })
    expect(written(actor.model, before)).toContain('\n    actor Actor1\n')
  })

  it('addParticipant never makes the keyword ids `Participant` and `Actor`, which a message or note cannot name (S1)', () => {
    const empty = parse('sequenceDiagram')
    const first = addParticipant(empty, 'participant')
    expect(first.id).toBe('Participant1')
    const actor = addParticipant(first.model, 'actor')
    expect(actor.id).toBe('Actor1')
    const sent = addMessage(actor.model, first.id, actor.id, 99).model
    const noted = addNote(sent, actor.id, 99).model
    expect(lines(noted)).toEqual(['participant Participant1', 'actor Actor1', 'Participant1->>Actor1:', 'Note over Actor1:'])
    const reparsed = parseSequenceDiagram(written(noted))
    expect('error' in reparsed ? [] : reparsed.problems).toEqual([])
    // The bare words stay out even when the author declared them, since the series never lands on them.
    const declared = parse('sequenceDiagram\n    participant Participant\n    actor Actor')
    expect(addParticipant(declared, 'participant').id).toBe('Participant1')
    expect(addParticipant(declared, 'actor').id).toBe('Actor1')
  })

  it('renameParticipant sets the label and moves the id with it while the label was the id, rewriting every reference', () => {
    const before = snapshot(parse('sequenceDiagram\n    box Team\n    participant A\n    end\n    A->>+B: x\n    Note over A,B: n\n    B-->>-A: y'))
    const next = renameParticipant(before.model, 'A', 'Auth Service')
    expect(next.participants[0]).toEqual({ id: 'AuthService', label: 'Auth Service', kind: 'participant' })
    expect(next.boxes[0]?.participantIds).toEqual(['AuthService'])
    expect(messageOf(next, 0).from).toBe('AuthService')
    expect(messageOf(next, 2).to).toBe('AuthService')
    expect(flattenItems(next.items)[1]).toMatchObject({ participantIds: ['AuthService', 'B'] })
    expect(next.activations).toEqual([{ participantId: 'B', start: 0, end: 2 }])
    expect(written(next, before)).toBe(
      'sequenceDiagram\n    box Team\n        participant AuthService as Auth Service\n    end\n    AuthService->>+B: x\n    Note over AuthService,B: n\n    B-->>-AuthService: y',
    )
    // Once the label differs from the id, the id stays.
    const again = renameParticipant(next, 'AuthService', 'Auth')
    expect(again.participants[0]).toEqual({ id: 'AuthService', label: 'Auth', kind: 'participant' })
  })

  it('renameParticipant keeps the id when the sanitised label is empty, taken or a keyword, and an empty label falls back to the id', () => {
    const model = parse('sequenceDiagram\n    A->>B: x')
    expect(renameParticipant(model, 'A', '!!!').participants[0]).toEqual({ id: 'A', label: '!!!', kind: 'participant' })
    expect(renameParticipant(model, 'A', 'B').participants[0]).toEqual({ id: 'A', label: 'B', kind: 'participant' })
    expect(renameParticipant(model, 'A', 'end').participants[0]).toEqual({ id: 'A', label: 'end', kind: 'participant' })
    expect(renameParticipant(model, 'A', '  ').participants[0]).toEqual({ id: 'A', label: 'A', kind: 'participant' })
    expect(renameParticipant(model, 'A', 'A')).toBe(model)
    expect(renameParticipant(model, 'Z', 'x')).toBe(model)
    written(renameParticipant(model, 'A', 'end'))
  })

  it('renameParticipant with the follow decision taken once recomputes the id from the whole label at every change (S12)', () => {
    const model = parse('sequenceDiagram\n    participant B\n    participant Participant1\n    Participant1->>B: x')
    const burst = { follow: true, originalId: 'Participant1' }
    const ids = (m: SequenceModel): string[] => m.participants.map((p) => p.id)
    // `B` is taken: the id waits on the original, not on the label.
    const b = renameParticipant(model, 'Participant1', 'B', burst)
    expect(b.participants[1]).toEqual({ id: 'Participant1', label: 'B', kind: 'participant' })
    const bo = renameParticipant(b, 'Participant1', 'Bo', burst)
    expect(bo.participants[1]).toEqual({ id: 'Bo', label: 'Bo', kind: 'participant' })
    expect(messageOf(bo, 0).from).toBe('Bo')
    const bob = renameParticipant(bo, 'Bo', 'Bob', burst)
    expect(bob.participants[1]).toEqual({ id: 'Bob', label: 'Bob', kind: 'participant' })
    expect(written(bob)).toBe('sequenceDiagram\n    participant B\n    Bob->>B: x')
    // Backspacing to a taken label falls back to the original id, never to the last intermediate one.
    const back = renameParticipant(bob, 'Bob', 'B', burst)
    expect(back.participants[1]).toEqual({ id: 'Participant1', label: 'B', kind: 'participant' })
    expect(ids(back)).toEqual(['B', 'Participant1'])
    expect(messageOf(back, 0).from).toBe('Participant1')
    written(back)
    // A keyword intermediate does not stop the id following the label.
    const end = renameParticipant(model, 'Participant1', 'end', burst)
    expect(end.participants[1]).toEqual({ id: 'Participant1', label: 'end', kind: 'participant' })
    const endpoint = renameParticipant(end, 'Participant1', 'endpoint', burst)
    expect(endpoint.participants[1]).toEqual({ id: 'endpoint', label: 'endpoint', kind: 'participant' })
    written(endpoint)
    // Emptying the label restores the original id and label.
    const emptied = renameParticipant(bob, 'Bob', '', burst)
    expect(emptied.participants[1]).toEqual({ id: 'Participant1', label: 'Participant1', kind: 'participant' })
    // `follow: false` keeps the id even when an intermediate label equals it.
    const aliased = parse('sequenceDiagram\n    participant A as Alice')
    const kept = renameParticipant(renameParticipant(aliased, 'A', 'A', { follow: false }), 'A', 'Ab', { follow: false })
    expect(kept.participants[0]).toEqual({ id: 'A', label: 'Ab', kind: 'participant' })
    // Without the option one rename decides from the model, as before.
    expect(renameParticipant(model, 'Participant1', 'Bo').participants[1]?.id).toBe('Bo')
    expect(renameParticipant(aliased, 'A', 'Ab').participants[0]?.id).toBe('A')
  })

  it('reorderParticipant moves a column to the index, keeping a box together and its members in column order', () => {
    const plain = snapshot(parse('sequenceDiagram\n    participant A\n    participant B\n    participant C'))
    expect(reorderParticipant(plain.model, 'A', 2).participants.map((p) => p.id)).toEqual(['B', 'C', 'A'])
    expect(reorderParticipant(plain.model, 'C', 0).participants.map((p) => p.id)).toEqual(['C', 'A', 'B'])
    expect(reorderParticipant(plain.model, 'A', 0)).toBe(plain.model)
    expect(reorderParticipant(plain.model, 'A', 99).participants.map((p) => p.id)).toEqual(['B', 'C', 'A'])
    written(reorderParticipant(plain.model, 'A', 2), plain)

    const boxed = parse('sequenceDiagram\n    participant X\n    box Team\n    participant A\n    participant B\n    end\n    participant Y')
    // A member moved out of its box stays with the box, reordered inside it.
    const inside = reorderParticipant(boxed, 'B', 1)
    expect(inside.participants.map((p) => p.id)).toEqual(['X', 'B', 'A', 'Y'])
    expect(inside.boxes[0]?.participantIds).toEqual(['B', 'A'])
    expect(written(inside)).toBe('sequenceDiagram\n    participant X\n    box Team\n        participant B\n        participant A\n    end\n    participant Y')
    // An outsider dropped between two members lands beside the box.
    const beside = reorderParticipant(boxed, 'Y', 2)
    expect(beside.participants.map((p) => p.id)).toEqual(['X', 'A', 'B', 'Y'])
    const before = reorderParticipant(boxed, 'Y', 1)
    expect(before.participants.map((p) => p.id)).toEqual(['X', 'Y', 'A', 'B'])
    written(before)
  })

  it('reorderParticipant orders the boxes by their first member, as the parser reads them back (S15)', () => {
    const before = snapshot(parse('sequenceDiagram\n    box X\n    participant A\n    end\n    box Y\n    participant B\n    end'))
    const next = reorderParticipant(before.model, 'B', 0)
    expect(next.participants.map((p) => p.id)).toEqual(['B', 'A'])
    expect(next.boxes).toEqual([
      { label: 'Y', participantIds: ['B'] },
      { label: 'X', participantIds: ['A'] },
    ])
    expect(written(next, before)).toBe('sequenceDiagram\n    box Y\n        participant B\n    end\n    box X\n        participant A\n    end')
    const wide = parse('sequenceDiagram\n    box X\n    participant A\n    participant C\n    end\n    box Y\n    participant B\n    end\n    participant D')
    const moved = reorderParticipant(wide, 'D', 0)
    expect(moved.participants.map((p) => p.id)).toEqual(['D', 'A', 'C', 'B'])
    expect(moved.boxes.map((box) => box.label)).toEqual(['X', 'Y'])
    written(moved)
  })

  it('setParticipantKind toggles between participant and actor', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>B: x'))
    const actor = setParticipantKind(before.model, 'A', 'actor')
    expect(actor.participants[0]?.kind).toBe('actor')
    expect(written(actor, before)).toContain('\n    actor A\n')
    expect(setParticipantKind(actor, 'A', 'actor')).toBe(actor)
    expect(setParticipantKind(actor, 'Z', 'actor')).toBe(actor)
  })

  it('removeParticipant takes its messages, notes, bars and box membership with it', () => {
    const before = snapshot(
      parse('sequenceDiagram\n    box Team\n    participant A\n    participant B\n    end\n    A->>+B: one\n    Note over A,B: n\n    B->>+C: two\n    C-->>-B: three\n    B-->>-A: four\n    loop x\n        C->>C: self\n    end'),
    )
    const next = removeParticipant(before.model, 'A')
    expect(next.participants.map((p) => p.id)).toEqual(['B', 'C'])
    expect(next.boxes).toEqual([{ label: 'Team', participantIds: ['B'] }])
    expect(lines(next)).toEqual(['box Team', 'participant B', 'end', 'B->>+C: two', 'C-->>-B: three', 'loop x', 'C->>C: self', 'end'])
    // B's bar started on a message from A, so it went; C's bar is intact on its new rows.
    expect(next.activations).toEqual([{ participantId: 'C', start: 0, end: 1 }])
    written(next, before)
    const gone = removeParticipant(next, 'B')
    expect(gone.boxes).toEqual([])
    expect(gone.participants.map((p) => p.id)).toEqual(['C'])
    expect(lines(gone)).toEqual(['loop x', 'C->>C: self', 'end'])
    expect(removeParticipant(gone, 'Z')).toBe(gone)
  })
})

describe('messages', () => {
  it('addMessage inserts a `->>` message with empty text before the row, or last, and reports its index', () => {
    const before = snapshot(parse(BASIC))
    const middle = addMessage(before.model, 'B', 'A', 1)
    expect(middle.index).toBe(1)
    expect(messageOf(middle.model, 1)).toEqual({ type: 'message', from: 'B', to: 'A', line: 'solid', head: 'arrow', bidirectional: false, text: '' })
    expect(lines(middle.model)).toEqual(['A->>B: one', 'B->>A:', 'B-->>A: two', 'A->>B: three'])
    written(middle.model, before)
    const last = addMessage(before.model, 'A', 'A', 99)
    expect(last.index).toBe(3)
    expect(lines(last.model).at(-1)).toBe('A->>A:')
  })

  it('addMessage before a row inside a frame goes inside it; before the frame row goes before the frame', () => {
    const model = parse('sequenceDiagram\n    A->>B: one\n    loop x\n        B->>A: two\n    end')
    const inside = addMessage(model, 'A', 'B', 2)
    expect(lines(inside.model)).toEqual(['A->>B: one', 'loop x', 'A->>B:', 'B->>A: two', 'end'])
    expect(inside.index).toBe(2)
    const outside = addMessage(model, 'A', 'B', 1)
    expect(lines(outside.model)).toEqual(['A->>B: one', 'A->>B:', 'loop x', 'B->>A: two', 'end'])
  })

  it('addMessage and addNote reach an empty or middle section through a section insertion (S6)', () => {
    const source = 'sequenceDiagram\n    alt a\n        A->>B: one\n    else\n    else b\n        B->>A: two\n    end\n    A->>B: three'
    const before = snapshot(parse(source))
    const M = SEQUENCE_METRICS
    const layout = layoutSequence(before.model)
    const alt = layout.frames[0]!
    // Inside the empty middle section: below its divider, above the next one. The flat row would land in section 2.
    const middleY = (alt.sections[1]!.y + alt.sections[2]!.y) / 2
    const middle = insertionAt(layout, middleY)
    expect(middle).toEqual({ trail: [{ index: 0, section: 1 }], position: 0 })
    const inMiddle = addMessage(before.model, 'A', 'B', middle)
    expect(lines(inMiddle.model)).toEqual(['alt a', 'A->>B: one', 'else', 'A->>B:', 'else b', 'B->>A: two', 'end', 'A->>B: three'])
    expect(inMiddle.index).toBe(2)
    written(inMiddle.model, before)
    const noteInMiddle = addNote(before.model, 'B', middle)
    expect(lines(noteInMiddle.model)[3]).toBe('Note over B:')
    expect(noteInMiddle.index).toBe(2)
    written(noteInMiddle.model, before)
    // Under the last row of the last section but still inside the frame: after `two`, inside the frame, not after it.
    const tailY = layout.rows[2]! + M.row / 4
    const tail = insertionAt(layout, tailY)
    expect(tail).toEqual({ trail: [{ index: 0, section: 2 }], position: 1 })
    const atTail = addMessage(before.model, 'B', 'A', tail)
    expect(lines(atTail.model)).toEqual(['alt a', 'A->>B: one', 'else', 'else b', 'B->>A: two', 'B->>A:', 'end', 'A->>B: three'])
    expect(atTail.index).toBe(3)
    // Above the last row of a section the flat row is used, so the message goes before `one`.
    const headY = layout.rows[1]! - M.row / 4
    expect(insertionAt(layout, headY)).toBe(1)
    expect(lines(addMessage(before.model, 'A', 'B', insertionAt(layout, headY)).model).slice(0, 3)).toEqual(['alt a', 'A->>B:', 'A->>B: one'])
    // Below the frame the flat row is past its items, so the message goes after it.
    const belowY = alt.y + alt.height + M.row / 4
    expect(insertionAt(layout, belowY)).toBe(3)
    expect(lines(addMessage(before.model, 'A', 'B', 3).model).slice(-2)).toEqual(['A->>B:', 'A->>B: three'])
    // An empty first section, and an empty frame.
    const emptyFirst = parse('sequenceDiagram\n    par\n    and\n        A->>B: x\n    end')
    const firstLayout = layoutSequence(emptyFirst)
    const firstY = (firstLayout.frames[0]!.y + firstLayout.frames[0]!.sections[1]!.y) / 2
    const inFirst = addMessage(emptyFirst, 'B', 'A', insertionAt(firstLayout, firstY))
    expect(lines(inFirst.model)).toEqual(['participant A', 'par', 'B->>A:', 'and', 'A->>B: x', 'end'])
    written(inFirst.model)
    const emptyFrame = parse('sequenceDiagram\n    participant A\n    opt\n    end')
    const frameLayout = layoutSequence(emptyFrame)
    const inFrame = addNote(emptyFrame, 'A', insertionAt(frameLayout, frameLayout.frames[0]!.y + M.row))
    expect(lines(inFrame.model)).toEqual(['opt', 'Note over A:', 'end'])
    expect(inFrame.index).toBe(1)
    written(inFrame.model)
    // A position is clamped to the section, and a trail naming no section appends after every item.
    const clamped = addMessage(before.model, 'A', 'B', { trail: [{ index: 0, section: 2 }], position: 99 })
    expect(lines(clamped.model)[5]).toBe('A->>B:')
    expect(lines(addMessage(before.model, 'A', 'B', { trail: [{ index: 1, section: 0 }], position: 0 }).model).at(-1)).toBe('A->>B:')
    expect(lines(addMessage(before.model, 'A', 'B', { trail: [], position: 0 }).model).at(-1)).toBe('A->>B:')
  })

  it('addMessage keeps the bars on the items they covered', () => {
    const model = parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two')
    const next = addMessage(model, 'A', 'B', 0).model
    expect(next.activations).toEqual([{ participantId: 'B', start: 1, end: 2 }])
    written(next)
  })

  it('reorderItem moves an item among its siblings to the row under the pointer', () => {
    const before = snapshot(parse(BASIC))
    const texts = (model: SequenceModel): string[] => flattenItems(model.items).map((item) => (item.type === 'frame' ? item.kind : item.text))
    expect(texts(reorderItem(before.model, 0, 2))).toEqual(['two', 'one', 'three'])
    expect(texts(reorderItem(before.model, 0, 3))).toEqual(['two', 'three', 'one'])
    expect(texts(reorderItem(before.model, 2, 0))).toEqual(['three', 'one', 'two'])
    expect(texts(reorderItem(before.model, 2, 1))).toEqual(['one', 'three', 'two'])
    // The rows around the item itself leave it where it is.
    expect(reorderItem(before.model, 1, 1)).toBe(before.model)
    expect(reorderItem(before.model, 1, 2)).toBe(before.model)
    expect(reorderItem(before.model, 9, 0)).toBe(before.model)
    written(reorderItem(before.model, 0, 3), before)
  })

  it('reorderItem stays in its section and never lands inside a sibling frame', () => {
    const model = parse('sequenceDiagram\n    A->>B: one\n    loop x\n        B->>A: two\n        A->>B: three\n    end\n    B->>A: four')
    // Row 3 is inside the loop: the message goes after the loop, its sibling.
    expect(lines(reorderItem(model, 0, 3))).toEqual(['participant A', 'loop x', 'B->>A: two', 'A->>B: three', 'end', 'A->>B: one', 'B->>A: four'])
    // An item inside the loop moves within the loop only.
    expect(lines(reorderItem(model, 2, 4))).toEqual(['A->>B: one', 'loop x', 'A->>B: three', 'B->>A: two', 'end', 'B->>A: four'])
    expect(lines(reorderItem(model, 3, 0))).toEqual(['A->>B: one', 'loop x', 'A->>B: three', 'B->>A: two', 'end', 'B->>A: four'])
  })

  it('reorderItem keeps a bar on its items and straightens one whose ends crossed', () => {
    const model = parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two\n    A->>B: three')
    const moved = reorderItem(model, 0, 3)
    expect(moved.activations).toEqual([{ participantId: 'B', start: 0, end: 2 }])
    // Neither suffix spells the bar any more, so both are cleared and the bar is written as statements.
    expect(messageOf(moved, 0).activate).toBeUndefined()
    expect(messageOf(moved, 2).activate).toBeUndefined()
    expect(lines(moved)).toEqual(['participant A', 'B-->>A: two', 'activate B', 'A->>B: three', 'A->>B: one', 'deactivate B'])
    written(moved)
    // Moving the `-` reply above its `+` message does the same.
    const replyUp = reorderItem(model, 1, 0)
    expect(replyUp.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(lines(replyUp)).toEqual(['participant A', 'B-->>A: two', 'activate B', 'A->>B: one', 'deactivate B', 'A->>B: three'])
    written(replyUp)
  })

  it('setMessageStyle sets line and head, couples two-way with the arrow head', () => {
    const before = snapshot(parse(BASIC))
    const dotted = setMessageStyle(before.model, 0, { line: 'dotted' })
    expect(lines(dotted)[0]).toBe('A-->>B: one')
    const cross = setMessageStyle(dotted, 0, { head: 'cross' })
    expect(lines(cross)[0]).toBe('A--x B: one'.replace(' ', ''))
    const twoWay = setMessageStyle(cross, 0, { bidirectional: true })
    expect(messageOf(twoWay, 0)).toMatchObject({ head: 'arrow', bidirectional: true, line: 'dotted' })
    expect(lines(twoWay)[0]).toBe('A<<-->>B: one')
    // Another head switches two-way off, since only the arrow head spells it.
    const open = setMessageStyle(twoWay, 0, { head: 'open' })
    expect(messageOf(open, 0)).toMatchObject({ head: 'open', bidirectional: false })
    expect(lines(open)[0]).toBe('A--)B: one')
    for (const model of [dotted, cross, twoWay, open]) written(model, before)
    expect(setMessageStyle(before.model, 5, { line: 'dotted' })).toBe(before.model)
  })

  it('swapEnds swaps from and to, drops the suffix and keeps the bars as statements', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two'))
    const next = swapEnds(before.model, 0)
    expect(messageOf(next, 0)).toEqual({ type: 'message', from: 'B', to: 'A', line: 'solid', head: 'arrow', bidirectional: false, text: 'one' })
    expect(next.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(lines(next)).toEqual(['participant A', 'B->>A: one', 'activate B', 'B-->>-A: two'])
    written(next, before)
  })

  it('setText sets a message or note text and leaves a frame alone', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>B: one\n    Note over A: n\n    loop x\n    end'))
    const next = setText(setText(before.model, 0, 'first; #1'), 1, 'note')
    expect(lines(next)).toEqual(['A->>B: first#59; #35;1', 'Note over A: note', 'loop x', 'end'])
    written(next, before)
    expect(setText(next, 2, 'x')).toBe(next)
    expect(setText(next, 0, 'first; #1')).toBe(next)
  })
})

describe('activations', () => {
  it('setActivation `+` starts a bar on the receiver to its next reply, or to the last row', () => {
    const before = snapshot(parse(BASIC))
    const next = setActivation(before.model, 0, '+')
    expect(messageOf(next, 0).activate).toBe('+')
    expect(next.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(lines(next)).toEqual(['A->>+B: one', 'B-->>A: two', 'deactivate B', 'A->>B: three'])
    written(next, before)
    const noReply = setActivation(before.model, 2, '+')
    expect(noReply.activations).toEqual([{ participantId: 'B', start: 2, end: 2 }])
    written(noReply)
  })

  it('setActivation `-` ends the covering bar on the message, and canDeactivate says when it is offered', () => {
    const model = parse(BASIC)
    expect(canDeactivate(model, 0)).toBe(false)
    expect(canDeactivate(model, 1)).toBe(true)
    expect(setActivation(model, 0, '-')).toBe(model)
    const plus = setActivation(model, 0, '+')
    expect(plus.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    const longer = { ...plus, activations: [{ participantId: 'B', start: 0, end: 2 }] }
    const minus = setActivation(longer, 1, '-')
    expect(minus.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(lines(minus)).toEqual(['A->>+B: one', 'B-->>-A: two', 'A->>B: three'])
    written(minus)
    // Without a covering bar, `-` starts one from the last message to the sender.
    const fromPrevious = setActivation(model, 1, '-')
    expect(fromPrevious.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(lines(fromPrevious)).toEqual(['A->>B: one', 'activate B', 'B-->>-A: two', 'A->>B: three'])
    written(fromPrevious)
  })

  it('setActivation none drops the bar a `+` started and lets the bar a `-` ended run to the last row', () => {
    const model = parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two\n    A->>B: three')
    const noPlus = setActivation(model, 0, undefined)
    expect(messageOf(noPlus, 0).activate).toBeUndefined()
    expect(noPlus.activations).toEqual([])
    const noMinus = setActivation(model, 1, undefined)
    expect(messageOf(noMinus, 1).activate).toBeUndefined()
    expect(noMinus.activations).toEqual([{ participantId: 'B', start: 0, end: 2 }])
    expect(lines(noMinus)).toEqual(['A->>+B: one', 'B-->>A: two', 'A->>B: three', 'deactivate B'])
    written(noMinus)
    expect(setActivation(model, 0, '+')).toBe(model)
  })

  it('setActivation clears the suffix on the other end of a bar it drops or moves (S16)', () => {
    const model = parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two\n    A->>B: three')
    // Clearing the `+` drops the bar; the `-` that ended it closes nothing now and goes too.
    const noPlus = setActivation(model, 0, undefined)
    expect(noPlus.activations).toEqual([])
    expect(messageOf(noPlus, 1).activate).toBeUndefined()
    expect(lines(noPlus)).toEqual(['A->>B: one', 'B-->>A: two', 'A->>B: three'])
    written(noPlus)
    // Changing it to `-` does the same for the old bar.
    const toMinus = setActivation(parse('sequenceDiagram\n    B->>A: zero\n    A->>+B: one\n    B-->>-A: two'), 1, '-')
    expect(toMinus.activations).toEqual([{ participantId: 'A', start: 0, end: 1 }])
    expect(messageOf(toMinus, 2).activate).toBeUndefined()
    written(toMinus)
    // Shortening the sender's covering bar with a `-` clears the later `-` that used to close it.
    const long = parse('sequenceDiagram\n    A->>+B: one\n    B->>A: two\n    B-->>-A: three')
    const shortened = setActivation(long, 1, '-')
    expect(shortened.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(messageOf(shortened, 2).activate).toBeUndefined()
    expect(lines(shortened)).toEqual(['A->>+B: one', 'B->>-A: two', 'B-->>A: three'])
    written(shortened)
  })

  it('setActivation `+` never starts a bar that crosses another bar of the same participant (S16)', () => {
    // The next message from A already starts a bar; ending there would cross it, so the new bar contains it.
    const self = parse('sequenceDiagram\n    A->>A: x\n    A->>+A: y\n    A->>A: z')
    expect(self.activations).toEqual([{ participantId: 'A', start: 1, end: 2 }])
    const next = setActivation(self, 0, '+')
    expect(next.activations).toEqual([
      { participantId: 'A', start: 0, end: 2 },
      { participantId: 'A', start: 1, end: 2 },
    ])
    expect(lines(next)).toEqual(['A->>+A: x', 'A->>+A: y', 'A->>A: z', 'deactivate A', 'deactivate A'])
    written(next)
    // A reply inside a later bar is skipped for the first one past that bar's end.
    const later = parse('sequenceDiagram\n    A->>B: one\n    A->>+B: two\n    B->>A: three\n    B-->>-A: four\n    B->>A: five')
    const outer = setActivation(later, 0, '+')
    expect(outer.activations).toEqual([
      { participantId: 'B', start: 0, end: 3 },
      { participantId: 'B', start: 1, end: 3 },
    ])
    written(outer)
    // Inside a covering bar the new one stays inside it, at the covering bar's end when no reply comes first.
    const covered = parse('sequenceDiagram\n    A->>+B: one\n    A->>B: two\n    B-->>-A: three\n    B->>A: four')
    const inner = setActivation(covered, 1, '+')
    expect(inner.activations).toEqual([
      { participantId: 'B', start: 0, end: 2 },
      { participantId: 'B', start: 1, end: 2 },
    ])
    written(inner)
  })
})

describe('notes', () => {
  it('addNote inserts a note over the participant at the row and reports its index', () => {
    const before = snapshot(parse(BASIC))
    const next = addNote(before.model, 'B', 1)
    expect(next.index).toBe(1)
    expect(flattenItems(next.model.items)[1]).toEqual({ type: 'note', placement: 'over', participantIds: ['B'], text: '' })
    expect(lines(next.model)[1]).toBe('Note over B:')
    written(next.model, before)
  })

  it('setNotePlacement moves a note and adds or removes the second participant of `over`', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>B: x\n    Note over A: n'))
    const left = setNotePlacement(before.model, 1, 'left')
    expect(lines(left)[1]).toBe('Note left of A: n')
    const right = setNotePlacement(left, 1, 'right')
    expect(lines(right)[1]).toBe('Note right of A: n')
    const over = setNotePlacement(right, 1, 'over', 'B')
    expect(lines(over)[1]).toBe('Note over A,B: n')
    const single = setNotePlacement(over, 1, 'over')
    expect(lines(single)[1]).toBe('Note over A: n')
    // A second participant only applies to `over`, and never the first one again.
    expect(setNotePlacement(over, 1, 'left', 'B')).toMatchObject({ items: [expect.anything(), { participantIds: ['A'] }] })
    expect(setNotePlacement(single, 1, 'over', 'A')).toBe(single)
    expect(setNotePlacement(single, 0, 'over')).toBe(single)
    for (const model of [left, right, over, single]) written(model, before)
  })
})

describe('frames', () => {
  it('wrapInFrame wraps a sibling range in a frame with one empty-labelled section, and reports its index', () => {
    const before = snapshot(parse(BASIC))
    const wrapped = wrapInFrame(before.model, 2, 1, 'alt')
    expect(wrapped?.index).toBe(1)
    expect(frameOf(wrapped!.model, 1)).toEqual({ type: 'frame', kind: 'alt', sections: [{ label: '', items: [messageOf(before.model, 1), messageOf(before.model, 2)] }] })
    expect(lines(wrapped!.model)).toEqual(['A->>B: one', 'alt', 'B-->>A: two', 'A->>B: three', 'end'])
    written(wrapped!.model, before)
    const one = wrapInFrame(before.model, 0, 0, 'rect')
    expect(lines(one!.model)).toEqual(['rect', 'A->>B: one', 'end', 'B-->>A: two', 'A->>B: three'])
    written(one!.model)
  })

  it('wrapInFrame refuses items that are not siblings, as areSiblings reports', () => {
    const model = parse('sequenceDiagram\n    A->>B: one\n    loop x\n        B->>A: two\n    end\n    A->>B: three')
    expect(areSiblings(model, 0, 1)).toBe(true)
    expect(areSiblings(model, 0, 2)).toBe(false)
    expect(areSiblings(model, 1, 3)).toBe(true)
    expect(areSiblings(model, 0, 9)).toBe(false)
    expect(wrapInFrame(model, 0, 2, 'loop')).toBeUndefined()
    const nested = wrapInFrame(model, 1, 3, 'opt')
    expect(lines(nested!.model)).toEqual(['A->>B: one', 'opt', 'loop x', 'B->>A: two', 'end', 'A->>B: three', 'end'])
    written(nested!.model)
  })

  it('wrapInFrame keeps bars on their items across the new frame row', () => {
    const model = parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two')
    const wrapped = wrapInFrame(model, 1, 1, 'loop')!.model
    expect(wrapped.activations).toEqual([{ participantId: 'B', start: 0, end: 2 }])
    written(wrapped)
  })

  it('setSectionLabel labels the frame or a divider', () => {
    const before = snapshot(parse('sequenceDiagram\n    alt a\n        A->>B: one\n    else b\n        B->>A: two\n    end'))
    const next = setSectionLabel(setSectionLabel(before.model, 0, 0, 'yes'), 0, 1, 'no')
    expect(lines(next)).toEqual(['alt yes', 'A->>B: one', 'else no', 'B->>A: two', 'end'])
    written(next, before)
    expect(setSectionLabel(next, 0, 1, 'no')).toBe(next)
    expect(setSectionLabel(next, 0, 5, 'x')).toBe(next)
    expect(setSectionLabel(next, 1, 0, 'x')).toBe(next)
  })

  it('addSection adds an empty section after the given one, for alt, par and critical only', () => {
    const before = snapshot(parse('sequenceDiagram\n    alt a\n        A->>B: one\n    else b\n        B->>A: two\n    end\n    loop l\n        A->>B: three\n    end'))
    const next = addSection(before.model, 0, 0)
    expect(frameOf(next, 0).sections.map((section) => section.label)).toEqual(['a', '', 'b'])
    expect(lines(next)).toEqual(['alt a', 'A->>B: one', 'else', 'else b', 'B->>A: two', 'end', 'loop l', 'A->>B: three', 'end'])
    written(next, before)
    expect(addSection(before.model, 3, 0)).toBe(before.model)
    const par = addSection(parse('sequenceDiagram\n    par p\n        A->>B: x\n    end'), 0, 0)
    expect(lines(par)).toEqual(['par p', 'A->>B: x', 'and', 'end'])
    const critical = addSection(parse('sequenceDiagram\n    critical c\n        A->>B: x\n    end'), 0, 5)
    expect(lines(critical)).toEqual(['critical c', 'A->>B: x', 'option', 'end'])
  })

  it('unwrapFrame replaces a frame with the items of its sections, in order, and removeItem on a frame does the same', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>+B: one\n    alt a\n        B-->>-A: two\n    else b\n        A->>B: three\n    end\n    B->>A: four'))
    const next = unwrapFrame(before.model, 1)
    expect(lines(next)).toEqual(['A->>+B: one', 'B-->>-A: two', 'A->>B: three', 'B->>A: four'])
    expect(next.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    written(next, before)
    expect(removeItem(before.model, 1)).toEqual(next)
    expect(unwrapFrame(next, 0)).toBe(next)
  })

  it('extendFrame takes following siblings into the last section, or gives the last items back', () => {
    const before = snapshot(parse('sequenceDiagram\n    alt a\n        A->>B: one\n    else b\n        B->>A: two\n    end\n    A->>B: three\n    B->>A: four'))
    const grown = extendFrame(before.model, 0, 2)
    expect(lines(grown)).toEqual(['alt a', 'A->>B: one', 'else b', 'B->>A: two', 'A->>B: three', 'B->>A: four', 'end'])
    written(grown, before)
    const shrunk = extendFrame(grown, 0, -3)
    expect(lines(shrunk)).toEqual(['alt a', 'A->>B: one', 'else b', 'end', 'B->>A: two', 'A->>B: three', 'B->>A: four'])
    written(shrunk)
    expect(extendFrame(shrunk, 0, -1)).toBe(shrunk)
    expect(extendFrame(grown, 0, 1)).toBe(grown)
    expect(extendFrame(grown, 0, 0)).toBe(grown)
    expect(extendFrame(grown, 3, 1)).toBe(grown)
  })

  it('removeItem removes a message or note; a bar that started on it goes, one that ended on it runs to the last row (S13)', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>+B: one\n    Note over B: n\n    B-->>-A: two'))
    const noNote = removeItem(before.model, 1)
    expect(lines(noNote)).toEqual(['A->>+B: one', 'B-->>-A: two'])
    expect(noNote.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    written(noNote, before)
    // The `-` reply is gone: the bar its `+` started runs to the last row and is closed there, so nothing dangles.
    const noEnd = removeItem(before.model, 2)
    expect(noEnd.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(messageOf(noEnd, 0).activate).toBe('+')
    expect(lines(noEnd)).toEqual(['A->>+B: one', 'Note over B: n', 'deactivate B'])
    const reparsed = parseSequenceDiagram(written(noEnd, before))
    expect('error' in reparsed ? [] : reparsed.problems).toEqual([])
    // The `+` message is gone: the bar goes, and the `-` that ended it is cleared since it would close nothing.
    const noStart = removeItem(before.model, 0)
    expect(noStart.activations).toEqual([])
    expect(messageOf(noStart, 1).activate).toBeUndefined()
    expect(lines(noStart)).toEqual(['participant A', 'Note over B: n', 'B-->>A: two'])
    written(noStart, before)
    // Deleting the last item under an open bar leaves the bar on the row before it.
    const short = removeItem(parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two'), 1)
    expect(short.activations).toEqual([{ participantId: 'B', start: 0, end: 0 }])
    expect(lines(short)).toEqual(['A->>+B: one', 'deactivate B'])
    written(short)
    expect(removeItem(before.model, 7)).toBe(before.model)
  })

  it('unwrapFrame moves a bar anchored on the frame row to the first unwrapped item; an empty frame loses it (S18)', () => {
    const before = snapshot(parse('sequenceDiagram\n    participant A\n    participant B\n    loop x\n    activate B\n        A->>B: one\n        B->>A: two\n    end\n    deactivate B'))
    expect(before.model.activations).toEqual([{ participantId: 'B', start: 0, end: 2 }])
    const next = unwrapFrame(before.model, 0)
    expect(lines(next)).toEqual(['A->>B: one', 'activate B', 'B->>A: two', 'deactivate B'])
    expect(next.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    written(next, before)
    expect(removeItem(before.model, 0)).toEqual(next)
    // A bar ending on the opener row ends on the first unwrapped item.
    const ending = parse('sequenceDiagram\n    A->>+B: zero\n    loop x\n    deactivate B\n        A->>B: one\n    end')
    expect(ending.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    const unwrapped = unwrapFrame(ending, 1)
    expect(unwrapped.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(lines(unwrapped)).toEqual(['A->>+B: zero', 'A->>B: one', 'deactivate B'])
    written(unwrapped)
    // An empty frame has nothing to carry a bar started on it; one ending on it runs to the last row.
    const empty = parse('sequenceDiagram\n    A->>B: zero\n    loop x\n    activate B\n    end\n    A->>B: one\n    deactivate B')
    expect(empty.activations).toEqual([{ participantId: 'B', start: 1, end: 2 }])
    expect(unwrapFrame(empty, 1).activations).toEqual([])
    const emptyEnd = parse('sequenceDiagram\n    A->>+B: zero\n    loop x\n    end\n    deactivate B')
    expect(emptyEnd.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(unwrapFrame(emptyEnd, 1).activations).toEqual([{ participantId: 'B', start: 0, end: 0 }])
    written(unwrapFrame(emptyEnd, 1))
  })

  it('an edit inside or on a frame keeps the bars anchored on that frame and its ancestors (S18)', () => {
    const source =
      'sequenceDiagram\n    participant A\n    participant B\n    loop x\n    activate B\n        alt y\n        activate A\n            A->>B: one\n        end\n    end\n    deactivate B\n    deactivate A'
    const before = snapshot(parse(source))
    const bars = [
      { participantId: 'B', start: 0, end: 2 },
      { participantId: 'A', start: 1, end: 2 },
    ]
    expect(before.model.activations).toEqual(bars)
    expect(setText(before.model, 2, 'z').activations).toEqual(bars)
    written(setText(before.model, 2, 'z'), before)
    expect(setSectionLabel(before.model, 1, 0, 'w').activations).toEqual(bars)
    expect(addSection(before.model, 1, 0).activations).toEqual(bars)
    const added = addMessage(before.model, 'B', 'A', 2)
    expect(added.model.activations).toEqual([
      { participantId: 'B', start: 0, end: 3 },
      { participantId: 'A', start: 1, end: 3 },
    ])
    written(added.model, before)
    const noted = addNote(before.model, 'A', 2)
    expect(noted.model.activations).toEqual(added.model.activations)
    const grown = extendFrame(parse(`${source}\n    A->>B: two`), 0, 1)
    expect(grown.activations).toEqual(bars)
    expect(lines(grown)).toEqual(['participant A', 'loop x', 'activate B', 'alt y', 'activate A', 'A->>B: one', 'deactivate B', 'deactivate A', 'end', 'A->>B: two', 'end'])
    written(grown)
    const innerGrown = extendFrame(parse('sequenceDiagram\n    loop x\n    activate B\n        A->>B: one\n    end\n    deactivate B\n    A->>B: two'), 0, 1)
    expect(innerGrown.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    written(innerGrown)
    const wrapped = wrapInFrame(before.model, 2, 2, 'opt')!
    expect(wrapped.model.activations).toEqual(added.model.activations)
    written(wrapped.model, before)
  })

  it('extendFrame reaches an empty last section and gives its items back from it', () => {
    const before = snapshot(parse('sequenceDiagram\n    alt a\n        A->>B: one\n    else b\n    end\n    A->>B: two\n    B->>A: three'))
    const grown = extendFrame(before.model, 0, 2)
    expect(lines(grown)).toEqual(['alt a', 'A->>B: one', 'else b', 'A->>B: two', 'B->>A: three', 'end'])
    written(grown, before)
    expect(extendFrame(grown, 0, -2)).toEqual(before.model)
    expect(extendFrame(before.model, 0, -1)).toBe(before.model)
  })
})

describe('numbering', () => {
  it('setNumbering turns autonumber on at 1, 1 and off again', () => {
    const before = snapshot(parse(BASIC))
    const on = setNumbering(before.model, true)
    expect(on.numbering).toEqual({ start: 1, step: 1 })
    expect(lines(on)[0]).toBe('autonumber')
    written(on, before)
    expect(setNumbering(on, true)).toBe(on)
    const off = setNumbering(on, false)
    expect(off.numbering).toBeUndefined()
    expect(off).toEqual(before.model)
    expect(setNumbering(off, false)).toBe(off)
  })
})
