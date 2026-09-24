// Ported from @zuilib/text-editor tests/mermaid.test.mjs (MIT).
import { describe, it, expect } from 'vitest'

import {
  drawingToMermaid,
  type DrawingData,
  type DrawingShape,
  type DrawingShapeType,
  type MermaidOptions,
} from '../src/core/index.js'

// Rectangles as the canvas draws them: square, Mermaid's `[text]`
const box = (id: string, type: DrawingShapeType, extra: Partial<DrawingShape> = {}): DrawingShape => ({
  id, type, x: 0, y: 0, width: 100, height: 60,
  stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2, ...(type === 'rect' ? { corners: 'sharp' as const } : {}), ...extra,
})
const connector = (
  id: string,
  from: string | null,
  to: string | null,
  extra: Partial<DrawingShape> = {}
): DrawingShape => ({
  id, type: 'arrow', x: 0, y: 0, width: 100, height: 0,
  stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2,
  ...(from ? { startBinding: { id: from } } : {}),
  ...(to ? { endBinding: { id: to } } : {}),
  ...extra,
})
const drawing = (...shapes: DrawingShape[]): DrawingData => ({ version: 3, canvasHeight: 320, shapes })
// The syntax tests read the plain export; the layout comment has its own tests below.
const lines = (data: DrawingData, options?: MermaidOptions) =>
  drawingToMermaid(data, { omitLayout: true, ...options }).split('\n')

describe('drawingToMermaid', () => {
  it('two cards joined by a labelled arrow', () => {
    const out = drawingToMermaid(drawing(
      box('a', 'rect', { label: 'Service', text: 'Auth API', footer: 'v2.1', fill: '#a5d8ff' }),
      box('b', 'cylinder', { text: 'Users DB' }),
      connector('e', 'a', 'b', { text: 'reads' }),
    ), { omitLayout: true })
    expect(out).toBe([
      'flowchart LR',
      '    a["Service<br/>Auth API<br/>v2.1"]',
      '    b[("Users DB")]',
      '    a -->|reads| b',
      '    style a fill:#a5d8ff',
      '',
    ].join('\n'))
  })

  it('auto direction: horizontal majority is LR, vertical is TD; no edges is LR', () => {
    const a = box('a', 'rect')
    const b = box('b', 'rect')
    expect(lines(drawing(a, b, connector('e', 'a', 'b', { width: 80, height: 10 })))[0]).toBe('flowchart LR')
    expect(lines(drawing(a, b, connector('e', 'a', 'b', { width: 10, height: 80 })))[0]).toBe('flowchart TD')
    expect(lines(drawing(a, b))[0]).toBe('flowchart LR')
    expect(lines(drawing(a, b, connector('e', 'a', 'b', { width: 80, height: 10 })), { direction: 'TD' })[0]).toBe('flowchart TD')
  })

  it('each box type uses its Mermaid shape syntax', () => {
    const types: DrawingShapeType[] = ['rect', 'ellipse', 'diamond', 'note', 'cylinder', 'cloud', 'queue', 'actor']
    const out = lines(drawing(...types.map((t) => box(t, t, { text: 'x' }))))
    expect(out.slice(1, 9)).toEqual([
      '    rect["x"]',
      '    ellipse(["x"])',
      '    diamond{"x"}',
      '    note>"x"]',
      '    cylinder[("x")]',
      '    cloud(("x"))',
      '    queue[["x"]]',
      '    actor(("x"))',
    ])
  })

  it('empty text falls back to the shape id; newlines become <br/>', () => {
    const out = lines(drawing(box('empty', 'rect'), box('multi', 'rect', { text: 'one\ntwo' })))
    expect(out[1]).toBe('    empty["empty"]')
    expect(out[2]).toBe('    multi["one<br/>two"]')
  })

  it('quotes, angle brackets and pipes are escaped', () => {
    const out = lines(drawing(
      box('a', 'rect', { text: 'say "hi" <b>' }),
      box('b', 'rect'),
      connector('e', 'a', 'b', { text: 'x | "y"' }),
    ))
    expect(out[1]).toBe('    a["say #quot;hi#quot; #lt;b#gt;"]')
    expect(out[3]).toBe('    a -->|x #124; #quot;y#quot;| b')
  })

  it('quotes an edge label only when it holds brackets, braces or parentheses (C13)', () => {
    const out = lines(drawing(
      box('a', 'rect'), box('b', 'rect'),
      connector('e1', 'a', 'b', { text: 'ok (200)' }),
      connector('e2', 'a', 'b', { text: 'arr[0] {x}' }),
      connector('e3', 'a', 'b', { text: 'plain' }),
    ))
    expect(out.slice(3, 6)).toEqual(['    a -->|"ok (200)"| b', '    a -->|"arr[0] {x}"| b', '    a -->|plain| b'])
  })

  it('connectors without both bindings are skipped', () => {
    const out = drawingToMermaid(drawing(
      box('a', 'rect'), box('b', 'rect'),
      connector('half', 'a', null, { text: 'dangling' }),
      connector('ghost', 'a', 'missing'),
      connector('free', null, null),
    ), { omitLayout: true })
    expect(out).toBe('flowchart LR\n    a["a"]\n    b["b"]\n')
  })

  it('bidirectional arrows and lines', () => {
    const out = lines(drawing(
      box('a', 'rect'), box('b', 'rect'),
      connector('e1', 'a', 'b', { bidirectional: true, text: 'sync' }),
      connector('e2', 'b', 'a', { type: 'line' }),
      connector('e3', 'a', 'b', { type: 'line', text: 'peer' }),
    ))
    expect(out[3]).toBe('    a <-->|sync| b')
    expect(out[4]).toBe('    b --- a')
    expect(out[5]).toBe('    a ---|peer| b')
  })

  it('style lines include only the properties that differ from defaults', () => {
    const out = lines(drawing(
      box('plain', 'rect'),
      box('filled', 'rect', { fill: '#ffc9c9' }),
      box('stroked', 'rect', { stroke: '#e03131' }),
      box('both', 'rect', { fill: '#b2f2bb', stroke: '#2f9e44' }),
    ))
    expect(out.slice(5, 8)).toEqual([
      '    style filled fill:#ffc9c9',
      '    style stroked fill:transparent,stroke:#e03131',
      '    style both fill:#b2f2bb,stroke:#2f9e44',
    ])
  })

  it('valid Mermaid ids are written unchanged; only invalid ids are rewritten, and never onto a valid one', () => {
    const out = lines(drawing(
      box('my-box', 'rect'), box('my box', 'rect'), box('1st', 'rect'), box('my_box', 'rect'), box('a--b', 'rect'),
      connector('e', 'my-box', 'my box'),
    ))
    expect(out[1]).toBe('    my-box["my-box"]')
    // `my box` is invalid; `my_box` is taken by the valid id below, so it moves on.
    expect(out[2]).toBe('    my_box_2["my box"]')
    expect(out[3]).toBe('    1st["1st"]')
    expect(out[4]).toBe('    my_box["my_box"]')
    expect(out[5]).toBe('    a__b["a--b"]')
    expect(out[6]).toBe('    my-box --> my_box_2')
  })

  it('writes ids with Unicode letters, dots and colons unchanged, as the parser reads them (C12)', () => {
    const out = lines(drawing(
      box('Пользователь', 'rect'), box('api.gateway', 'rect'), box('svc:4', 'rect'), box('用户', 'rect'),
      connector('e', 'Пользователь', 'api.gateway'),
    ))
    expect(out.slice(1, 6)).toEqual([
      '    Пользователь["Пользователь"]',
      '    api.gateway["api.gateway"]',
      '    svc:4["svc:4"]',
      '    用户["用户"]',
      '    Пользователь --> api.gateway',
    ])
  })

  it('never writes a Mermaid keyword as a node id (C24)', () => {
    const out = lines(drawing(box('end', 'rect'), box('style', 'rect'), connector('e', 'end', 'style')))
    expect(out.slice(1, 4)).toEqual(['    end_["end"]', '    style_["style"]', '    end_ --> style_'])
  })

  it('escapes # before any other entity, and & and %, so text that looks like an entity survives a round trip (C7)', () => {
    const out = lines(drawing(
      box('a', 'rect', { text: 'PR #42; merged' }),
      box('b', 'rect', { text: 'Bug #123; fixed #quot; &quot; %%{init 100%' }),
      connector('e', 'a', 'b', { text: 'a|b #124; 5%' }),
    ))
    expect(out[1]).toBe('    a["PR #35;42; merged"]')
    expect(out[2]).toBe('    b["Bug #35;123; fixed #35;quot; #38;quot; #37;#37;{init 100#37;"]')
    expect(out[3]).toBe('    a -->|a#124;b #35;124; 5#37;| b')
  })

  it('writes the title as a JSON-quoted YAML scalar, whatever it holds (C3, C8)', () => {
    const titled = (title: string): string => drawingToMermaid({ ...drawing(box('a', 'rect')), title }, { omitLayout: true }).split('\n')[1] as string
    expect(titled('Flow')).toBe('title: "Flow"')
    expect(titled('a: b')).toBe('title: "a: b"')
    expect(titled('[draft] plan')).toBe('title: "[draft] plan"')
    expect(titled('C# x # y')).toBe('title: "C# x # y"')
    expect(titled('say "hi" \\ there')).toBe('title: "say \\"hi\\" \\\\ there"')
    expect(titled('*')).toBe('title: "*"')
  })

  it('free text shapes are preserved as comments', () => {
    const out = lines(drawing(
      box('a', 'rect'),
      { id: 't', type: 'text', x: 0, y: 0, width: 50, height: 20, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2, text: 'Legend:\n  red = error' },
    ))
    expect(out[2]).toBe('    %% note: Legend: red = error')
    expect(out.at(-1)).toBe('')
  })
})

describe('retained lines', () => {
  const retained = [
    { line: 3, text: 'config:', place: 'frontMatter' as const },
    { line: 4, text: '  theme: base', place: 'frontMatter' as const },
    { line: 6, text: '%%{init: { "theme": "forest" } }%%', place: 'body' as const },
    { line: 8, text: '    classDef hot fill:#f00', place: 'body' as const },
    { line: 8, text: '    class a hot', place: 'body' as const },
    { line: 9, text: '    click a "https://example.com"', place: 'body' as const },
  ]
  const data = { ...drawing(box('a', 'rect', { text: 'A', fill: '#ffc9c9' }), box('b', 'rect'), connector('e', 'a', 'b')), title: 'Flow' }

  it('writes the title and the front-matter lines in one block, then header, nodes, edges, styles, body lines, annotation', () => {
    const out = drawingToMermaid(data, { retained }).split('\n')
    expect(out.slice(0, 12)).toEqual([
      '---',
      'title: "Flow"',
      'config:',
      '  theme: base',
      '---',
      'flowchart LR',
      '    a["A"]',
      '    b["b"]',
      '    a --> b',
      '    style a fill:#ffc9c9',
      '%%{init: { "theme": "forest" } }%%',
      '    classDef hot fill:#f00',
    ])
    expect(out.slice(12, 14)).toEqual(['    class a hot', '    click a "https://example.com"'])
    expect(out[14]?.startsWith('    %% rmk-layout v1 {')).toBe(true)
    expect(out[15]).toBe('')
  })

  it('opens a front-matter block for retained keys without a title, and none when both are empty', () => {
    const untitled = drawing(box('a', 'rect'))
    expect(drawingToMermaid(untitled, { retained: retained.slice(0, 2) }).split('\n').slice(0, 4)).toEqual(['---', 'config:', '  theme: base', '---'])
    expect(drawingToMermaid(untitled, { retained: [] }).startsWith('flowchart LR\n')).toBe(true)
    expect(drawingToMermaid(untitled).startsWith('flowchart LR\n')).toBe(true)
  })

  it('re-emits every retained line exactly once, in order, with the plain export too', () => {
    const out = drawingToMermaid(data, { retained, omitLayout: true })
    for (const line of retained) expect(out.split('\n').filter((candidate) => candidate === line.text)).toHaveLength(1)
    const body = retained.filter((line) => line.place === 'body').map((line) => line.text)
    expect(body.map((text) => out.indexOf(text))).toEqual([...body.map((text) => out.indexOf(text))].sort((x, y) => x - y))
    expect(out).not.toContain('%% rmk-layout')
  })

  it('is a fixed point with retained lines and always ends with exactly one annotation line', () => {
    const once = drawingToMermaid(data, { retained })
    const twice = drawingToMermaid(data, { retained })
    expect(twice).toBe(once)
    const annotations = once.split('\n').filter((line) => line.includes('%% rmk-layout'))
    expect(annotations).toHaveLength(1)
    expect(once.trimEnd().split('\n').at(-1)).toBe(annotations[0])
  })
})

describe('the %% rmk-layout annotation', () => {
  it('is the last line, one JSON object, and is left out of the plain export', () => {
    const data = drawing(box('a', 'cloud', { text: 'A', x: 40, y: 50 }), box('b', 'rect', { text: 'B', x: 300 }), connector('e', 'a', 'b', { routing: 'elbow', elbow: 0.4 }))
    const out = drawingToMermaid(data)
    const last = out.trim().split('\n').pop() as string
    expect(last.startsWith('    %% rmk-layout v1 {')).toBe(true)
    const payload = JSON.parse(last.trim().slice('%% rmk-layout v1 '.length)) as {
      nodes: Record<string, { x: number; type?: string }>
      edges: Record<string, { routing?: string; elbow?: number }>
    }
    expect(payload.nodes['a']?.x).toBe(40)
    expect(payload.nodes['a']?.type).toBe('cloud')
    expect(payload.edges['a->b']?.routing).toBe('elbow')
    expect(drawingToMermaid(data, { omitLayout: true })).not.toContain('%% rmk-layout')
  })
})
