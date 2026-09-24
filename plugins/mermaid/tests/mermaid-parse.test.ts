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
    ['-.->', 'arrow', false, false],
    ['-.-', 'line', false, false],
    ['==>', 'arrow', false, false],
    ['===', 'line', false, false],
    ['--o', 'arrow', false, false],
    ['--x', 'arrow', false, false],
    ['<==>', 'arrow', true, false],
    ['<-.->', 'arrow', true, false],
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
    ['-. text .->', 'arrow', false],
    ['== text ==>', 'arrow', false],
    ['-.->|text|', 'arrow', false],
    ['==>|text|', 'arrow', false],
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
    ['o--o', 'arrow', true, false],
    ['x--x', 'arrow', true, false],
    // Mermaid has no link with different heads at its two ends
    ['o--x', 'arrow', true, true],
  ] as const)('%s needs the space Mermaid needs, so the start marker is not read as part of the id', (token, type, bidirectional, lossy) => {
    const spaced = parsed(`flowchart LR\n    A ${token} B`)
    expect(edgeSummary(spaced.data)).toEqual([['A', 'B', type, '', bidirectional]])
    expect(spaced.lossy).toEqual(lossy ? ['edge-style'] : [])
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
    // Mermaid rejects a comment after a statement (C24); the statement is still read and the comment kept on its own line.
    expect(result.problems).toEqual([
      { code: 'FLOWCHART_TRAILING_COMMENT', severity: 'invalid', message: 'Mermaid reads a %% comment only on a line of its own; this one is kept on its own line.', line: 9 },
    ])
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
      b ---> c(((Double)))
      style a fill:#f9f,font-size:20px
      linkStyle 0 stroke:#f00
      c --o d`)
    expect(result.lossy).toEqual(['subgraph', 'edge-style', 'shape', 'linkStyle', 'style-property'])
    expect(result.problems).toEqual([])
    expect(result.retained).toEqual([])
  })

  it('does not call a bracket lossy when the writer emits the same one', () => {
    expect(parsed('flowchart LR\n    a[R] --> b([S]) --> c[[Q]] --> d[(C)] --> e{D} --> f>N]').lossy).toEqual([])
    expect(parsed('flowchart LR\n    a(Rounded)').lossy).toEqual([])
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

describe('review regressions: what Mermaid accepts is read, what it rejects is invalid', () => {
  const problems = (source: string) => parsed(source).problems.map((p) => [p.code, p.severity, p.line])
  const roundTrip = (source: string): FlowchartParse => {
    const first = parsed(source)
    const written = drawingToMermaid(first.data, { retained: first.retained })
    const second = parsed(written)
    expect(second.data).toEqual(first.data)
    expect(drawingToMermaid(second.data, { retained: second.retained })).toBe(written)
    return second
  }

  it('C0: a `;` inside a #NN; entity or a |label| does not end the statement', () => {
    const d = data('flowchart LR\n    A -->|a#124;b| B\n    C[a#59;b] --> D\n    E -->|a;b| F; G --> H')
    expect(edgeSummary(d)).toEqual([
      ['A', 'B', 'arrow', 'a|b', false],
      ['C', 'D', 'arrow', '', false],
      ['E', 'F', 'arrow', 'a;b', false],
      ['G', 'H', 'arrow', '', false],
    ])
    expect(boxes(d).find((b) => b.id === 'C')?.text).toBe('a;b')
    expect(parsed('flowchart LR\n    A -->|a#124;b| B').problems).toEqual([])
  })

  it('C0: edge text with | and ; survives write and parse, and the written text is a fixed point', () => {
    const shape = (id: string, x: number): DrawingShape => ({ id, type: 'rect', x, y: 32, width: 160, height: 90, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2 })
    for (const text of ['a|b', 'a;b', 'a | b; c']) {
      const model: DrawingData = {
        version: 3,
        canvasHeight: 154,
        shapes: [shape('A', 32), shape('B', 282), { id: 'c3', type: 'arrow', x: 198, y: 77, width: 78, height: 0, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2, text, startBinding: { id: 'A' }, endBinding: { id: 'B' } }],
      }
      const written = drawingToMermaid(model, { retained: [] })
      const back = parsed(written)
      expect(back.problems).toEqual([])
      expect(edges(back.data).map((e) => e.text)).toEqual([text])
      expect(drawingToMermaid(back.data, { retained: back.retained })).toBe(written)
    }
  })

  it('C1, C6: an out-of-range #NN; entity never throws; it reads as U+FFFD', () => {
    expect(() => parseMermaidFlowchart('flowchart LR\n    A["#9999999999;"] --> B')).not.toThrow()
    expect(boxes(data('flowchart LR\n    A["#99999999;"] --> B'))[0]?.text).toBe('�')
    expect(boxes(data('flowchart LR\n    A@{ label: "#9999999;" }'))[0]?.text).toBe('�')
  })

  it('C3, C8: a title that needs YAML quoting is written quoted and read back exactly', () => {
    for (const title of ['a: b', '[draft] plan', '*', 'C# service # comment', 'say "hi"', "it's"]) {
      const written = drawingToMermaid({ version: 3, canvasHeight: 154, title, shapes: [] }, { retained: [] })
      expect(data(written).title).toBe(title)
    }
    const quoted = roundTrip('---\ntitle: "a: b"\n---\nflowchart LR\n    A --> B')
    expect(quoted.data.title).toBe('a: b')
  })

  it('C7: text that looks like an entity, or holds & or %%{, comes back unchanged after write', () => {
    for (const text of ['PR #42; merged', 'Bug #123; fixed', '#quot; and &quot;', '%%{init: x}', 'a #124; b', '100%']) {
      const model: DrawingData = {
        version: 3,
        canvasHeight: 154,
        shapes: [{ id: 'a', type: 'rect', x: 0, y: 0, width: 100, height: 50, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2, text }],
      }
      const back = parsed(drawingToMermaid(model, { retained: [] }))
      expect(back.problems).toEqual([])
      expect(boxes(back.data)[0]?.text).toBe(text)
    }
  })

  it('C9: an unclosed @{ stops at a comment line, so the annotation is read and every write has one annotation', () => {
    const p1 = parsed('flowchart LR\n    A --> B\n    A@{ shape: rect')
    expect(p1.problems.map((p) => [p.code, p.line])).toEqual([['FLOWCHART_UNKNOWN_STATEMENT', 3]])
    const w1 = drawingToMermaid(p1.data, { retained: p1.retained })
    const p2 = parsed(w1)
    expect(p2.retained.map((line) => line.text)).toEqual(['    A@{ shape: rect'])
    expect(p2.layoutProblem).toBeUndefined()
    expect(p2.data).toEqual(p1.data)
    const w2 = drawingToMermaid(p2.data, { retained: p2.retained })
    expect(w2).toBe(w1)
    expect(w2.match(/rmk-layout/g)).toHaveLength(1)
    // The same when the unclosed config swallows a statement before the comment.
    const p3 = parsed('flowchart LR\n    A --> B\n    A@{ shape: rect\n    B --> C\n    %% note')
    expect(p3.retained.map((line) => line.text)).toEqual(['    A@{ shape: rect', '    B --> C', '    %% note'])
  })

  it('C9: an annotation inside a retained run of lines is never retained', () => {
    const result = parsed('flowchart LR\n    A --> B\n    %%{init: {\n    %% rmk-layout v1 {"canvasHeight":200}\n    }}%%')
    expect(result.retained.map((line) => line.text)).toEqual(['    %%{init: {', '    }}%%'])
    expect(result.data.canvasHeight).toBe(200)
  })

  it('C11, C16: a style line before its node colours it; one naming no node is kept as written', () => {
    const before = parsed('flowchart LR\n    style A fill:#f9f,stroke:#333\n    A --> B')
    expect(boxes(before.data)[0]?.fill).toBe('#f9f')
    expect(boxes(before.data)[0]?.stroke).toBe('#333')
    expect(before.problems).toEqual([])
    expect(before.retained).toEqual([])
    expect(drawingToMermaid(before.data, { retained: before.retained })).toContain('style A fill:#f9f,stroke:#333')

    const unknown = parsed('flowchart LR\n    A --> B\n    style X fill:#f00')
    expect(unknown.retained).toEqual([{ line: 3, text: '    style X fill:#f00', place: 'body' }])
    expect(unknown.problems).toEqual([
      { code: 'FLOWCHART_SYNTAX_IGNORED', severity: 'ignored', message: 'The style line for "X" names no node in the diagram and is kept as written.', line: 3 },
    ])
    expect(unknown.lossy).toEqual([])

    const list = parsed('flowchart LR\n    A --> B\n    style A,B fill:#f00')
    expect(boxes(list.data).map((b) => b.fill)).toEqual(['#f00', '#f00'])
    expect(list.problems).toEqual([])
    // Retained lines stay in source order even when a style line is decided at the end.
    const ordered = parsed('flowchart LR\n    style X fill:#f00\n    A --> B\n    click A "https://x"')
    expect(ordered.retained.map((line) => line.line)).toEqual([2, 4])
  })

  it('C11: `style` without properties is not a style line and is invalid', () => {
    expect(problems('flowchart LR\n    A --> B\n    style A')).toEqual([['FLOWCHART_UNKNOWN_STATEMENT', 'invalid', 3]])
  })

  it('C12: ids with Unicode letters, dots and colons read as ids and are written unchanged', () => {
    const cyrillic = parsed('flowchart TD\n    Пользователь --> Сервер')
    expect(boxes(cyrillic.data).map((b) => b.id)).toEqual(['Пользователь', 'Сервер'])
    expect(cyrillic.problems).toEqual([])
    const dotted = parsed('flowchart TD\n    api.gateway --> db')
    expect(edgeSummary(dotted.data)).toEqual([['api.gateway', 'db', 'arrow', '', false]])
    const mixed = parsed('flowchart TD\n    svc_1 --> svc-2 --> svc.3 --> svc:4\n    用户 --> 服务器')
    expect(boxes(mixed.data).map((b) => b.id)).toEqual(['svc_1', 'svc-2', 'svc.3', 'svc:4', '用户', '服务器'])
    expect(mixed.problems).toEqual([])
    const written = drawingToMermaid(mixed.data, { retained: [] })
    expect(written).toContain('svc.3 --> svc:4')
    expect(written).toContain('用户["用户"]')
    roundTrip('flowchart TD\n    svc_1 --> svc-2 --> svc.3 --> svc:4\n    Пользователь --> Сервер')
    // The id still ends before every link token and before a class suffix.
    expect(boxes(data('flowchart LR\n    A-.->B\n    C:::hot --> D\n    E---F')).map((b) => b.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('C13: unquoted delimiters in a bracket or pipe label are invalid, and the node stays', () => {
    for (const [source, expected] of [
      ['flowchart TD\n    A[Compute f(x)] --> B', 'Compute f(x)'],
      ['flowchart TD\n    A[Set {x}] --> B', 'Set {x}'],
      ['flowchart TD\n    A[say "hi"] --> B', 'say "hi"'],
      ['flowchart TD\n    A[a | b] --> B', 'a | b'],
    ] as const) {
      const result = parsed(source)
      expect(boxes(result.data).map((b) => b.text)).toEqual([expected, 'B'])
      expect(edges(result.data)).toHaveLength(1)
      expect(result.retained).toEqual([])
      expect(result.problems).toEqual([
        { code: 'FLOWCHART_LABEL_NEEDS_QUOTES', severity: 'invalid', message: 'Mermaid rejects the label of "A" as written; wrap it in quotes.', line: 2 },
      ])
      // The writer quotes the label, so the written source is valid and the problem is gone.
      expect(parsed(drawingToMermaid(result.data, { retained: result.retained })).problems).toEqual([])
    }
    const pipe = parsed('flowchart TD\n    A -->|ok (200)| B\n    C -->|a [b]| D')
    expect(edgeSummary(pipe.data)).toEqual([['A', 'B', 'arrow', 'ok (200)', false], ['C', 'D', 'arrow', 'a [b]', false]])
    expect(pipe.problems).toEqual([
      { code: 'FLOWCHART_LABEL_NEEDS_QUOTES', severity: 'invalid', message: 'Mermaid rejects the label on the link from "A" as written; wrap it in quotes.', line: 2 },
      { code: 'FLOWCHART_LABEL_NEEDS_QUOTES', severity: 'invalid', message: 'Mermaid rejects the label on the link from "C" as written; wrap it in quotes.', line: 3 },
    ])
    // `-- text -->` takes parentheses and brackets; only a quote breaks it.
    expect(parsed('flowchart TD\n    A -- ok (200) [b] --> B').problems).toEqual([])
    expect(problems('flowchart TD\n    A -- say "hi" --> B')).toEqual([['FLOWCHART_LABEL_NEEDS_QUOTES', 'invalid', 2]])
    // Quoted labels and < > are fine.
    expect(parsed('flowchart TD\n    A["f(x)"] --> B\n    B -->|"ok (200)"| C\n    C[a < b > c]').problems).toEqual([])
  })

  it('C13: an empty label is invalid and keeps the node; a space is a label', () => {
    for (const source of ['flowchart TD\n    A[] --> B', 'flowchart TD\n    A[""] --> B', 'flowchart TD\n    A() --> B']) {
      const result = parsed(source)
      expect(boxes(result.data).map((b) => [b.id, b.text])).toEqual([['A', undefined], ['B', 'B']])
      expect(edges(result.data)).toHaveLength(1)
      expect(result.problems.map((p) => [p.code, p.severity, p.line])).toEqual([['FLOWCHART_LABEL_EMPTY', 'invalid', 2]])
    }
    expect(parsed('flowchart TD\n    A[ ] --> B').problems).toEqual([])
    expect(parsed('flowchart TD\n    A -->| | B').problems).toEqual([])
    expect(problems('flowchart TD\n    A -->|| B')).toEqual([['FLOWCHART_LABEL_EMPTY', 'invalid', 2]])
  })

  it('C13, C24: a %% comment after a statement or the header is invalid, read, and kept on its own line', () => {
    const result = parsed('flowchart TD %% main\n    A --> B %% comment')
    expect(edgeSummary(result.data)).toEqual([['A', 'B', 'arrow', '', false]])
    expect(result.problems.map((p) => [p.code, p.severity, p.line])).toEqual([
      ['FLOWCHART_TRAILING_COMMENT', 'invalid', 1],
      ['FLOWCHART_TRAILING_COMMENT', 'invalid', 2],
    ])
    expect(result.retained).toEqual([
      { line: 1, text: '%% main', place: 'body' },
      { line: 2, text: '%% comment', place: 'body' },
    ])
    const written = drawingToMermaid(result.data, { retained: result.retained })
    expect(written.split('\n')).toContain('%% comment')
    expect(parsed(written).problems).toEqual([])
    // A line that is kept keeps its code only; the comment is its own line.
    const kept = parsed('flowchart TD\n    A --> ; B %% why')
    expect(kept.retained).toEqual([
      { line: 2, text: '    A --> ; B', place: 'body' },
      { line: 2, text: '%% why', place: 'body' },
    ])
  })

  it('C14: a quoted label spanning lines is one statement with a line break; a markdown string loses its markers', () => {
    const multi = parsed('flowchart TD\n    A["First line\n    second line"] --> B')
    expect(boxes(multi.data).map((b) => [b.id, b.text])).toEqual([['A', 'First line\nsecond line'], ['B', 'B']])
    expect(edges(multi.data)).toHaveLength(1)
    expect(multi.problems).toEqual([])
    expect(multi.lossy).toEqual([])
    roundTrip('flowchart TD\n    A["First line\n    second line"] --> B')

    const md = parsed('flowchart LR\n    A["`**Bold** text`"] --> B')
    expect(boxes(md.data)[0]?.text).toBe('Bold text')
    expect(md.problems).toEqual([])
    expect(md.lossy).toEqual(['markdown-string'])

    const mdMulti = parsed('flowchart LR\n    A("`The **cat**\n    in the _hat_`") -- "`edge *label*`" --> B{{"`The **dog** in the hog`"}}')
    expect(boxes(mdMulti.data).map((b) => b.text)).toEqual(['The cat\nin the hat', 'The dog in the hog'])
    expect(edgeSummary(mdMulti.data)).toEqual([['A', 'B', 'arrow', 'edge label', false]])
    expect(mdMulti.lossy).toEqual(['shape', 'markdown-string'])
    // Underscores inside words are not emphasis.
    expect(boxes(data('flowchart LR\n    A["`snake_case_name`"]'))[0]?.text).toBe('snake_case_name')
  })

  it('C15: an end without a subgraph is invalid and kept as written', () => {
    const result = parsed('flowchart LR\n    A --> B\n    end')
    expect(result.problems).toEqual([
      { code: 'FLOWCHART_UNKNOWN_STATEMENT', severity: 'invalid', message: 'The statement could not be read and is kept as written.', line: 3 },
    ])
    expect(result.retained).toEqual([{ line: 3, text: '    end', place: 'body' }])
    expect(problems('flowchart LR\n    subgraph one\n    A --> B\n    end\n    end')).toEqual([['FLOWCHART_UNKNOWN_STATEMENT', 'invalid', 5]])
    expect(parsed('flowchart LR\n    subgraph one\n    A --> B\n    end').problems).toEqual([])
  })

  it('C17: a trailing %% rmk-layout comment is read as the annotation, never retained', () => {
    const result = parsed('flowchart LR\n    A --> B %% rmk-layout v1 {"canvasHeight":200}')
    expect(result.retained).toEqual([])
    expect(result.data.canvasHeight).toBe(200)
    expect(result.problems.map((p) => p.code)).toEqual(['FLOWCHART_TRAILING_COMMENT'])
    const written = drawingToMermaid(result.data, { retained: result.retained })
    expect(written.match(/rmk-layout v1/g)).toHaveLength(1)
    expect(parsed(written).problems).toEqual([])
  })

  it('C18, C23: a top-level direction before any node is the direction; after one it is kept as written and ignored', () => {
    const before = parsed('flowchart LR\n    direction TB\n    A --> B')
    expect(before.problems).toEqual([])
    expect(before.retained).toEqual([])
    const [a, b] = boxes(before.data)
    expect((b?.y ?? 0) > (a?.y ?? 0)).toBe(true)
    expect(b?.x).toBe(a?.x)

    const after = parsed('flowchart LR\n    A --> B\n    direction TB')
    expect(after.problems).toEqual([
      { code: 'FLOWCHART_SYNTAX_IGNORED', severity: 'ignored', message: 'The direction statement after the first node is kept as written and not applied.', line: 3 },
    ])
    expect(after.retained).toEqual([{ line: 3, text: '    direction TB', place: 'body' }])
    // Mermaid rejects a lowercase direction; `direction` alone is a node id.
    expect(problems('flowchart LR\n    direction tb\n    A --> B')).toEqual([['FLOWCHART_UNKNOWN_STATEMENT', 'invalid', 2]])
    expect(boxes(data('flowchart LR\n    direction --> B')).map((b) => b.id)).toEqual(['direction', 'B'])
  })

  it('C24: Mermaid keywords cannot name a node; the line is invalid and kept as written', () => {
    for (const id of ['end', 'subgraph', 'graph', 'flowchart', 'style', 'classDef', 'class', 'click', 'linkStyle']) {
      const result = parsed(`flowchart LR\n    A --> ${id}`)
      expect(result.problems).toEqual([
        { code: 'FLOWCHART_RESERVED_ID', severity: 'invalid', message: `"${id}" is a Mermaid keyword and cannot name a node; the line is kept as written.`, line: 2 },
      ])
      expect(result.retained).toEqual([{ line: 2, text: `    A --> ${id}`, place: 'body' }])
      expect(boxes(result.data)).toEqual([])
    }
    expect(problems('flowchart LR\n    end --> B')).toEqual([['FLOWCHART_RESERVED_ID', 'invalid', 2]])
    // Case matters, and `direction`, `default` and words containing a keyword are ids.
    expect(boxes(data('flowchart LR\n    start --> End --> END --> endpoint --> direction --> default')).map((b) => b.id)).toEqual(['start', 'End', 'END', 'endpoint', 'direction', 'default'])
  })

  it('C25: a quoted edge label may hold -- and |', () => {
    const d = data('flowchart LR\n    A -- "x -- y" --> C\n    A -->|"a | b"| B\n    C -. "p -- q" .-> D')
    expect(edgeSummary(d)).toEqual([
      ['A', 'C', 'arrow', 'x -- y', false],
      ['A', 'B', 'arrow', 'a | b', false],
      ['C', 'D', 'arrow', 'p -- q', false],
    ])
    expect(parsed('flowchart LR\n    A -- "x -- y" --> C\n    A -->|"a | b"| B').problems).toEqual([])
    roundTrip('flowchart LR\n    A -- "x -- y" --> C\n    A -->|"a | b"| B')
  })

  it('C28: a wrong-case direction is named as such, with the directions Mermaid takes', () => {
    expect(parseMermaidFlowchart('graph td\n    A --> B')).toEqual({
      error: 'Unknown direction "td" after "graph"; Mermaid directions are TB, TD, BT, LR, RL (case-sensitive).',
      line: 1,
    })
    expect(parseMermaidFlowchart('flowchart Td\n    A --> B')).toMatchObject({ error: expect.stringContaining('Unknown direction "Td"'), line: 1 })
    expect(parseMermaidFlowchart('flowchart-elk lr\n    A --> B')).toMatchObject({ error: expect.stringContaining('Unknown direction "lr" after "flowchart-elk"') })
    expect(parseMermaidFlowchart('Flowchart LR\n  a --> b')).toMatchObject({ error: expect.stringMatching(/Not a Mermaid flowchart/), line: 1 })
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

describe('parseMermaidFlowchart: stroke styles, heads, corners and text colour', () => {
  const style = (s: DrawingShape) => ({
    strokeWidth: s.strokeWidth,
    strokeStyle: s.strokeStyle,
    head: s.head,
    bidirectional: s.bidirectional,
  })

  it.each([
    ['-->', { strokeWidth: 2, strokeStyle: undefined, head: undefined, bidirectional: undefined }],
    ['-.->', { strokeWidth: 2, strokeStyle: 'dotted', head: undefined, bidirectional: undefined }],
    ['==>', { strokeWidth: 4, strokeStyle: undefined, head: undefined, bidirectional: undefined }],
    ['--o', { strokeWidth: 2, strokeStyle: undefined, head: 'circle', bidirectional: undefined }],
    ['--x', { strokeWidth: 2, strokeStyle: undefined, head: 'cross', bidirectional: undefined }],
    ['o--o', { strokeWidth: 2, strokeStyle: undefined, head: 'circle', bidirectional: true }],
    ['<-.->', { strokeWidth: 2, strokeStyle: 'dotted', head: undefined, bidirectional: true }],
    ['-. text .->', { strokeWidth: 2, strokeStyle: 'dotted', head: undefined, bidirectional: undefined }],
    ['== text ==>', { strokeWidth: 4, strokeStyle: undefined, head: undefined, bidirectional: undefined }],
  ] as const)('reads %s as its stroke and head', (token, expected) => {
    const [edge] = edges(data(`flowchart LR\n    A ${token} B`))
    expect(style(edge as DrawingShape)).toEqual(expected)
  })

  it('reads a line link token as a styled line without a head', () => {
    expect(edges(data('flowchart LR\n    A -.- B')).map(style)).toEqual([{ strokeWidth: 2, strokeStyle: 'dotted', head: undefined, bidirectional: undefined }])
    expect(edges(data('flowchart LR\n    A === B')).map(style)).toEqual([{ strokeWidth: 4, strokeStyle: undefined, head: undefined, bidirectional: undefined }])
  })

  it('reads stroke-width, stroke-dasharray and color from a style line', () => {
    const d = data(`flowchart LR
      a[A] --> b[B] --> c[C] --> e[E]
      style a stroke-width:4px,stroke-dasharray: 5 5,color:#ff0000
      style b stroke-width:1,stroke-dasharray:2 4
      style c stroke-dasharray:none`)
    expect(boxes(d).map((b) => [b.id, b.strokeWidth, b.strokeStyle, b.color])).toEqual([
      ['a', 4, 'dashed', '#ff0000'],
      ['b', 1, 'dotted', undefined],
      ['c', 2, undefined, undefined],
      ['e', 2, undefined, undefined],
    ])
    expect(parsed('flowchart LR\n    a --> b\n    style a stroke-width:4px,stroke-dasharray:5 5,color:#fff').lossy).toEqual([])
  })

  it('reads [text] as a square rectangle and (text) as a rounded one', () => {
    const d = data('flowchart LR\n    a[Square] --> b(Round) --> c')
    expect(boxes(d).map((b) => [b.id, b.type, b.corners])).toEqual([
      ['a', 'rect', 'sharp'],
      ['b', 'rect', undefined],
      ['c', 'rect', 'sharp'],
    ])
  })

  it('writes every option back as Mermaid and reads the same drawing', () => {
    const shape = (id: string, extra: Partial<DrawingShape>): DrawingShape => ({
      id, type: 'rect', x: 0, y: 0, width: 160, height: 90, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2, ...extra,
    })
    const link = (id: string, from: string, to: string, extra: Partial<DrawingShape>): DrawingShape => ({
      id, type: 'arrow', x: 0, y: 0, width: 100, height: 0, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2,
      startBinding: { id: from }, endBinding: { id: to }, ...extra,
    })
    const original: DrawingData = {
      version: 3,
      canvasHeight: 400,
      shapes: [
        shape('a', { corners: 'sharp', strokeWidth: 4, strokeStyle: 'dashed', color: '#c2255c', fill: '#fff0f6' }),
        shape('b', { strokeWidth: 1, strokeStyle: 'dotted' }),
        shape('c', { type: 'ellipse', color: '#0b7285' }),
        link('e1', 'a', 'b', { strokeStyle: 'dashed' }),
        link('e2', 'b', 'c', { strokeWidth: 4, head: 'circle', bidirectional: true }),
        link('e3', 'a', 'c', { strokeWidth: 1, head: 'cross' }),
        link('e4', 'c', 'a', { type: 'line', strokeWidth: 4, strokeStyle: 'dotted' }),
      ],
    }
    const source = drawingToMermaid(original)
    expect(source.split('\n').slice(1, 12)).toEqual([
      '    a["a"]',
      '    b("b")',
      '    c(["c"])',
      '    a -.-> b',
      '    b o==o c',
      '    a --x c',
      '    c -.- a',
      '    style a fill:#fff0f6,stroke-width:4px,stroke-dasharray:8 6,color:#c2255c',
      '    style b fill:transparent,stroke-width:1px,stroke-dasharray:2 4',
      '    style c fill:transparent,color:#0b7285',
      expect.stringMatching(/^ {4}%% rmk-layout v1 /),
    ])
    const read = data(source)
    const pick = (s: DrawingShape) => [s.id, s.corners, s.strokeWidth, s.strokeStyle, s.color, s.head, s.bidirectional, s.type]
    expect(read.shapes.map(pick)).toEqual(original.shapes.map(pick))
  })

  it('lets an edited link token win the class and keeps the annotation refinement within it', () => {
    const annotated = (token: string, edge: object) =>
      edges(data(`flowchart LR\n    a --> b\n    a ${token} b\n    %% rmk-layout v1 {"edges":{"a->b#2":${JSON.stringify(edge)}}}`))[1] as DrawingShape
    // A dashed pattern survives only while the token is still dotted
    expect(annotated('-.->', { strokeStyle: 'dashed' }).strokeStyle).toBe('dashed')
    expect(annotated('-->', { strokeStyle: 'dashed' }).strokeStyle).toBeUndefined()
    // Thin stays thin on a normal token; a thick token makes it bold
    expect(annotated('-->', { strokeWidth: 1 }).strokeWidth).toBe(1)
    expect(annotated('==>', { strokeWidth: 1 }).strokeWidth).toBe(4)
    expect(annotated('-->', { strokeWidth: 4 }).strokeWidth).toBe(2)
    // A dotted token has no thick form: the annotated width stands
    expect(annotated('-.->', { strokeWidth: 4 }).strokeWidth).toBe(4)
  })
})
