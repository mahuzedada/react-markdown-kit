/**
 * Mermaid `sequenceDiagram` in, `SequenceModel` out (docs/MERMAID_PLATFORM.md
 * section 8.2): every construct of the subset, `;` splitting, retained
 * lines, every problem code with its line, activation balance, nested
 * frames, and an outline of the model for every corpus file so a parser
 * change that alters what the docs examples mean is caught here.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { DiagramParse } from '../src/core/kind.js'
import { sequenceDiagram } from '../src/core/sequence/index.js'
import type { SequenceItem, SequenceModel } from '../src/core/sequence/model.js'
import { flattenItems } from '../src/core/sequence/model.js'
import { parseSequenceDiagram, SEQUENCE_PROBLEM_CODES } from '../src/core/sequence/parse.js'

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), 'corpus', 'sequenceDiagram')

/** C29: one message for every residue after a `;`, naming the entity codes for `;`, `&`, `<`, `>`. */
const SEMICOLON_HINT = 'This statement is not sequence diagram syntax; ";" ends a statement, so write #59; for a semicolon in text and #38;, #lt;, #gt; instead of &amp;, &lt;, &gt;.'

function parse(source: string): DiagramParse<SequenceModel> {
  const parsed = parseSequenceDiagram(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed
}

const model = (source: string): SequenceModel => parse(source).model
const problems = (source: string): string[] => parse(source).problems.map((p) => `${p.code}@${p.line}`)
const invalid = (source: string): string[] => parse(source).problems.filter((p) => p.severity === 'invalid').map((p) => `${p.code}@${p.line}`)
const messages = (source: string): string[] => flattenItems(model(source).items).map(describeItem)

const ARROW: Record<string, string> = {
  'solid|none|false': '->',
  'dotted|none|false': '-->',
  'solid|arrow|false': '->>',
  'dotted|arrow|false': '-->>',
  'solid|arrow|true': '<<->>',
  'dotted|arrow|true': '<<-->>',
  'solid|cross|false': '-x',
  'dotted|cross|false': '--x',
  'solid|open|false': '-)',
  'dotted|open|false': '--)',
}

function describeItem(item: SequenceItem): string {
  if (item.type === 'message') {
    return `${item.from}${ARROW[`${item.line}|${item.head}|${item.bidirectional}`]}${item.activate ?? ''}${item.to}: ${item.text}`
  }
  if (item.type === 'note') return `note ${item.placement} ${item.participantIds.join(',')}: ${item.text}`
  return `${item.kind} ${item.sections.map((s) => s.label).join(' | ')}`
}

/** A readable, order-preserving outline of a model: one line per fact. */
function outline(m: SequenceModel): string[] {
  const out: string[] = []
  if (m.title !== undefined) out.push(`title ${m.title}`)
  if (m.numbering) out.push(`autonumber ${m.numbering.start} ${m.numbering.step}`)
  for (const p of m.participants) out.push(`${p.kind} ${p.id}${p.label === p.id ? '' : ` as ${p.label}`}`)
  for (const b of m.boxes) out.push(`box ${b.label ?? ''}: ${b.participantIds.join(',')}`)
  const walk = (items: SequenceItem[], indent: string): void => {
    for (const item of items) {
      if (item.type === 'frame') {
        item.sections.forEach((s, i) => {
          out.push(`${indent}${i === 0 ? item.kind : 'section'} ${s.label}`)
          walk(s.items, `${indent}  `)
        })
      } else {
        out.push(`${indent}${describeItem(item)}`)
      }
    }
  }
  walk(m.items, '')
  for (const a of m.activations) out.push(`activation ${a.participantId} ${a.start}-${a.end}`)
  return out
}

describe('parseSequenceDiagram: header and errors', () => {
  it('is what the kind parses', () => {
    const kind = sequenceDiagram()
    expect(kind.name).toBe('sequenceDiagram')
    expect(kind.keywords).toEqual(['sequenceDiagram'])
    expect(kind.write).toBeDefined()
    expect(kind.parse('sequenceDiagram\n    A->>B: hi')).toEqual(parseSequenceDiagram('sequenceDiagram\n    A->>B: hi'))
    expect(kind.parse(kind.starter)).toMatchObject({ problems: [], retained: [] })
    expect(kind.starter.split('\n')).toHaveLength(3)
    expect(kind.icon).toMatch(/^M/)
  })

  it('errors, never throws, when the first statement is not the header', () => {
    expect(parseSequenceDiagram('flowchart LR\n    A --> B')).toEqual({ error: 'Not a sequence diagram: expected "sequenceDiagram", got "flowchart LR".', line: 1 })
    expect(parseSequenceDiagram('%% c\n\nsequencediagram\n  A->>B: x')).toMatchObject({ error: expect.stringContaining('got "sequencediagram"'), line: 3 })
    expect(parseSequenceDiagram('')).toEqual({ error: 'Not a sequence diagram: the block is empty.' })
    expect(parseSequenceDiagram('%% only a comment\n')).toEqual({ error: 'Not a sequence diagram: the block is empty.' })
  })

  it('accepts the header after front matter, directives, comments and blank lines, and with a trailing ;', () => {
    expect(model('---\ntitle: T\n---\n%%{init: {"theme": "base"}}%%\n%% c\n\nsequenceDiagram;\n    A->>B: hi').title).toBe('T')
    expect(messages('sequenceDiagram;\n    A->>B: hi')).toEqual(['A->>B: hi'])
  })

  it('reads an empty diagram as an empty model', () => {
    expect(parse('sequenceDiagram')).toEqual({ model: { participants: [], boxes: [], items: [], activations: [] }, problems: [], retained: [], lossy: [] })
    expect(sequenceDiagram().parse('sequenceDiagram')).toMatchObject({ lossy: [] })
  })
})

describe('parseSequenceDiagram: participants', () => {
  it('declares participants and actors, in order, with aliases as labels', () => {
    expect(model('sequenceDiagram\n    participant B\n    actor A as Alice\n    PARTICIPANT C as "Carl"').participants).toEqual([
      { id: 'B', label: 'B', kind: 'participant' },
      { id: 'A', label: 'Alice', kind: 'actor' },
      { id: 'C', label: '"Carl"', kind: 'participant' },
    ])
  })

  it('appends undeclared ids on first use, in order of appearance', () => {
    expect(model('sequenceDiagram\n    participant B\n    A->>B: hi\n    Note over C: n\n    activate D\n    deactivate D').participants.map((p) => p.id)).toEqual(['B', 'A', 'C', 'D'])
  })

  it('lets a later declaration set the kind and label of a participant already used', () => {
    expect(model('sequenceDiagram\n    A->>B: hi\n    actor B as Bob').participants).toEqual([
      { id: 'A', label: 'A', kind: 'participant' },
      { id: 'B', label: 'Bob', kind: 'actor' },
    ])
  })

  it('reads ids with spaces and hyphens, and decodes label entities and line breaks', () => {
    const m = model('sequenceDiagram\n    participant Alice Smith\n    participant api-gw as API<br/>Gateway #quot;v2#quot;\n    Alice Smith->>api-gw: hi\n    api-gw-->>Alice Smith: yo')
    expect(m.participants).toEqual([
      { id: 'Alice Smith', label: 'Alice Smith', kind: 'participant' },
      { id: 'api-gw', label: 'API\nGateway "v2"', kind: 'participant' },
    ])
    expect(messages('sequenceDiagram\n    participant Alice Smith\n    participant api-gw\n    Alice Smith->>api-gw: hi\n    api-gw-->>Alice Smith: yo')).toEqual(['Alice Smith->>api-gw: hi', 'api-gw-->>Alice Smith: yo'])
  })

  it('keeps a participant with @{ } config, reports it ignored and retains the line', () => {
    const p = parse('sequenceDiagram\n    participant A@{ "type": "boundary" }\n    A->>B: hi')
    expect(p.model.participants[0]).toEqual({ id: 'A', label: 'A', kind: 'participant' })
    expect(p.problems).toEqual([{ code: 'SEQUENCE_DIAGRAM_STATEMENT_IGNORED', severity: 'ignored', message: 'The "@{ }" participant config is not drawn.', line: 2 }])
    expect(p.retained).toEqual([{ line: 2, text: '    participant A@{ "type": "boundary" }', place: 'body' }])
  })

  it('rejects a participant id Mermaid rejects', () => {
    expect(invalid('sequenceDiagram\n    participant A<b\n    participant\n    participant x:y')).toEqual([
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2',
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3',
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@4',
    ])
  })

  it('groups participants in boxes, keeping the colour in the label as Mermaid does', () => {
    const m = model('sequenceDiagram\n    box rgb(33,66,99) Team A\n    participant A\n    actor B as Bob\n    end\n    box\n    participant C\n    end\n    A->>C: hi')
    expect(m.boxes).toEqual([{ label: 'rgb(33,66,99) Team A', participantIds: ['A', 'B'] }, { participantIds: ['C'] }])
    expect(m.participants.map((p) => p.id)).toEqual(['A', 'B', 'C'])
  })

  it('rejects anything but participants inside a box, as Mermaid does', () => {
    const p = parse('sequenceDiagram\n    box G\n    participant A\n    A->>B: hi\n    end\n    A->>B: yo')
    expect(p.problems).toEqual([{ code: 'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT', severity: 'invalid', message: 'This statement is not sequence diagram syntax.', line: 4 }])
    expect(p.model.boxes).toEqual([{ label: 'G', participantIds: ['A'] }])
    expect(messages('sequenceDiagram\n    box G\n    participant A\n    A->>B: hi\n    end\n    A->>B: yo')).toEqual(['A->>B: yo'])
  })
})

describe('parseSequenceDiagram: messages', () => {
  it('reads every arrow spelling', () => {
    const source = 'sequenceDiagram\n    A->B: a\n    A-->B: b\n    A->>B: c\n    A-->>B: d\n    A<<->>B: e\n    A<<-->>B: f\n    A-xB: g\n    A--xB: h\n    A-)B: i\n    A--)B: j'
    expect(messages(source)).toEqual(['A->B: a', 'A-->B: b', 'A->>B: c', 'A-->>B: d', 'A<<->>B: e', 'A<<-->>B: f', 'A-xB: g', 'A--xB: h', 'A-)B: i', 'A--)B: j'])
    expect(model(source).items.map((i) => (i.type === 'message' ? [i.line, i.head, i.bidirectional] : []))).toEqual([
      ['solid', 'none', false],
      ['dotted', 'none', false],
      ['solid', 'arrow', false],
      ['dotted', 'arrow', false],
      ['solid', 'arrow', true],
      ['dotted', 'arrow', true],
      ['solid', 'cross', false],
      ['dotted', 'cross', false],
      ['solid', 'open', false],
      ['dotted', 'open', false],
    ])
  })

  it('reads arrows with and without spaces around them, and colons inside text', () => {
    expect(messages('sequenceDiagram\n    A ->> B : hi\n    A-x B: x\n    A->>B:time: 10:30\n    A->>B:')).toEqual(['A->>B: hi', 'A-xB: x', 'A->>B: time: 10:30', 'A->>B: '])
  })

  it('reads + and - after the arrow as activation shorthand', () => {
    const p = parse('sequenceDiagram\n    A->>+B: hi\n    B-->>-A: yo')
    expect(p.model.items.map((i) => (i.type === 'message' ? i.activate : undefined))).toEqual(['+', '-'])
    expect(p.model.activations).toEqual([{ participantId: 'B', start: 0, end: 1 }])
    expect(p.problems).toEqual([])
  })

  it('decodes entities and line breaks in text and strips a wrap prefix', () => {
    expect(messages('sequenceDiagram\n    A->>B: I #35; this #9829; #59; #lt;b#gt;<br/>next\n    A->>B:wrap:hello\n    A->>B: nowrap:there')).toEqual([
      'A->>B: I # this ♥ ; <b>\nnext',
      'A->>B: hello',
      'A->>B: there',
    ])
  })

  it('splits statements at ; and ignores empty ones', () => {
    const p = parse('sequenceDiagram\n    A->>B: hi; B->>A: yo;; participant C;')
    expect(messages('sequenceDiagram\n    A->>B: hi; B->>A: yo;; participant C;')).toEqual(['A->>B: hi', 'B->>A: yo'])
    expect(p.model.participants.map((x) => x.id)).toEqual(['A', 'B', 'C'])
    expect(p.problems).toEqual([])
  })

  it('reports residue after a ; as an unknown statement with the #59; hint, and retains the line once', () => {
    const p = parse('sequenceDiagram\n    A->>B: wait; then go\n    C->>D: ok')
    expect(p.problems).toEqual([
      { code: 'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT', severity: 'invalid', message: SEMICOLON_HINT, line: 2 },
    ])
    // S0: the message was modelled, so only the residue is retained, as its own fragment.
    expect(p.retained).toEqual([{ line: 2, text: 'then go', place: 'body' }])
    expect(messages('sequenceDiagram\n    A->>B: wait; then go\n    C->>D: ok')).toEqual(['A->>B: wait', 'C->>D: ok'])
  })

  it('treats a bare # as a comment to the end of the line', () => {
    expect(messages('sequenceDiagram\n    A->>B: hi # not text\n    A->>B: x #35;y')).toEqual(['A->>B: hi', 'A->>B: x #y'])
  })

  it('rejects a message without a colon, as Mermaid does', () => {
    expect(invalid('sequenceDiagram\n    A->>B\n    A->>B: ok')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2'])
  })

  it('ignores half arrows and () connections, retaining them', () => {
    const p = parse('sequenceDiagram\n    A-|\\B: half\n    A--//B: half dotted\n    A->>()B: centre\n    A()->>B: centre\n    A->>B: drawn')
    expect(p.problems.map((x) => [x.code, x.severity, x.line, x.message])).toEqual([
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 2, 'Half-arrow messages are not drawn.'],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 3, 'Half-arrow messages are not drawn.'],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 4, '"()" connections are not drawn.'],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 5, '"()" connections are not drawn.'],
    ])
    expect(p.retained.map((r) => r.line)).toEqual([2, 3, 4, 5])
    expect(p.model.items.map(describeItem)).toEqual(['A->>B: drawn'])
  })

  it('keeps keywords ahead of actors, as Mermaid lexes them', () => {
    expect(messages('sequenceDiagram\n    loop->>B: x\n    end')).toEqual(['loop ->>B: x'])
  })
})

describe('parseSequenceDiagram: activation', () => {
  it('reads activate and deactivate statements as bars over the items between them', () => {
    const m = model('sequenceDiagram\n    A->>B: one\n    activate B\n    B->>B: two\n    Note over B: three\n    deactivate B\n    B->>A: four')
    expect(m.activations).toEqual([{ participantId: 'B', start: 0, end: 2 }])
  })

  it('starts at the next item when activate comes before any item', () => {
    expect(model('sequenceDiagram\n    activate A\n    A->>B: one\n    deactivate A').activations).toEqual([{ participantId: 'A', start: 0, end: 0 }])
  })

  it('stacks activations on one participant', () => {
    expect(model('sequenceDiagram\n    A->>+B: 1\n    A->>+B: 2\n    B-->>-A: 3\n    B-->>-A: 4').activations).toEqual([
      { participantId: 'B', start: 0, end: 3 },
      { participantId: 'B', start: 1, end: 2 },
    ])
  })

  it('reports deactivating an inactive participant, in both spellings', () => {
    const p = parse('sequenceDiagram\n    A->>B: hi\n    deactivate B\n    B->>-A: yo')
    expect(p.problems).toEqual([
      { code: 'SEQUENCE_DIAGRAM_DEACTIVATE_INACTIVE', severity: 'invalid', message: '"B" is not active.', line: 3 },
      { code: 'SEQUENCE_DIAGRAM_DEACTIVATE_INACTIVE', severity: 'invalid', message: '"B" is not active.', line: 4 },
    ])
    expect(p.retained).toEqual([{ line: 3, text: '    deactivate B', place: 'body' }])
    expect(p.model.items).toHaveLength(2)
  })

  it('closes an activation still open at the end on the last item and reports it', () => {
    const p = parse('sequenceDiagram\n    A->>+B: hi\n    B->>A: yo\n    activate A')
    expect(p.problems).toEqual([
      { code: 'SEQUENCE_DIAGRAM_ACTIVATION_UNCLOSED', severity: 'ignored', message: '"B" is still active at the end.', line: 2 },
      { code: 'SEQUENCE_DIAGRAM_ACTIVATION_UNCLOSED', severity: 'ignored', message: '"A" is still active at the end.', line: 4 },
    ])
    expect(p.model.activations).toEqual([
      { participantId: 'B', start: 0, end: 1 },
      { participantId: 'A', start: 1, end: 1 },
    ])
  })
})

describe('parseSequenceDiagram: notes', () => {
  it('reads every note placement, one or two participants, case-insensitively', () => {
    expect(messages('sequenceDiagram\n    Note left of A: l\n    note right of A: r\n    NOTE over A: o\n    Note over A, B: ab')).toEqual([
      'note left A: l',
      'note right A: r',
      'note over A: o',
      'note over A,B: ab',
    ])
  })

  it('rejects a note without a participant or with too many', () => {
    expect(invalid('sequenceDiagram\n    Note over: x\n    Note left of A,B: x\n    Note over A,B,C: x')).toEqual([
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2',
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3',
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@4',
    ])
  })
})

describe('parseSequenceDiagram: frames', () => {
  it('reads every frame kind with its sections', () => {
    const source =
      'sequenceDiagram\n    loop L\n        A->>B: 1\n    end\n    alt X\n        A->>B: 2\n    else Y\n        A->>B: 3\n    else Z\n    end\n    opt O\n    end\n    par P\n        A->>B: 4\n    and Q\n        A->>B: 5\n    end\n    critical C\n        A->>B: 6\n    option D\n        A->>B: 7\n    end\n    break B\n        A->>B: 8\n    end\n    rect rgb(0, 0, 0)\n        A->>B: 9\n    end\n    par_over V\n        A->>B: 10\n    end'
    expect(model(source).items.filter((i) => i.type === 'frame').map(describeItem)).toEqual([
      'loop L',
      'alt X | Y | Z',
      'opt O',
      'par P | Q',
      'critical C | D',
      'break B',
      'rect rgb(0, 0, 0)',
      'par V',
    ])
    expect(problems(source)).toEqual([])
  })

  it('nests frames arbitrarily and flattens them depth-first', () => {
    const m = model('sequenceDiagram\n    par A to B\n        A->>B: 1\n    and A to C\n        par A to C\n            A->>C: 2\n        and C to A\n            loop again\n                C->>A: 3\n            end\n        end\n    end\n    A->>B: 4')
    expect(outline(m).filter((l) => !l.startsWith('participant'))).toEqual([
      'par A to B',
      '  A->>B: 1',
      'section A to C',
      '  par A to C',
      '    A->>C: 2',
      '  section C to A',
      '    loop again',
      '      C->>A: 3',
      'A->>B: 4',
    ])
    expect(flattenItems(m.items).map(describeItem)).toEqual(['par A to B | A to C', 'A->>B: 1', 'par A to C | C to A', 'A->>C: 2', 'loop again', 'C->>A: 3', 'A->>B: 4'])
  })

  it('indexes activations through nested frames', () => {
    const m = model('sequenceDiagram\n    alt x\n        A->>+B: 1\n        loop y\n            B->>B: 2\n        end\n    else z\n        B-->>-A: 3\n    end')
    expect(m.activations).toEqual([{ participantId: 'B', start: 1, end: 4 }])
  })

  it('reports a section keyword outside its frame', () => {
    const p = parse('sequenceDiagram\n    else x\n    loop l\n        and y\n    end\n    alt a\n        option o\n    end\n    A->>B: ok')
    expect(p.problems).toEqual([
      { code: 'SEQUENCE_DIAGRAM_SECTION_OUTSIDE_FRAME', severity: 'invalid', message: '"else" needs an open "alt".', line: 2 },
      { code: 'SEQUENCE_DIAGRAM_SECTION_OUTSIDE_FRAME', severity: 'invalid', message: '"and" needs an open "par".', line: 4 },
      { code: 'SEQUENCE_DIAGRAM_SECTION_OUTSIDE_FRAME', severity: 'invalid', message: '"option" needs an open "critical".', line: 7 },
    ])
    expect(p.retained.map((r) => r.line)).toEqual([2, 4, 7])
    expect(p.model.items.map(describeItem)).toEqual(['loop l', 'alt a', 'A->>B: ok'])
  })

  it('reports an end that closes nothing', () => {
    const p = parse('sequenceDiagram\n    A->>B: hi\n    end\n    loop x\n    end\n    end')
    expect(p.problems).toEqual([
      { code: 'SEQUENCE_DIAGRAM_END_WITHOUT_OPENER', severity: 'invalid', message: '"end" closes nothing.', line: 3 },
      { code: 'SEQUENCE_DIAGRAM_END_WITHOUT_OPENER', severity: 'invalid', message: '"end" closes nothing.', line: 6 },
    ])
    expect(p.retained.map((r) => r.text)).toEqual(['    end', '    end'])
  })

  it('reports frames and boxes left open, at the opener line, and keeps their content', () => {
    const p = parse('sequenceDiagram\n    loop x\n        alt y\n            A->>B: hi')
    expect(p.problems).toEqual([
      { code: 'SEQUENCE_DIAGRAM_FRAME_UNCLOSED', severity: 'invalid', message: '"loop" on line 2 is not closed.', line: 2 },
      { code: 'SEQUENCE_DIAGRAM_FRAME_UNCLOSED', severity: 'invalid', message: '"alt" on line 3 is not closed.', line: 3 },
    ])
    expect(flattenItems(p.model.items).map(describeItem)).toEqual(['loop x', 'alt y', 'A->>B: hi'])
    expect(parse('sequenceDiagram\n    box G\n    participant A').problems).toEqual([
      { code: 'SEQUENCE_DIAGRAM_FRAME_UNCLOSED', severity: 'invalid', message: '"box" on line 2 is not closed.', line: 2 },
    ])
  })
})

describe('parseSequenceDiagram: autonumber and title', () => {
  it('reads autonumber in its three forms before the first message', () => {
    expect(model('sequenceDiagram\n    autonumber\n    A->>B: x').numbering).toEqual({ start: 1, step: 1 })
    expect(model('sequenceDiagram\n    AUTONUMBER 10\n    A->>B: x').numbering).toEqual({ start: 10, step: 1 })
    expect(model('sequenceDiagram\n    autonumber 10 5\n    A->>B: x').numbering).toEqual({ start: 10, step: 5 })
    expect(model('sequenceDiagram\n    A->>B: x').numbering).toBeUndefined()
  })

  it('ignores and retains autonumber off, a later autonumber and a repeated one', () => {
    const p = parse('sequenceDiagram\n    autonumber off\n    autonumber 2\n    A->>B: x\n    autonumber 5\n    autonumber\n    A->>B: y')
    expect(p.model.numbering).toEqual({ start: 2, step: 1 })
    expect(p.problems.map((x) => [x.code, x.severity, x.line])).toEqual([
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 2],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 5],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 6],
    ])
    expect(p.retained.map((r) => r.line)).toEqual([2, 5, 6])
    expect(invalid('sequenceDiagram\n    autonumber ten\n    autonumber 1 2 3')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2', 'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3'])
  })

  it('reads the title from front matter, a title statement or a legacy title: statement', () => {
    expect(model('---\ntitle: From front matter\n---\nsequenceDiagram\n    A->>B: x').title).toBe('From front matter')
    expect(model('sequenceDiagram\n    title Plain title\n    A->>B: x').title).toBe('Plain title')
    expect(model('sequenceDiagram\n    title: Legacy #quot;title#quot;\n    A->>B: x').title).toBe('Legacy "title"')
    expect(model('sequenceDiagram\n    A->>B: x').title).toBeUndefined()
    expect(invalid('sequenceDiagram\n    title:NoSpace\n    A->>B: x')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2'])
  })
})

describe('parseSequenceDiagram: retained lines and ignored statements', () => {
  it('retains directives, comments and non-title front matter without problems, with body line numbers', () => {
    const p = parse('---\ntitle: T\nconfig:\n  theme: base\n---\n%%{init: {"theme": "forest"}}%%\nsequenceDiagram\n    %% a comment\n    A->>B: hi\n  %% trailing')
    expect(p.problems).toEqual([])
    expect(p.model.title).toBe('T')
    expect(p.retained).toEqual([
      { line: 3, text: 'config:', place: 'frontMatter' },
      { line: 4, text: '  theme: base', place: 'frontMatter' },
      { line: 6, text: '%%{init: {"theme": "forest"}}%%', place: 'body' },
      { line: 8, text: '    %% a comment', place: 'body' },
      { line: 10, text: '  %% trailing', place: 'body' },
    ])
    expect(p.lossy).toEqual([])
  })

  it('numbers problems by body line after front matter', () => {
    expect(problems('---\ntitle: T\n---\nsequenceDiagram\n    A->>B: hi\n    end')).toEqual(['SEQUENCE_DIAGRAM_END_WITHOUT_OPENER@6'])
  })

  it('ignores link, links, properties, details, accTitle and accDescr, retaining them', () => {
    const p = parse(
      'sequenceDiagram\n    actor A\n    link A: Dashboard @ https://example.com/a\n    links A: {"Wiki":"https://example.com/w"}\n    properties A: {"class": "x"}\n    details A: {"x": 1}\n    accTitle: Access title\n    accDescr: Access description\n    accDescr {\n      multi\n      line\n    }\n    A->>B: hi',
    )
    expect(p.problems.map((x) => [x.code, x.severity, x.line, x.message])).toEqual([
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 3, '"link" statements are not drawn.'],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 4, '"links" statements are not drawn.'],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 5, '"properties" statements are not drawn.'],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 6, '"details" statements are not drawn.'],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 7, '"accTitle" is not drawn.'],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 8, '"accDescr" is not drawn.'],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 9, '"accDescr" is not drawn.'],
    ])
    expect(p.retained.map((r) => r.line)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(p.model.items.map(describeItem)).toEqual(['A->>B: hi'])
  })

  it('ignores create and destroy, keeping the created participant with its label', () => {
    const p = parse('sequenceDiagram\n    A->>B: hi\n    create participant C\n    B->>C: hey\n    create actor D as Dave\n    C->>D: yo\n    destroy D\n    D->>C: bye')
    expect(p.model.participants).toEqual([
      { id: 'A', label: 'A', kind: 'participant' },
      { id: 'B', label: 'B', kind: 'participant' },
      { id: 'C', label: 'C', kind: 'participant' },
      { id: 'D', label: 'Dave', kind: 'actor' },
    ])
    expect(p.problems.map((x) => [x.code, x.severity, x.line])).toEqual([
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 3],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 5],
      ['SEQUENCE_DIAGRAM_STATEMENT_IGNORED', 'ignored', 7],
    ])
    expect(p.retained.map((r) => r.line)).toEqual([3, 5, 7])
    expect(p.lossy).toEqual(['create-destroy'])
  })

  it('names create-destroy in lossy once, for create alone and for destroy alone', () => {
    expect(parse('sequenceDiagram\n    create participant C\n    A->>C: hi').lossy).toEqual(['create-destroy'])
    expect(parse('sequenceDiagram\n    A->>C: hi\n    destroy C\n    A->>C: bye').lossy).toEqual(['create-destroy'])
    expect(parse('sequenceDiagram\n    create participant C\n    create actor D\n    A->>C: hi\n    destroy C\n    destroy D').lossy).toEqual(['create-destroy'])
    expect(parse('sequenceDiagram\n    create\n    A->>C: hi').lossy).toEqual([])
  })

  it('reports an unknown statement and retains it', () => {
    const p = parse('sequenceDiagram\n    A->>B: hi\n    something else entirely\n    B->>A: yo')
    expect(p.problems).toEqual([{ code: 'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT', severity: 'invalid', message: 'This statement is not sequence diagram syntax.', line: 3 }])
    expect(p.retained).toEqual([{ line: 3, text: '    something else entirely', place: 'body' }])
    expect(p.model.items).toHaveLength(2)
  })

  it('uses only the documented problem codes', () => {
    expect(Object.values(SEQUENCE_PROBLEM_CODES)).toEqual([
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT',
      'SEQUENCE_DIAGRAM_RESERVED_ID',
      'SEQUENCE_DIAGRAM_DEACTIVATE_INACTIVE',
      'SEQUENCE_DIAGRAM_END_WITHOUT_OPENER',
      'SEQUENCE_DIAGRAM_SECTION_OUTSIDE_FRAME',
      'SEQUENCE_DIAGRAM_FRAME_UNCLOSED',
      'SEQUENCE_DIAGRAM_ACTIVATION_UNCLOSED',
      'SEQUENCE_DIAGRAM_STATEMENT_IGNORED',
    ])
  })

  it('produces a plain JSON model', () => {
    const m = model('sequenceDiagram\n    autonumber\n    A->>+B: hi\n    loop x\n        B-->>-A: yo\n    end')
    expect(JSON.parse(JSON.stringify(m))).toEqual(m)
  })
})

describe('parseSequenceDiagram: review findings', () => {
  // C2 + C10: a directive may span lines, before or after the header; every physical line is retained.
  it('joins a multi-line %%{ }%% directive before the header and retains every line of it', () => {
    const source = '%%{\n  init: { "theme": "dark" }\n}%%\nsequenceDiagram\n    A->>B: hi'
    const p = parse(source)
    expect(p.problems).toEqual([])
    expect(messages(source)).toEqual(['A->>B: hi'])
    expect(p.retained).toEqual([
      { line: 1, text: '%%{', place: 'body' },
      { line: 2, text: '  init: { "theme": "dark" }', place: 'body' },
      { line: 3, text: '}%%', place: 'body' },
    ])
  })

  it('joins a multi-line directive after the header, indented, and one that never closes runs to the end as in Mermaid', () => {
    const p = parse('sequenceDiagram\n    %%{\n      init: { "theme": "dark" }\n    }%%\n    A->>B: hi')
    expect(p.problems).toEqual([])
    expect(p.retained.map((r) => [r.line, r.text])).toEqual([
      [2, '    %%{'],
      [3, '      init: { "theme": "dark" }'],
      [4, '    }%%'],
    ])
    expect(p.model.items).toHaveLength(1)
    const unclosed = parse('sequenceDiagram\n    A->>B: hi\n%%{\n  init: { "theme": "dark" }')
    expect(unclosed.problems).toEqual([])
    expect(unclosed.retained.map((r) => r.line)).toEqual([3, 4])
    expect(unclosed.model.items).toHaveLength(1)
  })

  it('strips and retains a %% comment after the header, after a ;, and after end; inside message text %% is text', () => {
    const p = parse('sequenceDiagram %% login\n    A->>B: x')
    expect(p.problems).toEqual([])
    expect(p.retained).toEqual([{ line: 1, text: '%% login', place: 'body' }])
    expect(messages('sequenceDiagram %% login\n    A->>B: x')).toEqual(['A->>B: x'])
    expect(messages('sequenceDiagram %% login; A->>B: x')).toEqual([])
    expect(parse('sequenceDiagram; %% c\n    A->>B: x; %% d\n    loop l\n    end %% e').retained).toEqual([
      { line: 1, text: '%% c', place: 'body' },
      { line: 2, text: '%% d', place: 'body' },
      { line: 4, text: '%% e', place: 'body' },
    ])
    expect(problems('sequenceDiagram; %% c\n    A->>B: x; %% d\n    loop l\n    end %% e')).toEqual([])
    expect(messages('sequenceDiagram\n    A->>B: hi %% c')).toEqual(['A->>B: hi %% c'])
    expect(messages('sequenceDiagram\n    loop x\n    end %% c; A->>B: x')).toEqual(['loop x'])
    expect(parse('sequenceDiagram\n    autonumber 10 %% c\n    A->>B: x').problems).toEqual([])
    expect(model('sequenceDiagram\n    autonumber 10 %% c\n    A->>B: x').numbering).toEqual({ start: 10, step: 1 })
    expect(invalid('sequenceDiagram\n    activate A\n    deactivate A %% c')).toEqual(['SEQUENCE_DIAGRAM_DEACTIVATE_INACTIVE@3'])
  })

  it('retains the residue and the comment of a partly modelled line as two fragments, and a wholly unknown line once, verbatim', () => {
    const p = parse('sequenceDiagram\n    A->>B: wait; then go; %% c')
    expect(p.problems).toEqual([{ code: 'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT', severity: 'invalid', message: SEMICOLON_HINT, line: 2 }])
    expect(p.retained).toEqual([
      { line: 2, text: 'then go', place: 'body' },
      { line: 2, text: '%% c', place: 'body' },
    ])
    const whole = parse('sequenceDiagram\n    foo; bar %% c')
    expect(whole.retained).toEqual([{ line: 2, text: '    foo; bar %% c', place: 'body' }])
  })

  // C27: the header is the leading keyword token; the rest of its line is the first statement.
  it('reads the header and the first statement on one line', () => {
    expect(messages('sequenceDiagram A->>B: hi')).toEqual(['A->>B: hi'])
    expect(messages('sequenceDiagram\tA->>B: hi')).toEqual(['A->>B: hi'])
    expect(parse('sequenceDiagram A->>B: hi').problems).toEqual([])
    expect(model('sequenceDiagram participant A').participants).toEqual([{ id: 'A', label: 'A', kind: 'participant' }])
    expect(messages('sequenceDiagram;A->>B: hi')).toEqual(['A->>B: hi'])
    expect(parseSequenceDiagram('sequenceDiagramA->>B: hi')).toEqual({ error: 'Not a sequence diagram: expected "sequenceDiagram", got "sequenceDiagramA->>B: hi".', line: 1 })
  })

  // C19: `(` and `)` are actor characters in messages; `to` cannot start with `(`.
  it('reads actor names with parentheses in messages, keeping the () connection check first', () => {
    expect(messages('sequenceDiagram\n    A(1)->>B: hi')).toEqual(['A(1)->>B: hi'])
    expect(parse('sequenceDiagram\n    A(1)->>B: hi').problems).toEqual([])
    expect(messages('sequenceDiagram\n    A->>B(2): hi\n    A(1)-)B(2): yo\n    A (1)-->>B: x')).toEqual(['A->>B(2): hi', 'A(1)-)B(2): yo', 'A (1)-->>B: x'])
    const p = parse('sequenceDiagram\n    A(1)->>+B(2): hi\n    B(2)-->>-A(1): yo')
    expect(p.problems).toEqual([])
    expect(p.model.activations).toEqual([{ participantId: 'B(2)', start: 0, end: 1 }])
    expect(invalid('sequenceDiagram\n    A->>(B): hi')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2'])
    expect(parse('sequenceDiagram\n    A()->>B: c\n    A->>()B: c').problems.map((x) => x.message)).toEqual(['"()" connections are not drawn.', '"()" connections are not drawn.'])
  })

  // C26: a message end or note target Mermaid lexes as a keyword.
  it('reports a reserved keyword used as a message actor, at the use and not the declaration', () => {
    const p = parse('sequenceDiagram\n    participant end as Endpoint\n    A->>end: hi')
    expect(p.problems).toEqual([{ code: 'SEQUENCE_DIAGRAM_RESERVED_ID', severity: 'invalid', message: '"end" is a Mermaid keyword and cannot be a participant id.', line: 3 }])
    expect(p.retained).toEqual([])
    expect(messages('sequenceDiagram\n    participant end as Endpoint\n    A->>end: hi')).toEqual(['A->>end: hi'])
    expect(p.model.participants.map((x) => x.id)).toEqual(['end', 'A'])
    expect(parse('sequenceDiagram\n    participant end as Endpoint').problems).toEqual([])
    expect(invalid('sequenceDiagram\n    participant loop as Loop Service\n    A->>loop: x')).toEqual(['SEQUENCE_DIAGRAM_RESERVED_ID@3'])
    expect(parse('sequenceDiagram\n    Note->>A: x').problems).toEqual([{ code: 'SEQUENCE_DIAGRAM_RESERVED_ID', severity: 'invalid', message: '"Note" is a Mermaid keyword and cannot be a participant id.', line: 2 }])
    expect(invalid('sequenceDiagram\n    end->>A: x')).toEqual(['SEQUENCE_DIAGRAM_RESERVED_ID@2'])
    expect(invalid('sequenceDiagram\n    A->>End: x\n    A->>end point: x\n    A->>end-point: x\n    A->>title: x\n    A->>Note over B: x\n    participant->>B: x\n    activate->>B: x\n    link->>B: x')).toEqual([
      'SEQUENCE_DIAGRAM_RESERVED_ID@2',
      'SEQUENCE_DIAGRAM_RESERVED_ID@3',
      'SEQUENCE_DIAGRAM_RESERVED_ID@4',
      'SEQUENCE_DIAGRAM_RESERVED_ID@5',
      'SEQUENCE_DIAGRAM_RESERVED_ID@6',
      'SEQUENCE_DIAGRAM_RESERVED_ID@7',
      'SEQUENCE_DIAGRAM_RESERVED_ID@8',
      'SEQUENCE_DIAGRAM_RESERVED_ID@9',
    ])
    const keywords = ['end', 'loop', 'alt', 'else', 'opt', 'par', 'par_over', 'and', 'critical', 'option', 'break', 'rect', 'note', 'box', 'participant', 'actor', 'activate', 'deactivate', 'autonumber', 'links', 'link', 'properties', 'details', 'create', 'destroy', 'over', 'off', 'sequenceDiagram', 'accTitle', 'accDescr']
    for (const keyword of keywords) expect(invalid(`sequenceDiagram\n    A->>${keyword}: x`), keyword).toEqual(['SEQUENCE_DIAGRAM_RESERVED_ID@2'])
  })

  it('reports a reserved keyword as a note target', () => {
    expect(invalid('sequenceDiagram\n    Note over end: x\n    Note over A, end: x\n    Note left of loop: x\n    Note over A,title: x')).toEqual([
      'SEQUENCE_DIAGRAM_RESERVED_ID@2',
      'SEQUENCE_DIAGRAM_RESERVED_ID@3',
      'SEQUENCE_DIAGRAM_RESERVED_ID@4',
      'SEQUENCE_DIAGRAM_RESERVED_ID@5',
    ])
  })

  it('accepts ids Mermaid accepts: keyword prefixes, title without a following space, and declarations', () => {
    const source = 'sequenceDiagram\n    A->>endpoint: x\n    A->>title:x\n    title->>B: x\n    A->>as: x\n    A->>left: x\n    A->>wrap: x\n    Andy->>Office: x\n    accTitle->>B: x'
    expect(parse(source).problems).toEqual([])
    expect(messages(source)).toEqual(['A->>endpoint: x', 'A->>title: x', 'title->>B: x', 'A->>as: x', 'A->>left: x', 'A->>wrap: x', 'Andy->>Office: x', 'accTitle->>B: x'])
    expect(parse('sequenceDiagram\n    participant end\n    actor loop\n    activate end\n    deactivate end\n    box G\n    participant note\n    end').problems).toEqual([])
  })

  it('closes a frame on an end with trailing text and reports the residue', () => {
    expect(problems('sequenceDiagram\n    loop x\n    end foo')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3'])
    expect(problems('sequenceDiagram\n    box g\n    participant A\n    end foo')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@4'])
    expect(model('sequenceDiagram\n    box g\n    participant A\n    end foo').boxes).toEqual([{ label: 'g', participantIds: ['A'] }])
  })

  it('reports a bare ignored keyword as unknown rather than ignored', () => {
    expect(invalid('sequenceDiagram\n    link\n    destroy->>B: x')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2', 'SEQUENCE_DIAGRAM_RESERVED_ID@3'])
  })

  // C29: one problem per code and line, with the entity hint.
  it('reports one problem per code and line, however many residues a line has', () => {
    const source = 'sequenceDiagram\n    participant W as Workstation\n    participant F as \\\\fileserver\\share\n    W->>F: copy C:\\Users\\jdoe\\report.docx\n    F-->>W: &lt;done&gt; &amp; 100%'
    const p = parse(source)
    expect(p.problems).toEqual([{ code: 'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT', severity: 'invalid', message: SEMICOLON_HINT, line: 5 }])
    expect(p.retained).toEqual([{ line: 5, text: 'done&gt; &amp; 100%', place: 'body' }])
    expect(messages(source)).toEqual(['W->>F: copy C:\\Users\\jdoe\\report.docx', 'F-->>W: &lt'])
    expect(problems('sequenceDiagram\n    foo; bar; baz\n    deactivate A; deactivate B')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2', 'SEQUENCE_DIAGRAM_DEACTIVATE_INACTIVE@3'])
  })
})

describe('parseSequenceDiagram: second review findings', () => {
  // S0, S2: a line with a modelled statement and a residue after `;` retains only the residue, so the writer never re-emits the statement.
  it('retains only the unmodelled residue of a line whose other statements were modelled', () => {
    const hello = parse('sequenceDiagram\n    A->>B: Hello; how are you?')
    expect(messages('sequenceDiagram\n    A->>B: Hello; how are you?')).toEqual(['A->>B: Hello'])
    expect(hello.retained).toEqual([{ line: 2, text: 'how are you?', place: 'body' }])
    expect(hello.problems).toEqual([{ code: 'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT', severity: 'invalid', message: SEMICOLON_HINT, line: 2 }])
    const entity = parse('sequenceDiagram\n    A->>B: Tom &amp; Jerry')
    expect(messages('sequenceDiagram\n    A->>B: Tom &amp; Jerry')).toEqual(['A->>B: Tom &amp'])
    expect(entity.retained).toEqual([{ line: 2, text: 'Jerry', place: 'body' }])
    const frame = parse('sequenceDiagram\n    loop x; garbage\n    end')
    expect(frame.model.items).toEqual([{ type: 'frame', kind: 'loop', sections: [{ label: 'x', items: [] }] }])
    expect(frame.retained).toEqual([{ line: 2, text: 'garbage', place: 'body' }])
    expect(invalid('sequenceDiagram\n    loop x; garbage\n    end')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2'])
    // Several residues join into one fragment; a wholly unmodelled line stays verbatim.
    expect(parse('sequenceDiagram\n    A->>B: x; foo; bar').retained).toEqual([{ line: 2, text: 'foo; bar', place: 'body' }])
    expect(parse('sequenceDiagram\n    foo; bar').retained).toEqual([{ line: 2, text: '    foo; bar', place: 'body' }])
    // The header counts as modelled: the residue of its line is a fragment.
    expect(parse('sequenceDiagram; foo').retained).toEqual([{ line: 1, text: 'foo', place: 'body' }])
    // An ignored statement beside a modelled one is a fragment too, and a config declaration alone keeps its line.
    expect(parse('sequenceDiagram\n    A->>B: x; link A: Docs @ https://example.com').retained).toEqual([{ line: 2, text: 'link A: Docs @ https://example.com', place: 'body' }])
    expect(parse('sequenceDiagram\n    participant A@{ "type": "boundary" }; A->>B: x').retained).toEqual([{ line: 2, text: 'participant A@{ "type": "boundary" }', place: 'body' }])
    expect(parse('sequenceDiagram\n    participant A@{ "type": "boundary" }').retained).toEqual([{ line: 2, text: '    participant A@{ "type": "boundary" }', place: 'body' }])
    // A problem statement that closes nothing is kept once, even when it is reported twice.
    expect(parse('sequenceDiagram\n    loop x\n    end; end foo').retained).toEqual([{ line: 3, text: 'end foo', place: 'body' }])
  })

  // S7: a `-` before a `to` starting with x or X is the `-x` arrow to Mermaid, not the deactivation suffix.
  it('rejects a - suffix before an id starting with x, as Mermaid lexes -x there', () => {
    expect(invalid('sequenceDiagram\n    B->>+A: x\n    A-->>-Xavier: y')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3'])
    expect(invalid('sequenceDiagram\n    B->>+A: x\n    A-->>-xavier: y')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3'])
    expect(invalid('sequenceDiagram\n    A->>+B: x\n    B-)-xA: y')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3'])
    expect(parse('sequenceDiagram\n    A->>+Xavier: x\n    A-->>Xavier: y\n    deactivate Xavier').problems).toEqual([])
    expect(messages('sequenceDiagram\n    A-x-Xavier: y')).toEqual([])
  })

  // S8: `@` may appear in a message actor but never in a declared id.
  it('accepts @ in message ids and rejects it in declarations, as Mermaid does', () => {
    const emails = 'sequenceDiagram\n    alice@example.com->>bob@example.com: hi\n    Note over alice@example.com: n'
    expect(parse(emails).problems).toEqual([])
    expect(model(emails).participants.map((p) => p.id)).toEqual(['alice@example.com', 'bob@example.com'])
    expect(invalid('sequenceDiagram\n    participant a@b\n    participant a@b as Label\n    actor c@d\n    participant A @{x}\n    activate a@b\n    create participant e@f')).toEqual([
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2',
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3',
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@4',
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@5',
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@6',
      'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@7',
    ])
    expect(invalid('sequenceDiagram\n    box G\n    participant a@b\n    end')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3'])
    expect(parse('sequenceDiagram\n    participant A as x@y').model.participants).toEqual([{ id: 'A', label: 'x@y', kind: 'participant' }])
  })

  // S10: `@{` is participant config only directly after the id; after ` as ` it is the alias.
  it('reads @{ as config only directly after the id, and an alias after the config', () => {
    const alias = parse('sequenceDiagram\n    participant shapex as @{shape: x}\n    shapex->>B: hi')
    expect(alias.problems).toEqual([])
    expect(alias.retained).toEqual([])
    expect(alias.model.participants).toEqual([
      { id: 'shapex', label: '@{shape: x}', kind: 'participant' },
      { id: 'B', label: 'B', kind: 'participant' },
    ])
    const configured = parse('sequenceDiagram\n    participant A@{ "type": "boundary" } as Alice\n    A->>B: x')
    expect(configured.model.participants[0]).toEqual({ id: 'A', label: 'Alice', kind: 'participant' })
    expect(configured.problems).toEqual([{ code: 'SEQUENCE_DIAGRAM_STATEMENT_IGNORED', severity: 'ignored', message: 'The "@{ }" participant config is not drawn.', line: 2 }])
    expect(configured.retained).toEqual([{ line: 2, text: '    participant A@{ "type": "boundary" } as Alice', place: 'body' }])
    expect(parse('sequenceDiagram\n    actor A@{ "type": "boundary" }').model.participants).toEqual([{ id: 'A', label: 'A', kind: 'actor' }])
  })

  // S17: message ids are Mermaid's actor token.
  it('rejects ids Mermaid rejects: -x, -- and a trailing - inside an id, and a leading -', () => {
    for (const source of ['A-xray->>B: hi', 'A-x->>B: hi', 'A-->>B-: hi', 'A--1->>B: hi', '-A->>B: hi', 'A->>B--c: hi']) {
      expect(invalid(`sequenceDiagram\n    ${source}`), source).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2'])
    }
    expect(messages('sequenceDiagram\n    A-b-c->>B- c: hi\n    A->>B -c: yo\n    api-gw-->>Bob(2): x')).toEqual(['A-b-c->>B- c: hi', 'A->>B -c: yo', 'api-gw-->>Bob(2): x'])
  })

  it('accepts a bare # inside an actor id, as Mermaid does, and reads it as a comment where a token starts or in text', () => {
    expect(parse('sequenceDiagram\n    A#1->>B: hi').problems).toEqual([])
    expect(messages('sequenceDiagram\n    A#1->>B: hi\n    A->>B #1: yo\n    Note over A#1: n')).toEqual(['A#1->>B: hi', 'A->>B #1: yo', 'note over A#1: n'])
    expect(model('sequenceDiagram\n    A#1->>B: hi').participants.map((p) => p.id)).toEqual(['A#1', 'B'])
    expect(messages('sequenceDiagram\n    A->>B: hi # not text\n    A->>B:#c')).toEqual(['A->>B: hi', 'A->>B: '])
    expect(invalid('sequenceDiagram\n    A->>#B: hi\n    Note over A,#B: n\n    #A->>B: x\n    A->>B: y')).toEqual(['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2', 'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3'])
    expect(model('sequenceDiagram\n    participant A as B #c\n    loop x #c\n    end\n    participant D #e').participants).toEqual([
      { id: 'A', label: 'B', kind: 'participant' },
      { id: 'D #e', label: 'D #e', kind: 'participant' },
    ])
    expect(model('sequenceDiagram\n    loop x #c\n    end').items).toEqual([{ type: 'frame', kind: 'loop', sections: [{ label: 'x', items: [] }] }])
    expect(model('sequenceDiagram\n    A->>B: x #c; B->>A: y').items).toHaveLength(1)
  })

  it('reads -X and --X as cross arrows, as Mermaid does', () => {
    expect(messages('sequenceDiagram\n    A--XB: hi\n    A-XB: yo')).toEqual(['A--xB: hi', 'A-xB: yo'])
    expect(parse('sequenceDiagram\n    A--XB: hi').problems).toEqual([])
  })
})

describe('parseSequenceDiagram: corpus outlines', () => {
  const EXPECTED: Record<string, readonly string[]> = {
    'actor-hash.mmd': ['participant A#1', 'participant B', 'A#1->>B: hi', 'note over A#1: n'],
    'actor-parens.mmd': ['participant Alice(1)', 'participant Bob(2)', 'Alice(1)->>Bob(2): Hi', 'Bob(2)-->>Alice(1): Hello'],
    'alias-config-text.mmd': ['participant shapex as @{shape: x}', 'participant B', 'shapex->>B: hi'],
    'config-alias.mmd': ['participant A as Alice', 'participant B', 'A->>B: x'],
    'cross-uppercase.mmd': ['participant A', 'participant B', 'A--xB: hi', 'A-xB: yo'],
    'email-ids.mmd': ['participant alice@example.com', 'participant bob@example.com', 'alice@example.com->>bob@example.com: hi', 'bob@example.com-->>alice@example.com: yo'],
    'activation-shorthand.mmd': ['participant Alice', 'participant John', 'Alice->>+John: Hello John, how are you?', 'John-->>-Alice: Great!', 'activation John 0-1'],
    'activation-stacked.mmd': [
      'participant Alice',
      'participant John',
      'Alice->>+John: Hello John, how are you?',
      'Alice->>+John: John, can you hear me?',
      'John-->>-Alice: Hi Alice, I can hear you!',
      'John-->>-Alice: I feel great!',
      'activation John 0-3',
      'activation John 1-2',
    ],
    'activation.mmd': ['participant Alice', 'participant John', 'Alice->>John: Hello John, how are you?', 'John-->>Alice: Great!', 'activation John 0-1'],
    'actors.mmd': ['actor Alice', 'actor Bob', 'Alice->>Bob: Hi Bob'],
    'aliases-mixed.mmd': ['actor Alice as A', 'participant Bob as B', 'participant A', 'participant B', 'A->>B: Hello'],
    'aliases.mmd': ['participant Alice as A', 'participant Bob as B', 'participant A', 'participant B', 'A->>B: Hello'],
    'alt-opt.mmd': [
      'participant Alice',
      'participant Bob',
      'participant John',
      'Alice->>Bob: Hello Bob, how are you?',
      'alt Bob is sick',
      '  Bob->>John: Not feeling well :(',
      'section Bob is well',
      '  Bob->>John: Feeling fresh like a daisy',
      'opt Extra response',
      '  John-->>Alice: Thanks for asking',
    ],
    'arrows.mmd': [
      'participant Alice',
      'participant John',
      'Alice->John: Solid line without arrow',
      'Alice-->John: Dotted line without arrow',
      'Alice->>John: Solid line with arrowhead',
      'Alice-->>John: Dotted line with arrowhead',
      'Alice<<->>John: Solid line with bidirectional arrowheads',
      'Alice<<-->>John: Dotted line with bidirectional arrowheads',
      'Alice-xJohn: Solid line with a cross at the end',
      'Alice--xJohn: Dotted line with a cross at the end',
      'Alice-)John: Solid line with open arrow',
      'Alice--)John: Dotted line with open arrow',
    ],
    'autonumber-start-step.mmd': ['autonumber 10 5', 'participant Alice', 'participant John', 'Alice->>John: Hello John, how are you?', 'John-->>Alice: Great!'],
    'autonumber.mmd': [
      'autonumber 1 1',
      'participant Alice',
      'participant John',
      'Alice->>John: Hello John, how are you?',
      'loop HealthCheck',
      '  John->>John: Fight against hypochondria',
      'note over John,Alice: A typical interaction',
      'John-->>Alice: Great!',
    ],
    'box.mmd': [
      'participant A',
      'participant J',
      'participant B',
      'participant C',
      'box Purple Alice & John: A,J',
      'box Another Group: B,C',
      'A->>J: Hello John, how are you?',
      'J->>A: Great!',
      'A->>B: Hello Bob, how is Charley?',
      'B->>C: Hello Charley, how are you?',
    ],
    'comments.mmd': ['participant Alice', 'participant John', 'Alice->>John: Hello John, how are you?', 'note over Alice,John: A typical interaction', 'John-->>Alice: Great!'],
    'critical-single.mmd': ['participant Alice', 'participant John', 'critical Establish a connection to the DB', "  Alice->>John: I'm getting a fresh token."],
    'critical.mmd': [
      'participant Alice',
      'participant John',
      'critical Establish a connection to the DB',
      "  Alice->>John: I'm getting a fresh token.",
      'section John says yes',
      "  John-->>Alice: I'm sending you the token.",
      'section John says no',
      '  John-->>Alice: Security! No direct links allowed!',
      'Alice->>John: Thanks!',
    ],
    'directive.mmd': ['participant Alice', 'participant Bob', 'Alice->>Bob: Hi'],
    'directive-multi-line.mmd': ['participant Alice', 'participant Bob', 'Alice->>Bob: Hi'],
    'header-comment.mmd': ['participant Alice', 'participant Bob', 'Alice->>Bob: Hi'],
    'header-inline.mmd': ['participant Alice', 'participant Bob', 'Alice->>Bob: Hi'],
    'entity-codes.mmd': ['participant A', 'participant B', 'A->>B: I # this ♥'],
    'line-breaks.mmd': ['participant Alice', 'participant John', 'Alice->>John: Hello John,\nhow are you?', 'note over Alice,John: A typical\ninteraction'],
    'link.mmd': ['actor Alice', 'actor John', 'Alice->>John: Hello John, how are you?', 'John-->>Alice: Great!'],
    'links.mmd': ['actor Alice', 'actor John', 'Alice->>John: Hello John, how are you?', 'John-->>Alice: Great!'],
    'loop.mmd': ['participant Alice', 'participant John', "Alice->>John: Great weather today, isn't it?", 'loop Every minute', '  John-->>Alice: Great!'],
    'note-over-two.mmd': ['participant Alice', 'participant John', 'Alice->>John: Hello John, how are you?', 'note over Alice,John: A typical interaction'],
    'note-over.mmd': ['participant John', 'note over John: A typical interaction'],
    'par-nested.mmd': [
      'participant Alice',
      'participant Bob',
      'participant John',
      'par Alice to Bob',
      '  Alice->>Bob: Go help John',
      'section Alice to John',
      '  par Alice to John',
      '    Alice->>John: Hi John, how are you?',
      '  section John to Alice',
      "    John->>Alice: Hi Alice, I'm good!",
    ],
    'par.mmd': [
      'participant Alice',
      'participant Bob',
      'participant John',
      'par Alice to Bob',
      '  Alice->>Bob: Great!',
      'section Alice to John',
      '  Alice->>John: How about you?',
      'Bob-->>Alice: Jolly good!',
      'John-->>Alice: Pretty well!',
    ],
    'participants.mmd': ['participant Alice', 'participant Bob', 'participant John', 'Alice->>John: Hello John, how are you?'],
    'rect.mmd': [
      'participant Alice',
      'participant John',
      'rect rgb(200, 150, 255)',
      '  note over Alice,John: color',
      '  Alice->>John: Great!',
      '  John->>Alice: How about you?',
      'rect rgb(200, 200, 150)',
      '  note over John: I am thinking',
      '  alt John is sick',
      '    John->>Alice: Not feeling well :(',
      '  section John is well',
      '    John->>Alice: Feeling fresh like a daisy',
    ],
    'title-front-matter.mmd': ['title Hello Title', 'participant Alice', 'participant Bob', 'Alice->>Bob: Hi'],
  }
  const IGNORED: Record<string, readonly number[]> = { 'config-alias.mmd': [2], 'link.mmd': [4, 5, 6, 7], 'links.mmd': [4, 5] }
  /** Retained body lines: comments, directives and the ignored statements above. */
  const RETAINED: Record<string, readonly number[]> = {
    'actor-parens.mmd': [],
    'comments.mmd': [3, 5],
    'config-alias.mmd': [2],
    'directive-multi-line.mmd': [1, 2, 3],
    'directive.mmd': [1],
    'header-comment.mmd': [1],
    'header-inline.mmd': [],
    'link.mmd': [4, 5, 6, 7],
    'links.mmd': [4, 5],
  }

  const files = readdirSync(CORPUS).filter((f) => f.endsWith('.mmd')).sort()

  it('covers every corpus file', () => {
    expect(files).toEqual(Object.keys(EXPECTED).sort())
    expect(files.length).toBeGreaterThanOrEqual(14)
  })

  for (const file of files) {
    it(`reads ${file} as documented`, () => {
      const p = parse(readFileSync(join(CORPUS, file), 'utf8'))
      expect(outline(p.model)).toEqual(EXPECTED[file])
      expect(p.problems.filter((x) => x.severity === 'invalid')).toEqual([])
      expect(p.problems.map((x) => x.line)).toEqual(IGNORED[file] ?? [])
      expect(p.retained.filter((r) => r.place === 'body').map((r) => r.line)).toEqual(RETAINED[file] ?? [])
    })
  }
})
