/**
 * Mermaid flowchart in, DrawingData out, and back without loss. The parser
 * is tolerant (docs/MERMAID_PLATFORM.md section 4.3): what it cannot model
 * is a problem and a retained line, never an error, and what the drawing
 * flattens is named in `lossy`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  drawingToMermaid,
  isMermaidFlowchart,
  parseMermaidFlowchart,
  type DrawingData,
  type DrawingShape,
} from '../src/core/index.js'
import type { FlowchartParse } from '../src/core/mermaid-parse.js'

function parsed(source: string): FlowchartParse {
  const result = parseMermaidFlowchart(source)
  if ('error' in result) throw new Error(result.error)
  return result
}
const data = (source: string): DrawingData => parsed(source).data
const boxes = (d: DrawingData): DrawingShape[] => d.shapes.filter((s) => !['arrow', 'line', 'text'].includes(s.type))
const edges = (d: DrawingData): DrawingShape[] => d.shapes.filter((s) => s.type === 'arrow' || s.type === 'line')
const edgeSummary = (d: DrawingData) =>
  edges(d).map((e) => [e.startBinding?.id, e.endBinding?.id, e.type, e.text ?? '', e.bidirectional ?? false])

describe('parseMermaidFlowchart: syntax', () => {
  it('reads nodes with every bracket shape and maps them to drawing shapes', () => {
    const d = data(`flowchart LR
      a[Rect] --> b(Rounded) --> c([Stadium]) --> d((Circle)) --> e{Decision} --> f[(Database)] --> g[[Sub]] --> h>Note]
    `)
    expect(boxes(d).map((b) => [b.id, b.type, b.text])).toEqual([
      ['a', 'rect', 'Rect'],
      ['b', 'rect', 'Rounded'],
      ['c', 'ellipse', 'Stadium'],
      ['d', 'ellipse', 'Circle'],
      ['e', 'diamond', 'Decision'],
      ['f', 'cylinder', 'Database'],
      ['g', 'queue', 'Sub'],
      ['h', 'note', 'Note'],
    ])
    expect(edges(d)).toHaveLength(7)
  })

  it('reads edge labels in both spellings, lines, arrows and bidirectional arrows', () => {
    const d = data(`graph TD
      a --> b
      a -->|yes| c
      b -- no --> c
      c --- d
      c <--> e
      d -.-> e
      e ==> a
    `)
    expect(edgeSummary(d)).toEqual([
      ['a', 'b', 'arrow', '', false],
      ['a', 'c', 'arrow', 'yes', false],
      ['b', 'c', 'arrow', 'no', false],
      ['c', 'd', 'line', '', false],
      ['c', 'e', 'arrow', '', true],
      ['d', 'e', 'arrow', '', false],
      ['e', 'a', 'arrow', '', false],
    ])
  })

  it('expands & groups, chains and ; separated statements', () => {
    const d = data('flowchart LR; a & b --> c --> d; e[E]')
    expect(edges(d).map((e) => `${e.startBinding?.id}>${e.endBinding?.id}`)).toEqual(['a>c', 'b>c', 'c>d'])
    expect(boxes(d).map((b) => b.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('reads through subgraphs, keeps classes and clicks, applies style colours', () => {
    const result = parsed(`flowchart TB
      subgraph api [API]
        direction LR
        web[Web] --> svc[Service]:::hot
      end
      classDef hot fill:#f00
      click web "https://example.com"
      style svc fill:#b2f2bb,stroke:#2f9e44
    `)
    const d = result.data
    expect(boxes(d).map((b) => b.id)).toEqual(['web', 'svc'])
    const svc = boxes(d)[1]
    expect(svc?.fill).toBe('#b2f2bb')
    expect(svc?.stroke).toBe('#2f9e44')
    expect(result.retained.map((line) => line.text.trim())).toEqual(['class svc hot', 'classDef hot fill:#f00', 'click web "https://example.com"'])
    expect(result.lossy).toEqual(['subgraph'])
    expect(result.problems).toEqual([])
  })

  it('decodes quoted text, entities and line breaks; front matter gives the title', () => {
    const d = data(`---
title: "Two cards"
---
flowchart LR
  a["Say #quot;hi#quot;<br/>twice"] --> b["a #124; b"]`)
    expect(d.title).toBe('Two cards')
    expect(boxes(d)[0]?.text).toBe('Say "hi"\ntwice')
    expect(boxes(d)[1]?.text).toBe('a | b')
  })

  it('hands out geometry with at most two decimals, so one write never changes the model', () => {
    const d = data('flowchart LR\n    a --> b & c --> d')
    const numbers = JSON.stringify(d).match(/-?\d+\.\d+/g) ?? []
    expect(numbers.length).toBeGreaterThan(0)
    for (const number of numbers) expect(number.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
    expect(data(drawingToMermaid(d))).toEqual(d)
  })

  it('lays the graph out top to bottom for TB and left to right for LR', () => {
    const lr = boxes(data('flowchart LR\n a --> b'))
    const tb = boxes(data('flowchart TB\n a --> b'))
    expect((lr[1]?.x ?? 0) > (lr[0]?.x ?? 0)).toBe(true)
    expect(lr[1]?.y).toBe(lr[0]?.y)
    expect((tb[1]?.y ?? 0) > (tb[0]?.y ?? 0)).toBe(true)
  })

  it('accepts every header keyword and direction, case-sensitive on the keyword', () => {
    for (const header of ['flowchart LR', 'graph TD', 'flowchart-elk BT', 'flowchart', 'graph RL', 'flowchart TB;', 'graph BR', 'flowchart v', 'flowchart ^']) {
      expect(parseMermaidFlowchart(`${header}\n  a --> b`)).not.toHaveProperty('error')
    }
    expect(parseMermaidFlowchart('Flowchart LR\n  a --> b')).toMatchObject({ error: expect.stringMatching(/Not a Mermaid flowchart/), line: 1 })
    expect(parseMermaidFlowchart('graphTD\n  a --> b')).toHaveProperty('error')
  })

  it('rejects other diagram types with a reason and the line, never a throw', () => {
    expect(isMermaidFlowchart('sequenceDiagram\n  A->>B: hi')).toBe(false)
    expect(isMermaidFlowchart('%% comment\nflowchart LR\n a')).toBe(true)
    const sequence = parseMermaidFlowchart('sequenceDiagram\n  A->>B: hi')
    expect('error' in sequence && sequence.error).toMatch(/Not a Mermaid flowchart/)
    expect('error' in sequence && sequence.line).toBe(1)
    const afterComments = parseMermaidFlowchart('---\ntitle: x\n---\n%% a\n\nclassDiagram\n  A')
    expect('error' in afterComments && afterComments.line).toBe(6)
    expect(parseMermaidFlowchart('')).toHaveProperty('error')
    expect(parseMermaidFlowchart('%% only a comment')).toHaveProperty('error')
  })
})

describe('parseMermaidFlowchart: every arrow spelling', () => {
  const spellings: readonly [token: string, type: 'arrow' | 'line', bidirectional: boolean, lossy: boolean][] = [
    ['-->', 'arrow', false, false],
    ['---', 'line', false, false],
    ['<-->', 'arrow', true, false],
    ['-.->', 'arrow', false, true],
    ['-.-', 'line', false, true],
    ['==>', 'arrow', false, true],
    ['===', 'line', false, true],
    ['--o', 'arrow', false, true],
    ['--x', 'arrow', false, true],
    ['<==>', 'arrow', true, true],
    ['<-.->', 'arrow', true, true],
    ['--->', 'arrow', false, true],
    ['---->', 'arrow', false, true],
    ['----', 'line', false, true],
    ['-..->', 'arrow', false, true],
    ['-...-', 'line', false, true],
    ['===>', 'arrow', false, true],
    ['====', 'line', false, true],
  ]

  it.each(spellings)('%s parses the same with and without spaces', (token, type, bidirectional, lossy) => {
    const spaced = parsed(`flowchart LR\n    A ${token} B`)
    const tight = parsed(`flowchart LR\n    A${token}B`)
    expect(edgeSummary(spaced.data)).toEqual([['A', 'B', type, '', bidirectional]])
    expect(tight.data).toEqual(spaced.data)
    expect(spaced.problems).toEqual([])
    expect(spaced.lossy).toEqual(lossy ? ['edge-style'] : [])
    expect(tight.lossy).toEqual(spaced.lossy)
  })

  it.each([
    ['-->|text|', 'arrow', false],
    ['---|text|', 'line', false],
    ['-- text -->', 'arrow', false],
    ['-- text ---', 'line', false],
    ['-. text .->', 'arrow', true],
    ['== text ==>', 'arrow', true],
    ['-.->|text|', 'arrow', true],
    ['==>|text|', 'arrow', true],
    ['-- text --->', 'arrow', true],
    ['-- text ----', 'line', true],
  ] as const)('%s carries its label with and without spaces', (token, type, lossy) => {
    const spaced = parsed(`flowchart LR\n    A ${token} B`)
    const tight = parsed(`flowchart LR\n    A${token}B`)
    expect(edgeSummary(spaced.data)).toEqual([['A', 'B', type, 'text', false]])
    expect(tight.data).toEqual(spaced.data)
    expect(spaced.lossy).toEqual(lossy ? ['edge-style'] : [])
  })

  it.each([
    ['o--o', 'arrow', true],
    ['x--x', 'arrow', true],
    ['o--x', 'arrow', true],
  ] as const)('%s needs the space Mermaid needs, so the start marker is not read as part of the id', (token, type, bidirectional) => {
    const spaced = parsed(`flowchart LR\n    A ${token} B`)
    expect(edgeSummary(spaced.data)).toEqual([['A', 'B', type, '', bidirectional]])
    expect(spaced.lossy).toEqual(['edge-style'])
    // `Ao--oB` is the node `Ao` with a circle-headed link to `B`, as in Mermaid.
    const tight = parsed(`flowchart LR\n    A${token}B`)
    expect(boxes(tight.data).map((b) => b.id)).toEqual([`A${token[0]}`, 'B'])
  })

  it('unquotes a quoted label and keeps a hyphenated id whole', () => {
    const d = data('flowchart LR\n    my-box -- "edge label" --> other-box-2 -->|"piped"| c')
    expect(boxes(d).map((b) => b.id)).toEqual(['my-box', 'other-box-2', 'c'])
    expect(edgeSummary(d)).toEqual([
      ['my-box', 'other-box-2', 'arrow', 'edge label', false],
      ['other-box-2', 'c', 'arrow', 'piped', false],
    ])
  })

  it('keeps an invisible link as written and drops it from the model', () => {
    const result = parsed('flowchart LR\n    A ~~~ B\n    B --> C')
    expect(boxes(result.data).map((b) => b.id)).toEqual(['A', 'B', 'C'])
    expect(edgeSummary(result.data)).toEqual([['B', 'C', 'arrow', '', false]])
    expect(result.retained).toEqual([{ line: 2, text: '    A ~~~ B', place: 'body' }])
    expect(result.problems).toEqual([{ code: 'FLOWCHART_SYNTAX_IGNORED', severity: 'ignored', message: 'The invisible link is kept as written and not drawn.', line: 2 }])
    expect(result.lossy).toEqual(['edge-style'])
  })
})

describe('parseMermaidFlowchart: tolerance', () => {
  it('turns an unknown statement into a problem and a retained line, and models the rest', () => {
    const result = parsed('flowchart LR\n    a --> b\n    a[unclosed\n    b --> c\n    x --> ; y --> z >>> q')
    expect(boxes(result.data).map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(edges(result.data)).toHaveLength(2)
    expect(result.problems).toEqual([
      { code: 'FLOWCHART_UNKNOWN_STATEMENT', severity: 'invalid', message: 'The statement could not be read and is kept as written.', line: 3 },
      { code: 'FLOWCHART_UNKNOWN_STATEMENT', severity: 'invalid', message: 'The statement could not be read and is kept as written.', line: 5 },
    ])
    expect(result.retained).toEqual([
      { line: 3, text: '    a[unclosed', place: 'body' },
      { line: 5, text: '    x --> ; y --> z >>> q', place: 'body' },
    ])
  })

  it('keeps nothing from a line that fails part way through', () => {
    const result = parsed('flowchart LR\n    a[Alpha] --> b[Beta] --> c[unclosed')
    expect(boxes(result.data)).toEqual([])
    expect(result.retained.map((line) => line.line)).toEqual([2])
  })

  it('turns a :::class suffix into a retained class line beside its statement', () => {
    const result = parsed('flowchart LR\n    A:::foo & B:::bar --> C:::foobar\n    classDef foo stroke:#f00')
    expect(boxes(result.data).map((b) => b.id)).toEqual(['A', 'B', 'C'])
    expect(result.retained).toEqual([
      { line: 2, text: '    class A foo', place: 'body' },
      { line: 2, text: '    class B bar', place: 'body' },
      { line: 2, text: '    class C foobar', place: 'body' },
      { line: 3, text: '    classDef foo stroke:#f00', place: 'body' },
    ])
    expect(result.problems).toEqual([])
  })

  it('retains comments, directives and non-title front-matter keys with their line numbers', () => {
    const result = parsed(`---
title: Flow
config:
  theme: base
---
%%{init: { "theme": "forest" } }%%
%% leading comment
flowchart LR
    a --> b %% trailing comment
    %% between
    b --> c`)
    expect(result.data.title).toBe('Flow')
    expect(edges(result.data)).toHaveLength(2)
    expect(result.retained).toEqual([
      { line: 3, text: 'config:', place: 'frontMatter' },
      { line: 4, text: '  theme: base', place: 'frontMatter' },
      { line: 6, text: '%%{init: { "theme": "forest" } }%%', place: 'body' },
      { line: 7, text: '%% leading comment', place: 'body' },
      { line: 9, text: '%% trailing comment', place: 'body' },
      { line: 10, text: '    %% between', place: 'body' },
    ])
    expect(result.problems).toEqual([])
    expect(result.lossy).toEqual([])
  })

  it('retains a directive that spans lines as those lines', () => {
    const result = parsed('%%{init: {\n  "theme": "forest"\n}}%%\nflowchart LR\n    a --> b')
    expect(result.retained.map((line) => [line.line, line.text])).toEqual([
      [1, '%%{init: {'],
      [2, '  "theme": "forest"'],
      [3, '}}%%'],
    ])
    expect(edges(result.data)).toHaveLength(1)
  })

  it('keeps @{ } node configs as written, drawing what it can, and reports them as ignored', () => {
    const result = parsed('flowchart TD\n    A@{ shape: cyl, label: "Database" }\n    B@{ shape: rect, label: "Process" } --> A\n    e1@{ animate: true }')
    expect(boxes(result.data).map((b) => [b.id, b.type, b.text])).toEqual([
      ['A', 'cylinder', 'Database'],
      ['B', 'rect', 'Process'],
    ])
    // The edge lives in its retained line, not in the model.
    expect(edges(result.data)).toEqual([])
    expect(result.retained.map((line) => line.line)).toEqual([2, 3, 4])
    expect(result.problems).toEqual([
      { code: 'FLOWCHART_SYNTAX_IGNORED', severity: 'ignored', message: 'The @{ } config on "A" is kept as written and not drawn.', line: 2 },
      { code: 'FLOWCHART_SYNTAX_IGNORED', severity: 'ignored', message: 'The @{ } config on "B" is kept as written and not drawn.', line: 3 },
      { code: 'FLOWCHART_SYNTAX_IGNORED', severity: 'ignored', message: 'The @{ } config on "e1" is kept as written and not drawn.', line: 4 },
    ])
  })

  it('keeps a config that spans lines and an edge id as retained lines', () => {
    const result = parsed('flowchart LR\n    A@{\n      shape: circle,\n      label: "Start"\n    }\n    A e1@--> B')
    expect(boxes(result.data).map((b) => [b.id, b.type, b.text])).toEqual([
      ['A', 'ellipse', 'Start'],
      ['B', 'rect', 'B'],
    ])
    expect(result.retained.map((line) => line.line)).toEqual([2, 3, 4, 5, 6])
    expect(result.problems.map((p) => [p.code, p.line, p.message])).toEqual([
      ['FLOWCHART_SYNTAX_IGNORED', 2, 'The @{ } config on "A" is kept as written and not drawn.'],
      ['FLOWCHART_SYNTAX_IGNORED', 6, 'The edge id "e1" is kept as written and not drawn.'],
    ])
  })

  it('names what an edit would flatten in lossy, once each, in a fixed order', () => {
    const result = parsed(`flowchart LR
      subgraph one
        a[/Lean/] --> b{{Hex}}
      end
      b -.-> c(((Double)))
      style a fill:#f9f,stroke-width:4px
      linkStyle 0 stroke:#f00
      c --o d`)
    expect(result.lossy).toEqual(['subgraph', 'edge-style', 'shape', 'linkStyle', 'style-property'])
    expect(result.problems).toEqual([])
    expect(result.retained).toEqual([])
  })

  it('does not call a bracket lossy when the writer emits the same one', () => {
    expect(parsed('flowchart LR\n    a[R] --> b([S]) --> c[[Q]] --> d[(C)] --> e{D} --> f>N]').lossy).toEqual([])
    expect(parsed('flowchart LR\n    a(Rounded)').lossy).toEqual(['shape'])
    expect(parsed('flowchart LR\n    a((Circle))').lossy).toEqual(['shape'])
  })

  it('reports a rejected layout annotation as FLOWCHART_LAYOUT_INVALID with its path and line', () => {
    const result = parsed('flowchart LR\n    a --> b\n    %% rmk-layout v1 {"nodes":{"a":{"x":"oops"}}}')
    expect(result.problems).toEqual([
      { code: 'FLOWCHART_LAYOUT_INVALID', severity: 'invalid', message: 'Expected a finite number.', line: 3, path: 'nodes.a.x' },
    ])
    expect(result.layoutProblem).toEqual({ message: 'Expected a finite number.', path: 'nodes.a.x' })
    expect(result.retained).toEqual([])
  })
})

describe('round trip through the %% rmk-layout annotation', () => {
  const original: DrawingData = {
    version: 3,
    canvasHeight: 260,
    canvasWidth: 640,
    width: 'text',
    title: 'Flow',
    description: 'How data moves',
    shapes: [
      { id: 'web', type: 'cloud', x: 40, y: 50, width: 170, height: 100, stroke: '#1971c2', fill: '#a5d8ff', strokeWidth: 3, label: 'CLIENT', text: 'Web App', footer: 'React' },
      { id: 'api1', type: 'rect', x: 330, y: 50, width: 170, height: 100, stroke: '#2f9e44', fill: 'transparent', strokeWidth: 2, text: 'API' },
      { id: 'e1', type: 'arrow', x: 216, y: 100, width: 108, height: 0, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2, startBinding: { id: 'web' }, endBinding: { id: 'api1', fixedPoint: [0, 0.5] }, text: 'REST', routing: 'elbow', elbow: 0.3, waypoints: [{ x: 270, y: 120 }] },
      { id: 'loose', type: 'line', x: 10, y: 200, width: 80, height: 0, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2 },
      { id: 't', type: 'text', x: 20, y: 230, width: 120, height: 20, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 1, text: 'Legend' },
    ],
  }

  it('keeps every field the drawing had', () => {
    const mermaid = drawingToMermaid(original)
    const back = data(mermaid)
    // Ids are sanitised for Mermaid (`api1` stays valid); everything else is identical.
    expect(back).toEqual(original)
  })

  it('is a fixed point: exporting the reparsed drawing gives the same text', () => {
    const once = drawingToMermaid(original)
    expect(drawingToMermaid(data(once))).toBe(once)
  })

  it('still renders as a plain flowchart for a reader without the comment', () => {
    const mermaid = drawingToMermaid(original)
    expect(mermaid).toContain('web(("CLIENT<br/>Web App<br/>React"))')
    expect(mermaid).toContain('web -->|REST| api1')
    expect(mermaid.split('\n').filter((line) => line.includes('%% rmk-layout'))).toHaveLength(1)
  })

  it('ids with hyphens survive write', () => {
    const source = 'flowchart LR\n    my-box[One] --> other-box-2[Two]\n    other-box-2 --> my-box'
    const written = drawingToMermaid(data(source))
    expect(written).toContain('my-box["One"]')
    expect(written).toContain('other-box-2["Two"]')
    expect(written).toContain('my-box --> other-box-2')
    expect(boxes(data(written)).map((b) => b.id)).toEqual(['my-box', 'other-box-2'])
  })

  it('re-emits retained lines so a second parse finds them again', () => {
    const source = '---\ntitle: T\nconfig:\n  theme: base\n---\nflowchart LR\n    A:::hot --> B\n    classDef hot fill:#f00\n    click A "https://example.com"'
    const first = parsed(source)
    const written = drawingToMermaid(first.data, { retained: first.retained })
    const second = parsed(written)
    expect(second.data).toEqual(first.data)
    expect(second.retained.map((line) => line.text)).toEqual(first.retained.map((line) => line.text))
    expect(drawingToMermaid(second.data, { retained: second.retained })).toBe(written)
  })
})

describe('the flowchart corpus (Mermaid docs examples, verbatim)', () => {
  const dir = join(__dirname, 'corpus', 'flowchart')
  const files = readdirSync(dir).filter((name) => name.endsWith('.mmd')).sort()

  it('has at least twelve examples', () => {
    expect(files.length).toBeGreaterThanOrEqual(12)
  })

  it.each(files)('%s parses with no invalid problem and round-trips through write', (file) => {
    const source = readFileSync(join(dir, file), 'utf8')
    const first = parsed(source)
    expect(first.problems.filter((p) => p.severity === 'invalid')).toEqual([])
    const written = drawingToMermaid(first.data, { retained: first.retained })
    for (const line of first.retained) expect(written.split('\n')).toContain(line.text)
    const second = parsed(written)
    expect(second.data).toEqual(first.data)
    expect(second.problems.filter((p) => p.severity === 'invalid')).toEqual([])
    expect(drawingToMermaid(second.data, { retained: second.retained })).toBe(written)
    expect(written.split('\n').filter((line) => line.includes('%% rmk-layout'))).toHaveLength(1)
  })
})
