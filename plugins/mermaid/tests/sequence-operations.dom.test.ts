/**
 * The models the sequence operations produce, handed to Mermaid.js
 * (docs/MERMAID_PLATFORM.md section 4.1: the written output MUST be
 * accepted by Mermaid.js). Each case is a review repro: a canvas-made
 * participant named in a message and a note, a bar left open by a deleted
 * reply, a bar started next to another bar of the same participant, and a
 * bar that lost the suffix on one end. Runs under jsdom by its `.dom.test`
 * name, like `conformance.dom.test.ts`; Mermaid 11 parses with no setup.
 */
import mermaid from 'mermaid'
import { describe, expect, it } from 'vitest'
import type { SequenceModel } from '../src/core/sequence/model.js'
import { addMessage, addNote, addParticipant, removeItem, reorderItem, setActivation } from '../src/core/sequence/operations.js'
import { parseSequenceDiagram } from '../src/core/sequence/parse.js'
import { writeSequenceDiagram } from '../src/core/sequence/write.js'

function parse(source: string): SequenceModel {
  const parsed = parseSequenceDiagram(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.model
}

/** The written text, which Mermaid.js must accept and which must parse back to the same model with no problem. */
async function accepted(model: SequenceModel): Promise<string> {
  const written = writeSequenceDiagram(model)
  await expect(mermaid.parse(written, { suppressErrors: false }), written).resolves.toBeTruthy()
  const reparsed = parseSequenceDiagram(written)
  if ('error' in reparsed) throw new Error(reparsed.error)
  expect(reparsed.model).toEqual(model)
  expect(reparsed.problems).toEqual([])
  return written
}

describe('sequence operations against Mermaid.js', () => {
  it('a canvas-made participant and actor can be named in a message and a note (S1)', async () => {
    const participant = addParticipant(parse('sequenceDiagram'), 'participant')
    const actor = addParticipant(participant.model, 'actor')
    const sent = addMessage(actor.model, participant.id, actor.id, 99).model
    const replied = addMessage(sent, actor.id, participant.id, 99).model
    const noted = addNote(replied, actor.id, 99).model
    const written = await accepted(noted)
    expect(written).toBe('sequenceDiagram\n    participant Participant1\n    actor Actor1\n    Participant1->>Actor1:\n    Actor1->>Participant1:\n    Note over Actor1:')
    // The bare keywords are what Mermaid.js rejects, which is why the series skips them.
    await expect(mermaid.parse('sequenceDiagram\n    participant Participant\n    Participant->>B: x', { suppressErrors: false })).rejects.toThrow()
    await expect(mermaid.parse('sequenceDiagram\n    actor Actor\n    Note over Actor: x', { suppressErrors: false })).rejects.toThrow()
  })

  it('deleting the `-` reply of a `+` message leaves no dangling bar (S13)', async () => {
    const model = parse('sequenceDiagram\n    A->>+B: one\n    Note over B: n\n    B-->>-A: two')
    await accepted(removeItem(model, 2))
    await accepted(removeItem(model, 0))
    await accepted(removeItem(parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two'), 1))
  })

  it('setActivation never spells two bars that cross, and clears the suffix of a bar it dropped (S16)', async () => {
    await accepted(setActivation(parse('sequenceDiagram\n    A->>A: x\n    A->>+A: y\n    A->>A: z'), 0, '+'))
    await accepted(setActivation(parse('sequenceDiagram\n    A->>B: one\n    A->>+B: two\n    B->>A: three\n    B-->>-A: four\n    B->>A: five'), 0, '+'))
    await accepted(setActivation(parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two\n    A->>B: three'), 0, undefined))
    await accepted(setActivation(parse('sequenceDiagram\n    A->>+B: one\n    B->>A: two\n    B-->>-A: three'), 1, '-'))
  })

  it('reordering a `+` message below its `-` reply writes one bar (S9, operations half)', async () => {
    const model = parse('sequenceDiagram\n    A->>+B: one\n    B-->>-A: two\n    A->>B: three')
    await accepted(reorderItem(model, 0, 3))
    await accepted(reorderItem(model, 1, 0))
  })
})
