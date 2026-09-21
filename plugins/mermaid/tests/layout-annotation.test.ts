/**
 * The `%% rmk-layout v1` annotation against LAYOUT_ANNOTATION.md: grammar,
 * fail-closed validation with paths, keyed edges, slots, compatibility
 * rules, the canonical writer and the diagnostic the extension reports.
 */
import { describe, expect, it } from 'vitest'
import { compileMarkdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'
import {
  drawingToMermaid,
  edgeKeys,
  parseMermaidFlowchart,
  readLayoutAnnotation,
  writeLayoutAnnotation,
  LAYOUT_ANNOTATION_JSON_SCHEMA,
  LAYOUT_ANNOTATION_MARKER,
  LAYOUT_ANNOTATION_VERSION,
  type DrawingData,
  type DrawingShape,
  type LayoutAnnotation,
} from '../src/core/index.js'
import { mermaid } from '../src/index.js'

const shape = (id: string, type: DrawingShape['type'], extra: Partial<DrawingShape> = {}): DrawingShape => ({
  id, type, x: 0, y: 0, width: 100, height: 60, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2, ...extra,
})
const line = (payload: string, version = 1): string => `%% ${LAYOUT_ANNOTATION_MARKER} v${version} ${payload}`
const withLayout = (body: string, payload: string): string => `flowchart LR\n${body}\n    ${line(payload)}\n`

function parsed(source: string) {
  const result = parseMermaidFlowchart(source)
  if ('error' in result) throw new Error(result.error)
  return result
}
const problem = (source: string) => parsed(source).layoutProblem
const invalidRead = (text: string) => {
  const read = readLayoutAnnotation(text)
  return read.kind === 'invalid' ? read.problem : undefined
}

describe('readLayoutAnnotation: line grammar', () => {
  it('ignores ordinary comments and reads a well-formed line', () => {
    expect(readLayoutAnnotation('%% just a note')).toEqual({ kind: 'none' })
    expect(readLayoutAnnotation('%% rmk-layouts are not ours')).toEqual({ kind: 'none' })
    expect(readLayoutAnnotation(`  ${line('{"canvasHeight":200}')}  `)).toEqual({
      kind: 'annotation',
      annotation: { canvasHeight: 200 },
    })
    expect(readLayoutAnnotation(`%%   ${LAYOUT_ANNOTATION_MARKER}   v1   {}`)).toEqual({ kind: 'annotation', annotation: {} })
  })

  it('rejects a marker without version or object, and an object that does not end the line', () => {
    expect(invalidRead(`%% ${LAYOUT_ANNOTATION_MARKER} {}`)?.message).toMatch(/v<major>/)
    expect(invalidRead(`%% ${LAYOUT_ANNOTATION_MARKER} v1`)?.message).toMatch(/v<major>/)
    expect(invalidRead(`%% ${LAYOUT_ANNOTATION_MARKER} v1 {} trailing`)?.message).toMatch(/v<major>/)
    expect(invalidRead(`%% ${LAYOUT_ANNOTATION_MARKER} v1 []`)?.message).toMatch(/v<major>/)
  })

  it('rejects other major versions instead of guessing', () => {
    expect(invalidRead(line('{}', 2))?.message).toMatch(/supports version 1/)
    expect(invalidRead(line('{}', 0))?.message).toMatch(/supports version 1/)
    expect(LAYOUT_ANNOTATION_VERSION).toBe(1)
  })

  it('rejects invalid JSON with a message that carries no content', () => {
    const read = invalidRead(line('{"canvasHeight":}'))
    expect(read?.message).toBe('The layout annotation is not valid JSON.')
    expect(read?.path).toBeUndefined()
  })
})

describe('readLayoutAnnotation: validation is fail-closed with a path', () => {
  it.each([
    ['{"canvasHeight":"260"}', 'canvasHeight', /finite number/],
    ['{"canvasWidth":null}', 'canvasWidth', /finite number/],
    ['{"width":"wide"}', 'width', /"full", "text", "content"/],
    ['{"description":1}', 'description', /string/],
    ['{"nodes":[]}', 'nodes', /object keyed by id/],
    ['{"nodes":{"web":3}}', 'nodes.web', /object/],
    ['{"nodes":{"web":{"x":"40"}}}', 'nodes.web.x', /finite number/],
    ['{"nodes":{"web":{"type":"diamond"}}}', 'nodes.web.type', /"cloud", "actor"/],
    ['{"nodes":{"web":{"slots":"label"}}}', 'nodes.web.slots', /array/],
    ['{"nodes":{"web":{"slots":["title"]}}}', 'nodes.web.slots.0', /"label", "text", "footer"/],
    ['{"nodes":{"web":{"slots":["label","label"]}}}', 'nodes.web.slots.1', /once/],
    ['{"edges":[]}', 'edges', /object keyed by id/],
    ['{"edges":{"a->b":{"routing":"straight"}}}', 'edges.a->b.routing', /"elbow"/],
    ['{"edges":{"a->b":{"elbow":"0.5"}}}', 'edges.a->b.elbow', /finite number/],
    ['{"edges":{"a->b":{"waypoints":[{"x":1}]}}}', 'edges.a->b.waypoints.0', /numeric "x" and "y"/],
    ['{"edges":{"a->b":{"start":{"fixedPoint":[1]}}}}', 'edges.a->b.start.fixedPoint', /two numbers/],
    ['{"edges":{"a->b":{"end":{"mode":"glue"}}}}', 'edges.a->b.end.mode', /"orbit", "inside"/],
    ['{"texts":{}}', 'texts', /array/],
    ['{"texts":[{"id":"t","type":"rect","x":0,"y":0,"width":1,"height":1}]}', 'texts.0.type', /"text" shape/],
    ['{"texts":[{"id":"","type":"text","x":0,"y":0,"width":1,"height":1}]}', 'texts.0.id', /non-empty string/],
    ['{"loose":[{"id":"l","type":"text","x":0,"y":0,"width":1,"height":1}]}', 'loose.0.type', /"arrow" or "line"/],
    ['{"loose":[{"id":"l","type":"line","x":0,"y":0,"width":1}]}', 'loose.0.height', /finite number/],
  ])('%s → %s', (payload, path, message) => {
    const read = invalidRead(line(payload))
    expect(read?.path).toBe(path)
    expect(read?.message).toMatch(message)
  })

  it('rejects the whole annotation on the first problem; nothing is applied', () => {
    const result = parsed(withLayout('    a --> b', '{"canvasHeight":900,"nodes":{"a":{"x":"oops"}}}'))
    expect(result.layoutProblem).toEqual({ message: 'Expected a finite number.', path: 'nodes.a.x' })
    expect(result.data.canvasHeight).not.toBe(900)
  })

  it('ignores members it does not know, so a minor revision can add fields', () => {
    const read = readLayoutAnnotation(line('{"canvasHeight":200,"future":true,"nodes":{"a":{"x":1,"glow":3}},"edges":{"a->b":{"dash":true}}}'))
    expect(read).toEqual({ kind: 'annotation', annotation: { canvasHeight: 200, nodes: { a: { x: 1 } }, edges: { 'a->b': {} } } })
  })

  it('ignores entries for nodes and edges that are not in the graph', () => {
    const result = parsed(withLayout('    a --> b', '{"nodes":{"gone":{"x":5}},"edges":{"b->a":{"routing":"elbow"}}}'))
    expect(result.layoutProblem).toBeUndefined()
    expect(result.data.shapes.map((s) => s.id)).not.toContain('gone')
    expect(result.data.shapes.find((s) => s.type === 'arrow')?.routing).toBeUndefined()
  })

  it('rejects a block with more than one annotation', () => {
    const source = `flowchart LR\n    a --> b\n    ${line('{"canvasHeight":200}')}\n    ${line('{"canvasHeight":300}')}\n`
    expect(problem(source)?.message).toMatch(/one layout annotation/)
    expect(parsed(source).data.canvasHeight).not.toBe(300)
  })

  it('reads the annotation from any line of the body', () => {
    const source = `flowchart LR\n    ${line('{"canvasHeight":222}')}\n    a --> b\n`
    expect(parsed(source).data.canvasHeight).toBe(222)
  })
})

describe('edges are keyed by endpoints, not by position', () => {
  it('names the n-th edge between the same nodes with #n', () => {
    expect(edgeKeys([{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'a', to: 'b' }, { from: 'a', to: 'b' }])).toEqual([
      'a->b',
      'b->a',
      'a->b#2',
      'a->b#3',
    ])
  })

  it('keeps geometry on the right edge after a human inserts an edge above it', () => {
    const payload = '{"edges":{"b->c":{"routing":"elbow","elbow":0.25,"stroke":"#e03131"}}}'
    const before = parsed(withLayout('    a --> b\n    b --> c', payload)).data
    const after = parsed(withLayout('    a --> b\n    a --> c\n    b --> c', payload)).data
    const bc = (d: DrawingData) => d.shapes.find((s) => s.startBinding?.id === 'b' && s.endBinding?.id === 'c')
    const ac = after.shapes.find((s) => s.startBinding?.id === 'a' && s.endBinding?.id === 'c')
    expect(bc(before)?.routing).toBe('elbow')
    expect(bc(after)?.routing).toBe('elbow')
    expect(bc(after)?.elbow).toBe(0.25)
    expect(bc(after)?.stroke).toBe('#e03131')
    expect(ac?.routing).toBeUndefined()
  })

  it('anchors take the node id from the syntax and only add the attach point', () => {
    const d = parsed(withLayout('    a --> b', '{"edges":{"a->b":{"start":{"fixedPoint":[1,0.5]},"end":{"fixedPoint":[0,0.5],"mode":"inside"}}}}')).data
    const edge = d.shapes.find((s) => s.type === 'arrow')
    expect(edge?.startBinding).toEqual({ id: 'a', fixedPoint: [1, 0.5] })
    expect(edge?.endBinding).toEqual({ id: 'b', fixedPoint: [0, 0.5], mode: 'inside' })
  })
})

describe('slots: the syntax carries the text, the annotation says which slots it fills', () => {
  it('splits label, text and footer lines by the slot list', () => {
    const box = (slots: string, text = 'One<br/>Two<br/>Three') =>
      parsed(withLayout(`    a["${text}"]`, `{"nodes":{"a":{"slots":${slots}}}}`)).data.shapes[0]
    expect(box('["label","text","footer"]')).toMatchObject({ label: 'One', text: 'Two', footer: 'Three' })
    expect(box('["label","text"]')).toMatchObject({ label: 'One', text: 'Two\nThree' })
    expect(box('["text","footer"]')).toMatchObject({ text: 'One\nTwo', footer: 'Three' })
    expect(box('["label"]', 'Only')).toMatchObject({ label: 'Only' })
    expect(box('["label"]', 'Only')?.text).toBeUndefined()
  })

  it('without slots everything is text; with an empty list the node has no text', () => {
    expect(parsed('flowchart LR\n    a["One<br/>Two"]\n').data.shapes[0]).toMatchObject({ text: 'One\nTwo' })
    const empty = parsed(withLayout('    a["a"]', '{"nodes":{"a":{"slots":[]}}}')).data.shapes[0]
    expect(empty?.text).toBeUndefined()
    expect(empty?.label).toBeUndefined()
  })

  it('a box with no text round-trips without gaining its id as text', () => {
    const original: DrawingData = { version: 3, canvasHeight: 200, shapes: [shape('empty', 'rect')] }
    expect(parsed(drawingToMermaid(original)).data).toEqual(original)
  })
})

describe('colours live in the syntax only', () => {
  it('the annotation carries no node colours; an edited style line is what the canvas shows', () => {
    const data: DrawingData = { version: 3, canvasHeight: 200, shapes: [shape('a', 'rect', { fill: '#a5d8ff', stroke: '#1971c2' })] }
    const out = drawingToMermaid(data)
    const annotation = out.split('\n').find((l) => l.includes(LAYOUT_ANNOTATION_MARKER)) ?? ''
    expect(annotation).not.toContain('#a5d8ff')
    expect(out).toContain('style a fill:#a5d8ff,stroke:#1971c2')
    const edited = out.replace('style a fill:#a5d8ff,stroke:#1971c2', 'style a fill:#ffc9c9,stroke:#e03131')
    expect(parsed(edited).data.shapes[0]).toMatchObject({ fill: '#ffc9c9', stroke: '#e03131' })
  })
})

describe('writeLayoutAnnotation: canonical form', () => {
  it('is marker, version and compact JSON with numbers to two decimals', () => {
    const annotation: LayoutAnnotation = { canvasHeight: 200.004, nodes: { a: { x: 1.23456, y: 2 } }, edges: {} }
    expect(writeLayoutAnnotation(annotation)).toBe('%% rmk-layout v1 {"canvasHeight":200,"nodes":{"a":{"x":1.23,"y":2}},"edges":{}}')
  })

  it('the exporter writes members in the documented order and omits what is absent', () => {
    const data: DrawingData = {
      version: 3,
      canvasHeight: 200,
      shapes: [
        shape('a', 'rect', { text: 'A', label: 'L' }),
        shape('b', 'cloud', { text: 'B', x: 200 }),
        shape('e', 'arrow', { startBinding: { id: 'a' }, endBinding: { id: 'b', fixedPoint: [0, 0.5] }, routing: 'elbow' }),
      ],
    }
    const last = drawingToMermaid(data).trim().split('\n').pop()
    expect(last).toBe(
      '    %% rmk-layout v1 {"canvasHeight":200,"nodes":{' +
        '"a":{"x":0,"y":0,"width":100,"height":60,"strokeWidth":2,"slots":["label","text"]},' +
        '"b":{"x":200,"y":0,"width":100,"height":60,"strokeWidth":2,"type":"cloud"}},' +
        '"edges":{"a->b":{"id":"e","x":0,"y":0,"width":100,"height":60,"stroke":"#1e1e1e","fill":"transparent","strokeWidth":2,"routing":"elbow","end":{"fixedPoint":[0,0.5]}}}}',
    )
  })

  it('every member the exporter emits is declared in the JSON Schema', () => {
    const data: DrawingData = {
      version: 3,
      canvasHeight: 260,
      canvasWidth: 640,
      width: 'text',
      description: 'd',
      shapes: [
        shape('a', 'actor', { text: 'A', label: 'L', footer: 'F', strokeWidth: 3 }),
        shape('b', 'rect', { text: 'B', x: 300 }),
        shape('e', 'arrow', { startBinding: { id: 'a', fixedPoint: [1, 0.5], mode: 'orbit' }, endBinding: { id: 'b' }, routing: 'elbow', elbow: 0.4, waypoints: [{ x: 1, y: 2 }] }),
        shape('l', 'line', { startBinding: { id: 'a' } }),
        shape('t', 'text', { text: 'note' }),
      ],
    }
    const last = drawingToMermaid(data).trim().split('\n').pop() ?? ''
    const read = readLayoutAnnotation(last.trim())
    expect(read.kind).toBe('annotation')
    if (read.kind !== 'annotation') return
    const schema = LAYOUT_ANNOTATION_JSON_SCHEMA
    const keysOf = (o: object) => Object.keys(o)
    expect(keysOf(read.annotation).every((k) => k in schema.properties)).toBe(true)
    for (const node of Object.values(read.annotation.nodes ?? {})) {
      expect(keysOf(node).every((k) => k in schema.definitions.node.properties)).toBe(true)
    }
    for (const edge of Object.values(read.annotation.edges ?? {})) {
      expect(keysOf(edge).every((k) => k in schema.definitions.edge.properties)).toBe(true)
      for (const anchor of [edge.start, edge.end]) {
        if (anchor !== undefined) expect(keysOf(anchor).every((k) => k in schema.definitions.anchor.properties)).toBe(true)
      }
    }
    for (const s of [...(read.annotation.texts ?? []), ...(read.annotation.loose ?? [])]) {
      expect(keysOf(s).every((k) => k in schema.definitions.shape.properties)).toBe(true)
    }
    expect(schema.title).toBe('RmkLayoutAnnotation')
    expect(schema.additionalProperties).toBe(false)
  })
})

describe('the extension reports a rejected annotation as DIAGRAM_LAYOUT_INVALID', () => {
  const preset = defineMarkdownPreset({ extensions: [mermaid()] })

  it('keeps the diagram, auto-laid out, and names the path', () => {
    const source = '```mermaid\n' + withLayout('    a --> b', '{"nodes":{"a":{"width":"wide"}}}') + '```\n'
    const document = compileMarkdown(source, { preset })
    const found = document.diagnostics.find((d) => d.code === 'DIAGRAM_LAYOUT_INVALID')
    expect(found).toMatchObject({ severity: 'warning', path: 'nodes.a.width' })
    expect(found?.message).toMatch(/auto-laid out/)
    expect(found?.message).not.toContain('wide')
    expect(found?.range).toBeDefined()
    const node = document.tree.children?.[0]
    expect(node?.type).toBe('diagram')
    expect(node !== undefined && 'data' in node).toBe(true)
    expect(document.diagnostics.some((d) => d.code === 'DIAGRAM_INVALID')).toBe(false)
  })

  it('reports nothing for a valid annotation or for a flowchart without one', () => {
    const valid = '```mermaid\n' + withLayout('    a --> b', '{"canvasHeight":200}') + '```\n'
    expect(compileMarkdown(valid, { preset }).diagnostics).toEqual([])
    expect(compileMarkdown('```mermaid\nflowchart LR\n    a --> b\n```\n', { preset }).diagnostics).toEqual([])
  })
})
