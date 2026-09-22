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
    const before = snapshot(parse('sequenceDiagram\n    participant Participant\n    A->>B: x'))
    const first = addParticipant(before.model, 'participant')
    expect(first.id).toBe('Participant2')
    expect(first.model.participants.map((p) => [p.id, p.label, p.kind])).toEqual([
      ['Participant', 'Participant', 'participant'],
      ['A', 'A', 'participant'],
      ['B', 'B', 'participant'],
      ['Participant2', 'Participant2', 'participant'],
    ])
    const actor = addParticipant(first.model, 'actor')
    expect(actor.id).toBe('Actor')
    expect(actor.model.participants[4]).toEqual({ id: 'Actor', label: 'Actor', kind: 'actor' })
    expect(written(actor.model, before)).toContain('\n    actor Actor\n')
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
      'sequenceDiagram\n    box Team\n        participant AuthService as Auth Service\n    end\n    participant B\n    AuthService->>+B: x\n    Note over AuthService,B: n\n    B-->>-AuthService: y',
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
    expect(lines(next)).toEqual(['box Team', 'participant B', 'end', 'participant C', 'B->>+C: two', 'C-->>-B: three', 'loop x', 'C->>C: self', 'end'])
    // B's bar started on a message from A, so it went; C's bar is intact on its new rows.
    expect(next.activations).toEqual([{ participantId: 'C', start: 0, end: 1 }])
    written(next, before)
    const gone = removeParticipant(next, 'B')
    expect(gone.boxes).toEqual([])
    expect(gone.participants.map((p) => p.id)).toEqual(['C'])
    expect(lines(gone)).toEqual(['participant C', 'loop x', 'C->>C: self', 'end'])
    expect(removeParticipant(gone, 'Z')).toBe(gone)
  })
})

describe('messages', () => {
  it('addMessage inserts a `->>` message with empty text before the row, or last, and reports its index', () => {
    const before = snapshot(parse(BASIC))
    const middle = addMessage(before.model, 'B', 'A', 1)
    expect(middle.index).toBe(1)
    expect(messageOf(middle.model, 1)).toEqual({ type: 'message', from: 'B', to: 'A', line: 'solid', head: 'arrow', bidirectional: false, text: '' })
    expect(lines(middle.model)).toEqual(['participant A', 'participant B', 'A->>B: one', 'B->>A:', 'B-->>A: two', 'A->>B: three'])
    written(middle.model, before)
    const last = addMessage(before.model, 'A', 'A', 99)
    expect(last.index).toBe(3)
    expect(lines(last.model).at(-1)).toBe('A->>A:')
  })

  it('addMessage before a row inside a frame goes inside it; before the frame row goes before the frame', () => {
    const model = parse('sequenceDiagram\n    A->>B: one\n    loop x\n        B->>A: two\n    end')
    const inside = addMessage(model, 'A', 'B', 2)
    expect(lines(inside.model)).toEqual(['participant A', 'participant B', 'A->>B: one', 'loop x', 'A->>B:', 'B->>A: two', 'end'])
    expect(inside.index).toBe(2)
    const outside = addMessage(model, 'A', 'B', 1)
    expect(lines(outside.model)).toEqual(['participant A', 'participant B', 'A->>B: one', 'A->>B:', 'loop x', 'B->>A: two', 'end'])
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
    expect(lines(reorderItem(model, 0, 3))).toEqual(['participant A', 'participant B', 'loop x', 'B->>A: two', 'A->>B: three', 'end', 'A->>B: one', 'B->>A: four'])
    // An item inside the loop moves within the loop only.
    expect(lines(reorderItem(model, 2, 4))).toEqual(['participant A', 'participant B', 'A->>B: one', 'loop x', 'A->>B: three', 'B->>A: two', 'end', 'B->>A: four'])
    expect(lines(reorderItem(model, 3, 0))).toEqual(['participant A', 'participant B', 'A->>B: one', 'loop x', 'A->>B: three', 'B->>A: two', 'end', 'B->>A: four'])
  })

  it('reorderItem keeps a bar on its items and straightens one whose ends crossed', () => {
    const model = parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two\n    A->>B: three')
    const moved = reorderItem(model, 0, 3)
    expect(moved.activations).toEqual([{ participantId: 'B', start: 0, end: 2 }])
    // The `-` now closes nothing, so the writer spells the bar with statements and drops it.
    expect(lines(moved)).toEqual(['participant A', 'participant B', 'B-->>A: two', 'activate B', 'A->>B: three', 'A->>+B: one', 'deactivate B'])
  })

  it('setMessageStyle sets line and head, couples two-way with the arrow head', () => {
    const before = snapshot(parse(BASIC))
    const dotted = setMessageStyle(before.model, 0, { line: 'dotted' })
    expect(lines(dotted)[2]).toBe('A-->>B: one')
    const cross = setMessageStyle(dotted, 0, { head: 'cross' })
    expect(lines(cross)[2]).toBe('A--x B: one'.replace(' ', ''))
    const twoWay = setMessageStyle(cross, 0, { bidirectional: true })
    expect(messageOf(twoWay, 0)).toMatchObject({ head: 'arrow', bidirectional: true, line: 'dotted' })
    expect(lines(twoWay)[2]).toBe('A<<-->>B: one')
    // Another head switches two-way off, since only the arrow head spells it.
    const open = setMessageStyle(twoWay, 0, { head: 'open' })
    expect(messageOf(open, 0)).toMatchObject({ head: 'open', bidirectional: false })
    expect(lines(open)[2]).toBe('A--)B: one')
    for (const model of [dotted, cross, twoWay, open]) written(model, before)
    expect(setMessageStyle(before.model, 5, { line: 'dotted' })).toBe(before.model)
  })

  it('swapEnds swaps from and to, drops the suffix and keeps the bars as statements', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two'))
    const next = swapEnds(before.model, 0)
    expect(messageOf(next, 0)).toEqual({ type: 'message', from: 'B', to: 'A', line: 'solid', head: 'arrow', bidirectional: false, text: 'one' })
    expect(next.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(lines(next)).toEqual(['participant A', 'participant B', 'B->>A: one', 'activate B', 'B-->>-A: two'])
    written(next, before)
  })

  it('setText sets a message or note text and leaves a frame alone', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>B: one\n    Note over A: n\n    loop x\n    end'))
    const next = setText(setText(before.model, 0, 'first; #1'), 1, 'note')
    expect(lines(next)).toEqual(['participant A', 'participant B', 'A->>B: first#59; #35;1', 'Note over A: note', 'loop x', 'end'])
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
    expect(lines(next)).toEqual(['participant A', 'participant B', 'A->>+B: one', 'B-->>A: two', 'deactivate B', 'A->>B: three'])
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
    expect(lines(minus)).toEqual(['participant A', 'participant B', 'A->>+B: one', 'B-->>-A: two', 'A->>B: three'])
    written(minus)
    // Without a covering bar, `-` starts one from the last message to the sender.
    const fromPrevious = setActivation(model, 1, '-')
    expect(fromPrevious.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(lines(fromPrevious)).toEqual(['participant A', 'participant B', 'A->>B: one', 'activate B', 'B-->>-A: two', 'A->>B: three'])
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
    expect(lines(noMinus)).toEqual(['participant A', 'participant B', 'A->>+B: one', 'B-->>A: two', 'A->>B: three', 'deactivate B'])
    written(noMinus)
    expect(setActivation(model, 0, '+')).toBe(model)
  })
})

describe('notes', () => {
  it('addNote inserts a note over the participant at the row and reports its index', () => {
    const before = snapshot(parse(BASIC))
    const next = addNote(before.model, 'B', 1)
    expect(next.index).toBe(1)
    expect(flattenItems(next.model.items)[1]).toEqual({ type: 'note', placement: 'over', participantIds: ['B'], text: '' })
    expect(lines(next.model)[3]).toBe('Note over B:')
    written(next.model, before)
  })

  it('setNotePlacement moves a note and adds or removes the second participant of `over`', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>B: x\n    Note over A: n'))
    const left = setNotePlacement(before.model, 1, 'left')
    expect(lines(left)[3]).toBe('Note left of A: n')
    const right = setNotePlacement(left, 1, 'right')
    expect(lines(right)[3]).toBe('Note right of A: n')
    const over = setNotePlacement(right, 1, 'over', 'B')
    expect(lines(over)[3]).toBe('Note over A,B: n')
    const single = setNotePlacement(over, 1, 'over')
    expect(lines(single)[3]).toBe('Note over A: n')
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
    expect(lines(wrapped!.model)).toEqual(['participant A', 'participant B', 'A->>B: one', 'alt', 'B-->>A: two', 'A->>B: three', 'end'])
    written(wrapped!.model, before)
    const one = wrapInFrame(before.model, 0, 0, 'rect')
    expect(lines(one!.model)).toEqual(['participant A', 'participant B', 'rect', 'A->>B: one', 'end', 'B-->>A: two', 'A->>B: three'])
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
    expect(lines(nested!.model)).toEqual(['participant A', 'participant B', 'A->>B: one', 'opt', 'loop x', 'B->>A: two', 'end', 'A->>B: three', 'end'])
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
    expect(lines(next)).toEqual(['participant A', 'participant B', 'alt yes', 'A->>B: one', 'else no', 'B->>A: two', 'end'])
    written(next, before)
    expect(setSectionLabel(next, 0, 1, 'no')).toBe(next)
    expect(setSectionLabel(next, 0, 5, 'x')).toBe(next)
    expect(setSectionLabel(next, 1, 0, 'x')).toBe(next)
  })

  it('addSection adds an empty section after the given one, for alt, par and critical only', () => {
    const before = snapshot(parse('sequenceDiagram\n    alt a\n        A->>B: one\n    else b\n        B->>A: two\n    end\n    loop l\n        A->>B: three\n    end'))
    const next = addSection(before.model, 0, 0)
    expect(frameOf(next, 0).sections.map((section) => section.label)).toEqual(['a', '', 'b'])
    expect(lines(next)).toEqual(['participant A', 'participant B', 'alt a', 'A->>B: one', 'else', 'else b', 'B->>A: two', 'end', 'loop l', 'A->>B: three', 'end'])
    written(next, before)
    expect(addSection(before.model, 3, 0)).toBe(before.model)
    const par = addSection(parse('sequenceDiagram\n    par p\n        A->>B: x\n    end'), 0, 0)
    expect(lines(par)).toEqual(['participant A', 'participant B', 'par p', 'A->>B: x', 'and', 'end'])
    const critical = addSection(parse('sequenceDiagram\n    critical c\n        A->>B: x\n    end'), 0, 5)
    expect(lines(critical)).toEqual(['participant A', 'participant B', 'critical c', 'A->>B: x', 'option', 'end'])
  })

  it('unwrapFrame replaces a frame with the items of its sections, in order, and removeItem on a frame does the same', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>+B: one\n    alt a\n        B-->>-A: two\n    else b\n        A->>B: three\n    end\n    B->>A: four'))
    const next = unwrapFrame(before.model, 1)
    expect(lines(next)).toEqual(['participant A', 'participant B', 'A->>+B: one', 'B-->>-A: two', 'A->>B: three', 'B->>A: four'])
    expect(next.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    written(next, before)
    expect(removeItem(before.model, 1)).toEqual(next)
    expect(unwrapFrame(next, 0)).toBe(next)
  })

  it('extendFrame takes following siblings into the last section, or gives the last items back', () => {
    const before = snapshot(parse('sequenceDiagram\n    alt a\n        A->>B: one\n    else b\n        B->>A: two\n    end\n    A->>B: three\n    B->>A: four'))
    const grown = extendFrame(before.model, 0, 2)
    expect(lines(grown)).toEqual(['participant A', 'participant B', 'alt a', 'A->>B: one', 'else b', 'B->>A: two', 'A->>B: three', 'B->>A: four', 'end'])
    written(grown, before)
    const shrunk = extendFrame(grown, 0, -3)
    expect(lines(shrunk)).toEqual(['participant A', 'participant B', 'alt a', 'A->>B: one', 'else b', 'end', 'B->>A: two', 'A->>B: three', 'B->>A: four'])
    written(shrunk)
    expect(extendFrame(shrunk, 0, -1)).toBe(shrunk)
    expect(extendFrame(grown, 0, 1)).toBe(grown)
    expect(extendFrame(grown, 0, 0)).toBe(grown)
    expect(extendFrame(grown, 3, 1)).toBe(grown)
  })

  it('removeItem removes a message or note and the bars that started or ended on it', () => {
    const before = snapshot(parse('sequenceDiagram\n    A->>+B: one\n    Note over B: n\n    B-->>-A: two'))
    const noNote = removeItem(before.model, 1)
    expect(lines(noNote)).toEqual(['participant A', 'participant B', 'A->>+B: one', 'B-->>-A: two'])
    expect(noNote.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    written(noNote, before)
    const noStart = removeItem(before.model, 0)
    expect(noStart.activations).toEqual([])
    expect(removeItem(before.model, 7)).toBe(before.model)
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
