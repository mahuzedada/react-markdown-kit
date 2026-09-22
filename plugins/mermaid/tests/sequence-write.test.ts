/**
 * The sequence writer (docs/MERMAID_PLATFORM.md sections 4.1 and 4.3): the
 * write order, escaping, retained lines after the participants, activation
 * spelling, `create-destroy` dropped and named in `lossy`, and the fixed
 * point `write(parse(write(m))) === write(m)` with `parse(write(m))` equal
 * to `m` for every corpus file and for models the canvas produces. Whether
 * Mermaid.js accepts the output is `conformance.dom.test.ts`'s job.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { DiagramParse } from '../src/core/kind.js'
import { sequenceDiagram } from '../src/core/sequence/index.js'
import type { Activation, Message, SequenceItem, SequenceModel } from '../src/core/sequence/model.js'
import { LOSSY_CREATE_DESTROY, parseSequenceDiagram } from '../src/core/sequence/parse.js'
import { writeSequenceDiagram } from '../src/core/sequence/write.js'
import { escapeStatementText, escapeText } from '../src/core/text.js'

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), 'corpus', 'sequenceDiagram')

function parse(source: string): DiagramParse<SequenceModel> {
  const parsed = parseSequenceDiagram(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed
}

/** `write(parse(source))` with the parse's retained lines. */
function rewrite(source: string): string {
  const parsed = parse(source)
  return writeSequenceDiagram(parsed.model, { retained: parsed.retained })
}

/** Asserts the 4.1 fixed point for a model: the written text parses to an equal model and writes back byte for byte. */
function expectFixedPoint(model: SequenceModel, retained: DiagramParse<SequenceModel>['retained'] = []): string {
  const written = writeSequenceDiagram(model, { retained })
  const back = parse(written)
  expect(back.model).toEqual(model)
  expect(back.problems.filter((p) => p.severity === 'invalid')).toEqual([])
  expect(writeSequenceDiagram(back.model, { retained: back.retained })).toBe(written)
  return written
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
const model = (partial: Partial<SequenceModel>): SequenceModel => ({ participants: [], boxes: [], items: [], activations: [], ...partial })
const span = (participantId: string, start: number, end: number): Activation => ({ participantId, start, end })

describe('writeSequenceDiagram: order', () => {
  it('is what the kind writes, without a trailing newline', () => {
    const kind = sequenceDiagram()
    const parsed = parse(kind.starter)
    expect(kind.write).toBeDefined()
    expect(kind.write!(parsed.model, { retained: parsed.retained })).toBe(writeSequenceDiagram(parsed.model))
    // The parser declares the participants a message names, so the written starter declares them too.
    expect(kind.write!(parsed.model, { retained: [] })).toBe('sequenceDiagram\n    participant Alice\n    participant Bob\n    Alice->>Bob: Hello Bob\n    Bob-->>Alice: Hi Alice')
    expect(writeSequenceDiagram(parsed.model)).not.toMatch(/\n$/)
  })

  it('writes an empty model as the header alone', () => {
    expect(writeSequenceDiagram(model({}))).toBe('sequenceDiagram')
    expect(parse('sequenceDiagram').model).toEqual(model({}))
  })

  it('writes front matter, header, autonumber, boxes and participants, retained lines, then items depth first', () => {
    const source = [
      '---',
      'config:',
      '  theme: base',
      'title: "Sign in: happy path"',
      '---',
      '%%{init: {"theme": "forest"}}%%',
      'sequenceDiagram',
      '    %% comment',
      '    participant U as User',
      '    box Backend',
      '    participant A as API',
      '    actor D as DB',
      '    end',
      '    link A: Docs @ https://example.com',
      '    autonumber 2 3',
      '    U->>+A: sign in',
      '    alt valid',
      '        A->>D: lookup',
      '        Note over A,D: cached',
      '    else invalid',
      '        A-->>-U: 401',
      '    end',
      '    Note right of U: done',
    ].join('\n')
    expect(rewrite(source)).toBe(
      [
        '---',
        'title: "Sign in: happy path"',
        'config:',
        '  theme: base',
        '---',
        'sequenceDiagram',
        '    autonumber 2 3',
        '    participant U as User',
        '    box Backend',
        '        participant A as API',
        '        actor D as DB',
        '    end',
        '%%{init: {"theme": "forest"}}%%',
        '    %% comment',
        '    link A: Docs @ https://example.com',
        '    U->>+A: sign in',
        '    alt valid',
        '        A->>D: lookup',
        '        Note over A,D: cached',
        '    else invalid',
        '        A-->>-U: 401',
        '    end',
        '    Note right of U: done',
      ].join('\n'),
    )
    const parsed = parse(source)
    expectFixedPoint(parsed.model, parsed.retained)
  })

  it('omits the front matter block when there is no title and no retained front-matter line', () => {
    const body = 'sequenceDiagram\n    participant A\n    participant B\n    A->>B: x'
    expect(rewrite('sequenceDiagram\n    A->>B: x')).toBe(body)
    expect(rewrite('---\ntitle: T\n---\nsequenceDiagram\n    A->>B: x')).toBe(`---\ntitle: "T"\n---\n${body}`)
    expect(rewrite('---\nconfig:\n  theme: base\n---\nsequenceDiagram\n    A->>B: x')).toBe(`---\nconfig:\n  theme: base\n---\n${body}`)
  })

  it('writes a body title statement as front matter, JSON-quoted whatever it holds', () => {
    expect(rewrite('sequenceDiagram\n    title My "flow": [draft]\n    A->>B: x').split('\n')[1]).toBe('title: "My \\"flow\\": [draft]"')
    for (const title of ['a: b', '[draft]', '*', 'C# # x', "it's", '']) expectFixedPoint(model({ title, participants: [participant('A')] }))
  })

  it('writes autonumber in its three forms', () => {
    expect(writeSequenceDiagram(model({ numbering: { start: 1, step: 1 } }))).toBe('sequenceDiagram\n    autonumber')
    expect(writeSequenceDiagram(model({ numbering: { start: 10, step: 1 } }))).toBe('sequenceDiagram\n    autonumber 10')
    expect(writeSequenceDiagram(model({ numbering: { start: 10, step: 5 } }))).toBe('sequenceDiagram\n    autonumber 10 5')
    expect(writeSequenceDiagram(model({ numbering: { start: 1.5, step: 0.25 } }))).toBe('sequenceDiagram\n    autonumber 1.5 0.25')
    for (const numbering of [{ start: 1, step: 1 }, { start: 10, step: 1 }, { start: 10, step: 5 }, { start: 1.5, step: 0.25 }]) {
      expectFixedPoint(model({ numbering, participants: [participant('A'), participant('B')], items: [message('A', 'B', 'x')] }))
    }
  })

  it('falls back to plain autonumber for a start or step Mermaid has no token for', () => {
    expect(writeSequenceDiagram(model({ numbering: { start: -1, step: 1 } }))).toBe('sequenceDiagram\n    autonumber')
    expect(writeSequenceDiagram(model({ numbering: { start: 2, step: 0.125 } }))).toBe('sequenceDiagram\n    autonumber 2')
  })
})

describe('writeSequenceDiagram: participants and boxes', () => {
  it('writes participant or actor with an alias only when the label differs from the id', () => {
    const m = model({ participants: [participant('A'), participant('B', 'Bob'), participant('C', 'C', 'actor'), participant('D', 'Dave', 'actor')] })
    expect(writeSequenceDiagram(m)).toBe('sequenceDiagram\n    participant A\n    participant B as Bob\n    actor C\n    actor D as Dave')
    expectFixedPoint(m)
  })

  it('writes an empty label as the id, which is what the parser reads back', () => {
    expect(writeSequenceDiagram(model({ participants: [participant('A', '')] }))).toBe('sequenceDiagram\n    participant A')
  })

  it('keeps ids with spaces, hyphens and parentheses as they are', () => {
    const m = model({
      participants: [participant('Alice Smith'), participant('api-gw', 'API'), participant('Bob(2)')],
      items: [message('Alice Smith', 'api-gw', 'hi'), message('api-gw', 'Bob(2)', 'yo', { line: 'dotted' })],
    })
    expect(writeSequenceDiagram(m).split('\n').slice(4)).toEqual(['    Alice Smith->>api-gw: hi', '    api-gw-->>Bob(2): yo'])
    expectFixedPoint(m)
  })

  it('opens each box where its first participant sits, so the column order survives', () => {
    const m = model({
      participants: [participant('Z'), participant('A'), participant('B', 'Bob'), participant('Y'), participant('C')],
      boxes: [{ label: 'rgb(33,66,99) Team', participantIds: ['A', 'B'] }, { participantIds: ['C'] }],
    })
    expect(writeSequenceDiagram(m)).toBe(
      ['sequenceDiagram', '    participant Z', '    box rgb(33,66,99) Team', '        participant A', '        participant B as Bob', '    end', '    participant Y', '    box', '        participant C', '    end'].join(
        '\n',
      ),
    )
    expectFixedPoint(m)
  })

  it('writes a participant once, in the first box naming it, and leaves out a box naming nobody known', () => {
    const m = model({
      participants: [participant('A'), participant('B')],
      boxes: [{ label: 'One', participantIds: ['A', 'X'] }, { label: 'Two', participantIds: ['A'] }, { label: 'Three', participantIds: ['Q'] }],
    })
    expect(writeSequenceDiagram(m)).toBe('sequenceDiagram\n    box One\n        participant A\n    end\n    participant B')
  })
})

describe('writeSequenceDiagram: items', () => {
  it('writes every arrow spelling, the activation suffix, and a bare colon for empty text', () => {
    const heads: Message['head'][] = ['none', 'arrow', 'cross', 'open']
    const items: SequenceItem[] = []
    for (const line of ['solid', 'dotted'] as const) for (const head of heads) items.push(message('A', 'B', `${line} ${head}`, { line, head }))
    items.push(message('A', 'B', 'two-way', { bidirectional: true }), message('A', 'B', 'two-way dotted', { bidirectional: true, line: 'dotted' }))
    items.push(message('A', 'B', '', { activate: '+' }), message('B', 'A', '', { activate: '-' }))
    const m = model({ participants: [participant('A'), participant('B')], items, activations: [span('B', 10, 11)] })
    expect(writeSequenceDiagram(m).split('\n').slice(3)).toEqual([
      '    A->B: solid none',
      '    A->>B: solid arrow',
      '    A-xB: solid cross',
      '    A-)B: solid open',
      '    A-->B: dotted none',
      '    A-->>B: dotted arrow',
      '    A--xB: dotted cross',
      '    A--)B: dotted open',
      '    A<<->>B: two-way',
      '    A<<-->>B: two-way dotted',
      '    A->>+B:',
      '    B->>-A:',
    ])
    expectFixedPoint(m)
  })

  it('writes two-way only with an arrow head; another head keeps its one-way spelling', () => {
    expect(writeSequenceDiagram(model({ items: [message('A', 'B', 'x', { bidirectional: true, head: 'cross' })] }))).toContain('A-xB: x')
  })

  it('writes notes in every placement, with two participants only for over', () => {
    const m = model({
      participants: [participant('A'), participant('B')],
      items: [
        { type: 'note', placement: 'left', participantIds: ['A'], text: 'l' },
        { type: 'note', placement: 'right', participantIds: ['B'], text: 'r' },
        { type: 'note', placement: 'over', participantIds: ['A'], text: 'o' },
        { type: 'note', placement: 'over', participantIds: ['A', 'B'], text: '' },
      ],
    })
    expect(writeSequenceDiagram(m).split('\n').slice(3)).toEqual(['    Note left of A: l', '    Note right of B: r', '    Note over A: o', '    Note over A,B:'])
    expectFixedPoint(m)
    expect(writeSequenceDiagram(model({ items: [{ type: 'note', placement: 'left', participantIds: ['A', 'B'], text: 'x' }] }))).toContain('Note left of A: x')
    expect(writeSequenceDiagram(model({ items: [{ type: 'note', placement: 'over', participantIds: [], text: 'x' }] }))).toBe('sequenceDiagram')
  })

  it('writes frames with their sections split by else, and or option, closed by end, nested four spaces per level', () => {
    const source = [
      'sequenceDiagram',
      '    par one',
      '        A->>B: a',
      '    and two',
      '        critical c',
      '            A->>B: b',
      '        option o',
      '            loop',
      '                Note over A: n',
      '            end',
      '        end',
      '    end',
      '    alt yes',
      '        A->>B: c',
      '    else',
      '        A->>B: d',
      '    end',
      '    opt maybe',
      '        break stop',
      '            rect rgb(0, 0, 255)',
      '                A->>B: e',
      '            end',
      '        end',
      '    end',
    ].join('\n')
    const parsed = parse(source)
    expect(parsed.problems).toEqual([])
    expect(rewrite(source)).toBe(source.replace('sequenceDiagram', 'sequenceDiagram\n    participant A\n    participant B'))
    expectFixedPoint(parsed.model)
  })

  it('merges extra sections of a frame kind Mermaid gives one section', () => {
    const m = model({
      items: [{ type: 'frame', kind: 'loop', sections: [{ label: 'l', items: [message('A', 'B', 'x')] }, { label: 'ignored', items: [message('A', 'B', 'y')] }] }],
    })
    expect(writeSequenceDiagram(m).split('\n').slice(1)).toEqual(['    loop l', '        A->>B: x', '        A->>B: y', '    end'])
    expect(writeSequenceDiagram(model({ items: [{ type: 'frame', kind: 'opt', sections: [] }] }))).toBe('sequenceDiagram\n    opt\n    end')
  })
})

describe('writeSequenceDiagram: escaping', () => {
  it('escapes ; and # in text, labels and section labels so the parser reads back the same model', () => {
    const m = model({
      participants: [participant('A', 'x; y #1'), participant('B')],
      boxes: [{ label: 'g; h', participantIds: ['B'] }],
      items: [
        message('A', 'B', 'a; b #35; c % d & e "f" <g>\nnext'),
        { type: 'note', placement: 'over', participantIds: ['A'], text: 'n;' },
        { type: 'frame', kind: 'alt', sections: [{ label: 'l; 1', items: [] }, { label: '#2', items: [] }] },
      ],
    })
    const written = expectFixedPoint(m)
    expect(written.split('\n')).toEqual([
      'sequenceDiagram',
      '    participant A as x#59; y #35;1',
      '    box g#59; h',
      '        participant B',
      '    end',
      '    A->>B: a#59; b #35;35#59; c #37; d #38; e #quot;f#quot; #lt;g#gt;<br/>next',
      '    Note over A: n#59;',
      '    alt l#59; 1',
      '    else #35;2',
      '    end',
    ])
  })

  it('writes leading and trailing whitespace, which the parser trims, as entities', () => {
    const m = model({ participants: [participant('A', ' padded '), participant('B')], items: [message('A', 'B', '  two\t'), message('A', 'B', ' ')] })
    const written = expectFixedPoint(m)
    expect(written).toContain('participant A as #32;padded#32;')
    expect(written).toContain('A->>B: #32;#32;two#9;')
    expect(written).toContain('A->>B: #32;')
  })

  it('escapes the first character of text starting with wrap: or nowrap:, which Mermaid reads as a directive', () => {
    const m = model({
      participants: [participant('A'), participant('B')],
      items: [message('A', 'B', 'wrap: yes'), message('A', 'B', 'Nowrap:no'), { type: 'note', placement: 'over', participantIds: ['A'], text: 'wrap:' }],
    })
    const written = expectFixedPoint(m)
    expect(written).toContain('A->>B: #119;rap: yes')
    expect(written).toContain('A->>B: #78;owrap:no')
    expect(written).toContain('Note over A: #119;rap:')
  })

  it('shares escapeText with the flowchart writer and adds ; for statement text', () => {
    expect(escapeText('a#b&c%d"e<f>g;h\nk')).toBe('a#35;b#38;c#37;d#quot;e#lt;f#gt;g;h<br/>k')
    expect(escapeStatementText('a#b&c%d"e<f>g;h\r\nk')).toBe('a#35;b#38;c#37;d#quot;e#lt;f#gt;g#59;h<br/>k')
    expect(escapeStatementText('#59; #quot;')).toBe('#35;59#59; #35;quot#59;')
  })
})

describe('writeSequenceDiagram: activations', () => {
  const two = [participant('A'), participant('B')]

  it('spells a span by + and - when its messages carry them', () => {
    const m = model({ participants: two, items: [message('A', 'B', 'x', { activate: '+' }), message('B', 'A', 'y', { activate: '-' })], activations: [span('B', 0, 1)] })
    expect(writeSequenceDiagram(m).split('\n').slice(3)).toEqual(['    A->>+B: x', '    B->>-A: y'])
    expectFixedPoint(m)
  })

  it('spells a span the suffixes do not carry as activate and deactivate statements after its items', () => {
    const m = model({ participants: two, items: [message('A', 'B', 'x'), message('B', 'A', 'y'), message('A', 'B', 'z')], activations: [span('B', 0, 1)] })
    expect(writeSequenceDiagram(m).split('\n').slice(3)).toEqual(['    A->>B: x', '    activate B', '    B->>A: y', '    deactivate B', '    A->>B: z'])
    expectFixedPoint(m)
  })

  it('keeps the source spelling of every corpus activation', () => {
    expect(rewrite(readFileSync(join(CORPUS, 'activation.mmd'), 'utf8'))).toBe(
      'sequenceDiagram\n    participant Alice\n    participant John\n    Alice->>John: Hello John, how are you?\n    activate John\n    John-->>Alice: Great!\n    deactivate John',
    )
    expect(rewrite(readFileSync(join(CORPUS, 'activation-stacked.mmd'), 'utf8'))).toBe(
      readFileSync(join(CORPUS, 'activation-stacked.mmd'), 'utf8').replace('sequenceDiagram', 'sequenceDiagram\n    participant Alice\n    participant John').trimEnd(),
    )
  })

  it('mixes suffixes and statements on one participant, longest span opened first', () => {
    const items = [message('A', 'B', 'x', { activate: '+' }), message('B', 'A', 'y', { activate: '-' }), message('A', 'B', 'z')]
    const m = model({ participants: two, items, activations: [span('B', 0, 2), span('B', 0, 1)] })
    expect(writeSequenceDiagram(m).split('\n').slice(3)).toEqual(['    A->>+B: x', '    activate B', '    B->>-A: y', '    A->>B: z', '    deactivate B'])
    expectFixedPoint(m)
  })

  it('writes a span that starts and ends on one item, and adjacent spans, in the order the stack needs', () => {
    const self = model({ participants: two, items: [message('A', 'B', 'x'), message('A', 'B', 'y')], activations: [span('B', 0, 0), span('B', 1, 1)] })
    expect(writeSequenceDiagram(self).split('\n').slice(3)).toEqual(['    A->>B: x', '    activate B', '    deactivate B', '    A->>B: y', '    activate B', '    deactivate B'])
    expectFixedPoint(self)
    const adjacent = model({ participants: two, items: [message('A', 'B', 'x'), message('A', 'B', 'y'), message('A', 'B', 'z')], activations: [span('B', 0, 1), span('B', 1, 2)] })
    expect(writeSequenceDiagram(adjacent).split('\n').slice(3)).toEqual(['    A->>B: x', '    activate B', '    A->>B: y', '    deactivate B', '    activate B', '    A->>B: z', '    deactivate B'])
    expectFixedPoint(adjacent)
    const plusSelf = model({ participants: two, items: [message('A', 'B', 'x', { activate: '+' })], activations: [span('B', 0, 0)] })
    expect(writeSequenceDiagram(plusSelf).split('\n').slice(3)).toEqual(['    A->>+B: x', '    deactivate B'])
    expectFixedPoint(plusSelf)
  })

  it('attaches a span starting or ending at a frame to the frame opener, and one ending inside a section before its divider', () => {
    const frame: SequenceItem = { type: 'frame', kind: 'alt', sections: [{ label: 'a', items: [message('A', 'B', 'x')] }, { label: 'b', items: [message('A', 'B', 'y')] }] }
    // Flat indices: w 0, the frame 1, x 2, y 3, z 4. Spans are listed as the parser sorts them: start, then longest first.
    const m = model({ participants: two, items: [message('A', 'B', 'w'), frame, message('B', 'A', 'z')], activations: [span('B', 0, 4), span('A', 1, 1)] })
    expect(writeSequenceDiagram(m).split('\n').slice(3)).toEqual([
      '    A->>B: w',
      '    activate B',
      '    alt a',
      '        activate A',
      '        deactivate A',
      '        A->>B: x',
      '    else b',
      '        A->>B: y',
      '    end',
      '    B->>A: z',
      '    deactivate B',
    ])
    expectFixedPoint(m)
    const inner = model({ participants: two, items: [frame], activations: [span('B', 1, 1)] })
    // Flat indices: the frame 0, x 1, y 2.
    expect(writeSequenceDiagram(inner).split('\n').slice(3)).toEqual(['    alt a', '        A->>B: x', '        activate B', '        deactivate B', '    else b', '        A->>B: y', '    end'])
    expectFixedPoint(inner)
  })

  it('closes a span the source left open, at the last item, and writes both statements when there are no items', () => {
    const parsed = parse('sequenceDiagram\n    A->>+B: x\n    B->>A: y')
    expect(parsed.problems.map((p) => p.code)).toEqual(['SEQUENCE_DIAGRAM_ACTIVATION_UNCLOSED'])
    const written = expectFixedPoint(parsed.model)
    expect(written.split('\n').slice(3)).toEqual(['    A->>+B: x', '    B->>A: y', '    deactivate B'])
    expect(parse(written).problems).toEqual([])
    const empty = parse('sequenceDiagram\n    activate A\n    deactivate A')
    expect(expectFixedPoint(empty.model)).toBe('sequenceDiagram\n    participant A\n    activate A\n    deactivate A')
  })

  it('drops a - that closes nothing, which Mermaid rejects, and keeps every +', () => {
    const dangling = model({ participants: two, items: [message('B', 'A', 'y', { activate: '-' })] })
    expect(writeSequenceDiagram(dangling)).toBe('sequenceDiagram\n    participant A\n    participant B\n    B->>A: y')
    const extra = model({ participants: two, items: [message('A', 'B', 'x', { activate: '+' })] })
    expect(writeSequenceDiagram(extra)).toContain('A->>+B: x')
    expect(parse(writeSequenceDiagram(extra)).model.activations).toEqual([span('B', 0, 0)])
  })

  it('clamps a span outside the items and skips one that is not a number', () => {
    const m = model({ participants: two, items: [message('A', 'B', 'x')], activations: [span('B', 3, 9), span('B', Number.NaN, 1)] })
    expect(writeSequenceDiagram(m).split('\n').slice(3)).toEqual(['    A->>B: x', '    activate B', '    deactivate B'])
  })
})

describe('writeSequenceDiagram: retained lines', () => {
  it('re-emits every retained body line once, verbatim, after the participants, and front-matter lines inside the block', () => {
    const source = [
      '---',
      'title: T',
      'config:',
      '  theme: base',
      '---',
      'sequenceDiagram %% header comment',
      '    %%{init: {"a": 1}}%%',
      '    actor A',
      '    link A: Docs @ https://example.com',
      '    links A: {"Wiki":"https://example.com/w"}',
      '    properties A: {"class": "x"}',
      '    details A: {"x": 1}',
      '    accTitle: Title',
      '    accDescr {',
      '      multi',
      '    }',
      '    autonumber off',
      '    A->>B: x; %% after',
      '    A-|\\B: half',
      '    A->>B: y',
    ].join('\n')
    const parsed = parse(source)
    const written = writeSequenceDiagram(parsed.model, { retained: parsed.retained })
    expect(written.split('\n')).toEqual([
      '---',
      'title: "T"',
      'config:',
      '  theme: base',
      '---',
      'sequenceDiagram',
      '    actor A',
      '    participant B',
      '%% header comment',
      '    %%{init: {"a": 1}}%%',
      '    link A: Docs @ https://example.com',
      '    links A: {"Wiki":"https://example.com/w"}',
      '    properties A: {"class": "x"}',
      '    details A: {"x": 1}',
      '    accTitle: Title',
      '    accDescr {',
      '      multi',
      '    }',
      '    autonumber off',
      '%% after',
      '    A-|\\B: half',
      '    A->>B: x',
      '    A->>B: y',
    ])
    for (const line of parsed.retained) expect(written.split('\n').filter((l) => l === line.text)).toHaveLength(1)
    expectFixedPoint(parsed.model, parsed.retained)
  })

  it('never depends on the previous source: retained lines are exactly what the options carry', () => {
    const parsed = parse('sequenceDiagram\n    %% gone\n    A->>B: x')
    expect(writeSequenceDiagram(parsed.model)).toBe('sequenceDiagram\n    participant A\n    participant B\n    A->>B: x')
    expect(writeSequenceDiagram(parsed.model, { retained: [{ line: 9, text: '    %% other', place: 'body' }] })).toContain('\n    %% other\n')
  })

  it('drops create and destroy, which the parser names in lossy, so the written source is not lossy', () => {
    const source =
      'sequenceDiagram\n    Alice->>Bob: Hello Bob, how are you ?\n    Bob->>Alice: Fine, thank you. And you?\n    create participant Carl\n    Alice->>Carl: Hi Carl!\n    create actor D as Donald\n    Carl->>D: Hi!\n    destroy Carl\n    Alice-xCarl: We are too many\n    destroy Bob\n    Bob->>Alice: I agree'
    const parsed = parse(source)
    expect(parsed.lossy).toEqual([LOSSY_CREATE_DESTROY])
    expect(LOSSY_CREATE_DESTROY).toBe('create-destroy')
    expect(parsed.retained.map((r) => r.line)).toEqual([4, 6, 8, 10])
    const written = writeSequenceDiagram(parsed.model, { retained: parsed.retained })
    expect(written).toBe(
      [
        'sequenceDiagram',
        '    participant Alice',
        '    participant Bob',
        '    participant Carl',
        '    actor D as Donald',
        '    Alice->>Bob: Hello Bob, how are you ?',
        '    Bob->>Alice: Fine, thank you. And you?',
        '    Alice->>Carl: Hi Carl!',
        '    Carl->>D: Hi!',
        '    Alice-xCarl: We are too many',
        '    Bob->>Alice: I agree',
      ].join('\n'),
    )
    const back = parse(written)
    expect(back.model).toEqual(parsed.model)
    expect(back.lossy).toEqual([])
    expect(back.retained).toEqual([])
  })

  it('drops a create or destroy after a ; on a retained line, and keeps a comment that mentions them', () => {
    const parsed = parse('sequenceDiagram\n    participant A; destroy A\n    %% create or destroy\n    A->>B: x')
    expect(parsed.lossy).toEqual(['create-destroy'])
    expect(writeSequenceDiagram(parsed.model, { retained: parsed.retained })).toBe('sequenceDiagram\n    participant A\n    participant B\n    %% create or destroy\n    A->>B: x')
  })
})

describe('writeSequenceDiagram: corpus fixed point', () => {
  const files = readdirSync(CORPUS)
    .filter((f) => f.endsWith('.mmd'))
    .sort()

  it('has the corpus', () => {
    expect(files.length).toBeGreaterThanOrEqual(30)
  })

  for (const file of files) {
    it(`${file}: write(parse(x)) parses to an equal model, keeps every retained line and is a fixed point`, () => {
      const parsed = parse(readFileSync(join(CORPUS, file), 'utf8'))
      const written = expectFixedPoint(parsed.model, parsed.retained)
      for (const line of parsed.retained) expect(written.split('\n')).toContain(line.text)
      expect(parse(written).lossy).toEqual([])
    })
  }
})
