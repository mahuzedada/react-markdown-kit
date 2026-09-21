/**
 * Mermaid flowchart in, DrawingData out, and back without loss.
 */
import { describe, expect, it } from 'vitest'
import {
  drawingToMermaid,
  isMermaidFlowchart,
  parseMermaidFlowchart,
  type DrawingData,
  type DrawingShape,
} from '../src/core/index.js'

function data(source: string): DrawingData {
  const parsed = parseMermaidFlowchart(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.data
}
const boxes = (d: DrawingData): DrawingShape[] => d.shapes.filter((s) => !['arrow', 'line', 'text'].includes(s.type))
const edges = (d: DrawingData): DrawingShape[] => d.shapes.filter((s) => s.type === 'arrow' || s.type === 'line')

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
    const es = edges(d)
    expect(es.map((e) => [e.startBinding?.id, e.endBinding?.id, e.type, e.text ?? '', e.bidirectional ?? false])).toEqual([
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

  it('reads through subgraphs, ignores classes and clicks, applies style colours', () => {
    const d = data(`flowchart TB
      subgraph api [API]
        direction LR
        web[Web] --> svc[Service]:::hot
      end
      classDef hot fill:#f00
      click web "https://example.com"
      style svc fill:#b2f2bb,stroke:#2f9e44
    `)
    expect(boxes(d).map((b) => b.id)).toEqual(['web', 'svc'])
    const svc = boxes(d)[1]
    expect(svc?.fill).toBe('#b2f2bb')
    expect(svc?.stroke).toBe('#2f9e44')
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

  it('lays the graph out top to bottom for TB and left to right for LR', () => {
    const lr = boxes(data('flowchart LR\n a --> b'))
    const tb = boxes(data('flowchart TB\n a --> b'))
    expect((lr[1]?.x ?? 0) > (lr[0]?.x ?? 0)).toBe(true)
    expect(lr[1]?.y).toBe(lr[0]?.y)
    expect((tb[1]?.y ?? 0) > (tb[0]?.y ?? 0)).toBe(true)
  })

  it('rejects other diagram types with a reason, never a throw', () => {
    expect(isMermaidFlowchart('sequenceDiagram\n  A->>B: hi')).toBe(false)
    expect(isMermaidFlowchart('%% comment\nflowchart LR\n a')).toBe(true)
    const parsed = parseMermaidFlowchart('sequenceDiagram\n  A->>B: hi')
    expect('error' in parsed && parsed.error).toMatch(/Not a Mermaid flowchart/)
    expect(parseMermaidFlowchart('flowchart LR\n a[unclosed')).toHaveProperty('error')
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
})
