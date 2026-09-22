/**
 * Conformance against Mermaid's own documentation examples and against
 * Mermaid.js (docs/MERMAID_PLATFORM.md section 10.2).
 *
 * `tests/corpus/<kind>/*.mmd` holds the examples verbatim, one directory
 * per kind named after the kind. For every file the kind's `parse` returns
 * a model with no `invalid` problem, and for kinds with `write` the written
 * source parses to an equal model and contains every retained line. Then
 * Mermaid.js itself (the root devDependency, never a package dependency)
 * must accept every file and every `write` output, which is what makes the
 * problem severities and the written output trustworthy.
 *
 * The sequence writer has two more inputs the corpus cannot carry: the
 * `create`/`destroy` documentation example, which the writer drops by
 * design (so its retained lines are not all kept), and models the canvas
 * produces that no documentation example spells (empty text, bare frame
 * labels, activation statements, whitespace and `wrap:` entities). Both
 * are written and handed to Mermaid.js here.
 *
 * This file runs under jsdom by its `.dom.test` name. Mermaid 11 imports
 * and parses under jsdom with no setup: `mermaid.parse` only lexes and
 * parses, it touches no DOM, so no `initialize` call is needed. The test
 * never skips: a corpus directory that names no kind, an empty directory
 * or an import failure is a failure.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mermaid from 'mermaid'
import { describe, expect, it } from 'vitest'
import { defaultKinds } from '../src/core/kinds.js'
import type { DiagramKind, DiagramParse } from '../src/core/kind.js'
import { sequenceDiagram } from '../src/core/sequence/index.js'
import type { Message, SequenceModel } from '../src/core/sequence/model.js'

// A path from the module URL string: under jsdom `new URL()` is jsdom's class, which Node's fileURLToPath rejects.
const CORPUS = join(dirname(fileURLToPath(import.meta.url)), 'corpus')

const kinds = defaultKinds()
const directories = readdirSync(CORPUS)
  .filter((name) => statSync(join(CORPUS, name)).isDirectory())
  .sort()

function parsed(kind: DiagramKind, source: string): DiagramParse<unknown> {
  const result = kind.parse(source)
  if ('error' in result) throw new Error(`${kind.name} parse error: ${result.error}`)
  return result
}

describe('corpus', () => {
  it('has one directory per kind with examples in it', () => {
    expect(directories.length).toBeGreaterThan(0)
    for (const directory of directories) {
      expect(kinds.map((k) => k.name), `corpus/${directory} names no registered kind`).toContain(directory)
      expect(readdirSync(join(CORPUS, directory)).filter((f) => f.endsWith('.mmd')).length, `corpus/${directory} is empty`).toBeGreaterThan(0)
    }
  })

  for (const directory of directories) {
    const kind = kinds.find((k) => k.name === directory)
    if (kind === undefined) continue
    const files = readdirSync(join(CORPUS, directory))
      .filter((f) => f.endsWith('.mmd'))
      .sort()

    describe(kind.name, () => {
      for (const file of files) {
        const source = readFileSync(join(CORPUS, directory, file), 'utf8')

        it(`${file}: parses with no invalid problem`, () => {
          const result = parsed(kind, source)
          expect(result.problems.filter((p) => p.severity === 'invalid')).toEqual([])
        })

        if (kind.write !== undefined) {
          it(`${file}: write(parse(x)) parses to the same model and keeps every retained line`, () => {
            const first = parsed(kind, source)
            const written = kind.write!(first.model, { retained: first.retained })
            const second = parsed(kind, written)
            expect(second.model).toEqual(first.model)
            for (const line of first.retained) expect(written).toContain(line.text)
            expect(kind.write!(second.model, { retained: second.retained })).toBe(written)
          })
        }

        it(`${file}: Mermaid.js accepts it`, async () => {
          await expect(mermaid.parse(source, { suppressErrors: false })).resolves.toBeTruthy()
        })

        if (kind.write !== undefined) {
          it(`${file}: Mermaid.js accepts the written output`, async () => {
            const first = parsed(kind, source)
            const written = kind.write!(first.model, { retained: first.retained })
            await expect(mermaid.parse(written, { suppressErrors: false })).resolves.toBeTruthy()
          })
        }
      }
    })
  }
})

const accepts = (text: string): Promise<unknown> => mermaid.parse(text, { suppressErrors: false })

describe('sequenceDiagram writer against Mermaid.js', () => {
  const kind = sequenceDiagram()
  const parsed = (source: string): DiagramParse<SequenceModel> => {
    const result = kind.parse(source)
    if ('error' in result) throw new Error(result.error)
    return result
  }
  const message = (from: string, to: string, text: string, extra: Partial<Message> = {}): Message => ({
    type: 'message',
    from,
    to,
    line: 'solid',
    head: 'arrow',
    bidirectional: false,
    text,
    ...extra,
  })
  const participant = (id: string, label = id, kind: 'participant' | 'actor' = 'participant') => ({ id, label, kind })
  const two = [participant('A'), participant('B')]

  it('create and destroy: Mermaid.js accepts the documentation example and the written output, which drops them and is no longer lossy', async () => {
    const source =
      'sequenceDiagram\n    Alice->>Bob: Hello Bob, how are you ?\n    Bob->>Alice: Fine, thank you. And you?\n    create participant Carl\n    Alice->>Carl: Hi Carl!\n    create actor D as Donald\n    Carl->>D: Hi!\n    destroy Carl\n    Alice-xCarl: We are too many\n    destroy Bob\n    Bob->>Alice: I agree'
    await expect(accepts(source)).resolves.toBeTruthy()
    const first = parsed(source)
    expect(first.lossy).toEqual(['create-destroy'])
    expect(first.problems.filter((p) => p.severity === 'invalid')).toEqual([])
    const written = kind.write!(first.model, { retained: first.retained })
    await expect(accepts(written)).resolves.toBeTruthy()
    expect(written).not.toMatch(/create|destroy/)
    const second = parsed(written)
    expect(second.model).toEqual(first.model)
    expect(second.lossy).toEqual([])
    expect(kind.write!(second.model, { retained: second.retained })).toBe(written)
  })

  /** Models the canvas produces, with the source no documentation example spells; each is a fixed point Mermaid.js accepts. */
  const canvasModels: Record<string, SequenceModel> = {
    'empty text and bare labels': {
      participants: two,
      boxes: [{ participantIds: ['B'] }],
      items: [
        message('A', 'B', ''),
        { type: 'note', placement: 'over', participantIds: ['A', 'B'], text: '' },
        { type: 'frame', kind: 'loop', sections: [{ label: '', items: [message('A', 'B', 'x')] }] },
        { type: 'frame', kind: 'alt', sections: [{ label: '', items: [] }, { label: '', items: [message('B', 'A', 'y')] }] },
        { type: 'frame', kind: 'par', sections: [{ label: '', items: [] }, { label: '', items: [] }] },
        { type: 'frame', kind: 'critical', sections: [{ label: '', items: [] }, { label: '', items: [] }] },
        { type: 'frame', kind: 'opt', sections: [{ label: '', items: [] }] },
        { type: 'frame', kind: 'break', sections: [{ label: '', items: [] }] },
        { type: 'frame', kind: 'rect', sections: [{ label: '', items: [] }] },
      ],
      activations: [],
    },
    'activation statements, self spans and a span across a frame': {
      participants: two,
      boxes: [],
      items: [message('A', 'B', 'w'), { type: 'frame', kind: 'opt', sections: [{ label: 'o', items: [message('A', 'B', 'x')] }] }, message('B', 'A', 'z')],
      activations: [
        { participantId: 'B', start: 0, end: 3 },
        { participantId: 'B', start: 0, end: 0 },
        { participantId: 'A', start: 1, end: 1 },
        { participantId: 'B', start: 2, end: 2 },
      ],
    },
    'suffixes mixed with statements': {
      participants: two,
      boxes: [],
      items: [message('A', 'B', 'x', { activate: '+' }), message('B', 'A', 'y', { activate: '-' }), message('A', 'B', 'z')],
      activations: [
        { participantId: 'B', start: 0, end: 2 },
        { participantId: 'B', start: 0, end: 1 },
      ],
    },
    'activation with no items': { participants: [participant('A')], boxes: [], items: [], activations: [{ participantId: 'A', start: 0, end: 0 }] },
    'entities for whitespace, wrap and every escaped character': {
      title: 'a: "b" #c',
      participants: [participant('A', ' A; #1 100% <b> "q" & r '), participant('B', 'B', 'actor')],
      boxes: [{ label: ' g; h ', participantIds: ['A'] }],
      items: [
        message('A', 'B', 'wrap: yes'),
        message('A', 'B', 'nowrap:no', { line: 'dotted', head: 'open' }),
        message('A', 'B', '  padded\t'),
        message('A', 'B', 'a; b #35; c % d & e "f" <g>\nnext', { head: 'cross' }),
        { type: 'note', placement: 'left', participantIds: ['A'], text: ' n; ' },
        { type: 'frame', kind: 'alt', sections: [{ label: ' l; ', items: [] }, { label: '#2 ', items: [] }] },
      ],
      activations: [],
      numbering: { start: 10, step: 5 },
    },
    'every arrow with the activation suffix': {
      participants: two,
      boxes: [],
      items: [
        message('A', 'B', 'a', { activate: '+' }),
        message('B', 'A', 'b', { activate: '-', line: 'dotted' }),
        message('A', 'B', 'c', { activate: '+', head: 'none' }),
        message('B', 'A', 'd', { activate: '-', head: 'none', line: 'dotted' }),
        message('A', 'B', 'e', { activate: '+', head: 'cross' }),
        message('B', 'A', 'f', { activate: '-', head: 'cross', line: 'dotted' }),
        message('A', 'B', 'g', { activate: '+', head: 'open' }),
        message('B', 'A', 'h', { activate: '-', head: 'open', line: 'dotted' }),
        message('A', 'B', 'i', { activate: '+', bidirectional: true }),
        message('B', 'A', 'j', { activate: '-', bidirectional: true, line: 'dotted' }),
        message('A', 'A', 'k', { activate: '+' }),
        message('A', 'A', 'l', { activate: '-' }),
      ],
      activations: [
        { participantId: 'B', start: 0, end: 1 },
        { participantId: 'B', start: 2, end: 3 },
        { participantId: 'B', start: 4, end: 5 },
        { participantId: 'B', start: 6, end: 7 },
        { participantId: 'B', start: 8, end: 9 },
        { participantId: 'A', start: 10, end: 11 },
      ],
    },
  }

  for (const [name, model] of Object.entries(canvasModels)) {
    it(`${name}: Mermaid.js accepts the written output, which is a fixed point`, async () => {
      const written = kind.write!(model, { retained: [] })
      await expect(accepts(written)).resolves.toBeTruthy()
      const back = parsed(written)
      expect(back.model).toEqual(model)
      expect(back.problems.filter((p) => p.severity === 'invalid')).toEqual([])
      expect(kind.write!(back.model, { retained: back.retained })).toBe(written)
    })
  }

  /** Models the canvas must not produce but the writer still repairs: Mermaid.js accepts the output even though it cannot equal the model. */
  const repairedModels: Record<string, SequenceModel> = {
    'a - that closes nothing is dropped': { participants: two, boxes: [], items: [message('B', 'A', 'y', { activate: '-' })], activations: [] },
    'a + without a listed span still opens': { participants: two, boxes: [], items: [message('A', 'B', 'x', { activate: '+' })], activations: [] },
    'a span outside the items is clamped': { participants: two, boxes: [], items: [message('A', 'B', 'x')], activations: [{ participantId: 'B', start: 5, end: 9 }] },
    'extra sections of a loop are merged': {
      participants: two,
      boxes: [],
      items: [{ type: 'frame', kind: 'loop', sections: [{ label: 'l', items: [message('A', 'B', 'x')] }, { label: 'm', items: [message('A', 'B', 'y')] }] }],
      activations: [],
    },
  }

  for (const [name, model] of Object.entries(repairedModels)) {
    it(`${name}: Mermaid.js accepts the written output`, async () => {
      const written = kind.write!(model, { retained: [] })
      await expect(accepts(written)).resolves.toBeTruthy()
      expect(parsed(written).problems.filter((p) => p.severity === 'invalid')).toEqual([])
    })
  }
})
