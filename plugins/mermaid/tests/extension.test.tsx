import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, compileMarkdown, defineMarkdownPreset, documentToMarkdown } from '@react-markdown-kit/renderer'
import { template } from '@react-markdown-kit/template'
import { MarkdownConfigurationError } from '@internal/diagnostics/index.js'
import { mermaid, isDiagramNode, flowchart, sequenceDiagram, type DiagramKind } from '../src/index.js'
import { diagramNodeFrom, parseDiagramSource } from '../src/extension.js'
import type { DrawingData } from '../src/core/index.js'

const SKELETON = `\`\`\`diagram
{"boxes":[
  {"id":"web","label":"CLIENT","text":"Web App","footer":"React","color":"blue"},
  {"id":"api","label":"SERVICE","text":"API","color":"green"},
  {"id":"db","type":"cylinder","text":"Postgres"}
],"connectors":[
  {"from":"web","to":"api","text":"REST"},
  {"from":"api","to":"db","routing":"elbow"}
]}
\`\`\`
`

const DRAWING = `\`\`\`drawing
{"version":3,"canvasHeight":200,"title":"Two cards","shapes":[
  {"id":"a","type":"rect","x":20,"y":40,"width":150,"height":80,"stroke":"#1971c2","fill":"#a5d8ff","strokeWidth":2,"text":"A"},
  {"id":"b","type":"ellipse","x":300,"y":40,"width":150,"height":80,"stroke":"#2f9e44","fill":"#b2f2bb","strokeWidth":2,"text":"B"},
  {"id":"e","type":"arrow","x":170,"y":80,"width":130,"height":0,"stroke":"#1e1e1e","fill":"transparent","strokeWidth":2,"startBinding":{"id":"a"},"endBinding":{"id":"b"},"text":"go"}
]}
\`\`\`
`

const preset = defineMarkdownPreset({ extensions: [mermaid()] })

function render(source: string, options: { extensions?: readonly ReturnType<typeof mermaid>[] } = {}): string {
  return renderToStaticMarkup(createElement(Markdown, options.extensions ? { extensions: options.extensions, children: source } : { preset, children: source }))
}

function diagram(source: string, options: { extensions?: readonly ReturnType<typeof mermaid>[] } = {}) {
  const document = compileMarkdown(source, options.extensions ? { extensions: options.extensions } : { preset })
  const node = document.tree.children?.find(isDiagramNode)
  if (node === undefined) throw new Error('expected a diagram node')
  return { document, node }
}

const model = (value: unknown): DrawingData => value as DrawingData

describe('mermaid(): syntax', () => {
  it('lifts a ```diagram fence into a diagram node with an expanded drawing', () => {
    const { document, node } = diagram(SKELETON)
    expect(node.format).toBe('diagram')
    expect(node.kind).toBe('flowchart')
    expect(node.support).toBe('static')
    expect(model(node.model).shapes.map((shape) => shape.type)).toEqual(['rect', 'rect', 'cylinder', 'arrow', 'arrow'])
    expect(node.position).toBeDefined()
    expect(document.diagnostics).toEqual([])
  })

  it('keeps a ```drawing payload as-is and normalizes its bindings', () => {
    const { node } = diagram(DRAWING)
    expect(node.format).toBe('drawing')
    expect(model(node.model).title).toBe('Two cards')
    expect(model(node.model).shapes).toHaveLength(3)
  })

  it('reports invalid JSON as a diagnostic and keeps the source', () => {
    const { document, node } = diagram('```diagram\n{not json\n```\n')
    expect(node.model).toBeUndefined()
    expect(node.error).toBeDefined()
    expect(document.diagnostics.map((d) => d.code)).toEqual(['DIAGRAM_INVALID'])
    expect(document.diagnostics[0]?.message).toBe('The diagram block could not be read and is shown as source.')
  })

  it('leaves ordinary code blocks alone', () => {
    const node = compileMarkdown('```ts\nconst x = 1\n```\n', { preset }).tree.children?.[0]
    expect(node?.type).toBe('code')
  })

  it('serializes back to the same fence', async () => {
    for (const source of [SKELETON, DRAWING]) {
      const document = compileMarkdown(source, { preset })
      expect(await documentToMarkdown(document, { preset })).toBe(source)
    }
  })

  it('lengthens the fence when the payload contains backticks', async () => {
    const source = '```drawing\n{"version":3,"canvasHeight":100,"title":"```","shapes":[]}\n```\n'
    const document = compileMarkdown(source, { preset })
    const out = await documentToMarkdown(document, { preset })
    expect(out.startsWith('````drawing\n')).toBe(true)
    expect(compileMarkdown(out, { preset }).tree.children?.[0]?.type).toBe('diagram')
  })

  it('keeps the info string remainder as meta and writes it back', async () => {
    const source = '```mermaid title="x"\nflowchart LR\n    a --> b\n```\n'
    const { document, node } = diagram(source)
    expect(node.meta).toBe('title="x"')
    expect(await documentToMarkdown(document, { preset })).toBe(source)
  })
})

describe('mermaid(): renderer', () => {
  it('renders a figure holding a static SVG', () => {
    const html = render(DRAWING)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram="drawing"[^>]*>/)
    expect(html).toContain('<svg')
    expect(html).toContain('<title>Two cards</title>')
    expect(html).toContain('<figcaption>Two cards</figcaption>')
    expect(html).toContain('<ellipse')
    expect(html).toContain('>go<')
    expect(html).not.toContain('<code')
  })

  it('lays out a skeleton and draws its labels', () => {
    const html = render(SKELETON)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram="diagram"[^>]*>/)
    for (const label of ['CLIENT', 'Web App', 'React', 'API', 'Postgres', 'REST']) expect(html).toContain(`>${label}<`)
    expect(html).toContain('aria-label="Diagram"')
  })

  it('shows the source of an invalid payload instead of hiding it', () => {
    const html = render('```diagram\n{not json\n```\n')
    expect(html).toContain('data-rmk-diagram-error')
    expect(html).toContain('<code class="language-diagram">{not json</code>')
  })

  it('applies the classNames hook to the figure', () => {
    const html = renderToStaticMarkup(
      createElement(Markdown, { preset, classNames: { diagram: 'my-figure' }, children: DRAWING }),
    )
    expect(html).toMatch(/<figure[^>]*class="my-figure"[^>]*>/)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram="drawing"[^>]*>/)
  })

  it('does not execute anything: no script, no event handlers, no foreign objects', () => {
    const hostile = '```drawing\n{"version":3,"canvasHeight":100,"shapes":[{"id":"a","type":"rect","x":0,"y":0,"width":10,"height":10,"stroke":"#000\\" onload=\\"alert(1)","fill":"url(javascript:alert(1))","strokeWidth":2,"text":"<script>alert(1)</script>"}]}\n```\n'
    const html = render(hostile)
    expectInert(html)
    // The payload text is drawn as escaped SVG text, wrapped to the box.
    expect(html).toContain('&lt;s')

    // The same payload through a ```mermaid flowchart: node text, an edge
    // label and a style line each carry it.
    const flowchart =
      '```mermaid\nflowchart LR\n' +
      '    a["<script>alert(1)</script>"] -->|"<foreignObject onload=alert(1)>"| b["<img onerror=alert(1)>"]\n' +
      '    style a fill:url(javascript:alert(1)),stroke:#000" onload="alert(1)\n' +
      '    style b fill:#fff,stroke:url(#x),color:javascript:alert(1)\n' +
      '```\n'
    const svg = render(flowchart)
    expect(svg).toMatch(/<figure[^>]*data-rmk-diagram="mermaid"[^>]*>/)
    expectInert(svg)
    expect(svg).toContain('&lt;script')
  })
})

/**
 * No script, no foreignObject, no event attribute and no URL reference on any
 * element. Hostile text may survive as escaped text content, so the attribute
 * checks look inside tags only.
 */
function expectInert(html: string): void {
  expect(html).not.toContain('<script')
  expect(html).not.toContain('<foreignObject')
  expect(html).not.toMatch(/<[^>]*\son[a-z]+=/i)
  expect(html).not.toMatch(/<[^>]*(href=|xlink:|url\()/i)
  expect(html).not.toContain('javascript:')
}

describe('mermaid(): template', () => {
  it('never resolves a placeholder inside a diagram payload', () => {
    const source = '# {{name}}\n\n```drawing\n{"version":3,"canvasHeight":100,"shapes":[{"id":"a","type":"rect","x":0,"y":0,"width":100,"height":50,"stroke":"#000","fill":"transparent","strokeWidth":2,"text":"{{name}}"}]}\n```\n'
    const document = compileMarkdown(source, { preset, extensions: [template({ data: { name: 'Acme' } })] })
    expect(document.diagnostics).toEqual([])
    const heading = document.tree.children?.[0]
    const diagram = document.tree.children?.[1]
    expect(JSON.stringify(heading)).toContain('Acme')
    if (diagram === undefined || !isDiagramNode(diagram)) throw new Error('expected a diagram node')
    expect(diagram.value).toContain('{{name}}')
    expect(model(diagram.model).shapes[0]?.text).toBe('{{name}}')
  })
})

describe('mermaid(): ```mermaid fences', () => {
  const FLOWCHART = '```mermaid\nflowchart LR\n    web[Web App] -->|REST| api[(API)]\n```\n'
  const SEQUENCE = '```mermaid\nsequenceDiagram\n    A->>B: hi\n```\n'
  const CLASS = '```mermaid\nclassDiagram\n    Animal <|-- Duck\n```\n'

  it('lifts a flowchart into a diagram node and renders it as SVG', () => {
    const { node } = diagram(FLOWCHART)
    expect(node.format).toBe('mermaid')
    expect(node.kind).toBe('flowchart')
    expect(node.support).toBe('static')
    expect(model(node.model).shapes.map((shape) => shape.type)).toEqual(['rect', 'cylinder', 'arrow'])
    expect(node.problems).toEqual([])
    expect(node.retained).toEqual([])
    expect(node.lossy).toEqual([])
    const html = render(FLOWCHART)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram="mermaid"[^>]*>/)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram-kind="flowchart"[^>]*>/)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram-support="static"[^>]*>/)
    expect(html).toContain('>Web App<')
    expect(html).toContain('>REST<')
  })

  it('serializes an untouched flowchart, sequence and class fence back byte for byte', async () => {
    for (const source of [FLOWCHART, SEQUENCE, CLASS]) {
      const document = compileMarkdown(source, { preset })
      expect(document.tree.children?.[0]?.type).toBe('diagram')
      expect(await documentToMarkdown(document, { preset })).toBe(source)
    }
  })

  it('renders a sequence fence static', () => {
    const { document, node } = diagram(SEQUENCE)
    expect(node.kind).toBe('sequenceDiagram')
    expect(node.support).toBe('static')
    expect(node.model).toBeDefined()
    expect(document.diagnostics).toEqual([])
    const html = render(SEQUENCE)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram-kind="sequenceDiagram"[^>]*>/)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram-support="static"[^>]*>/)
    expect(html).toContain('<svg')
    expect(html).not.toContain('<code')
    expectInert(html)
  })

  it('renders a class diagram as a source figure with DIAGRAM_KIND_UNSUPPORTED', () => {
    const { document, node } = diagram(CLASS)
    expect(node.kind).toBe('classDiagram')
    expect(node.support).toBe('source')
    expect(node.model).toBeUndefined()
    expect(node.error).toBeUndefined()
    expect(document.diagnostics).toEqual([
      expect.objectContaining({ code: 'DIAGRAM_KIND_UNSUPPORTED', severity: 'info', message: 'classDiagram diagrams are shown as source.' }),
    ])
    const html = render(CLASS)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram="mermaid"[^>]*>/)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram-kind="classDiagram"[^>]*>/)
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram-support="source"[^>]*>/)
    expect(html).not.toContain('data-rmk-diagram-error')
    expect(html).toContain('<pre><code class="language-mermaid">classDiagram\n    Animal &lt;|-- Duck</code></pre>')
  })

  it('reports DIAGRAM_KIND_UNKNOWN, with a hint for a case slip, and shows the source', () => {
    const slip = diagram('```mermaid\nSequenceDiagram\n    A->>B: hi\n```\n')
    expect(slip.node.kind).toBe('unknown')
    expect(slip.node.support).toBe('source')
    expect(slip.document.diagnostics).toEqual([
      expect.objectContaining({
        code: 'DIAGRAM_KIND_UNKNOWN',
        severity: 'warning',
        message: 'The mermaid block does not start with a Mermaid diagram keyword. Mermaid keywords are case-sensitive; expected `sequenceDiagram`.',
      }),
    ])
    const plain = diagram('```mermaid\nhello world\n```\n')
    expect(plain.document.diagnostics.map((d) => [d.code, d.message])).toEqual([
      ['DIAGRAM_KIND_UNKNOWN', 'The mermaid block does not start with a Mermaid diagram keyword.'],
    ])
    expect(render('```mermaid\nhello world\n```\n')).toMatch(/<figure[^>]*data-rmk-diagram-kind="unknown"[^>]*><pre><code class="language-mermaid">hello world<\/code><\/pre><\/figure>/)
  })

  it('keeps the source of a fence its kind could not read, with DIAGRAM_INVALID and data-rmk-diagram-error', () => {
    const failing: DiagramKind = {
      name: 'failing',
      keywords: ['failing'],
      label: 'Failing',
      starter: 'failing',
      parse: () => ({ error: 'no reader yet', line: 1 }),
      render: () => ({ type: 'element', tagName: 'svg', properties: {}, children: [] }),
    }
    const extensions = [mermaid({ kinds: [failing] })]
    const source = '```mermaid\nfailing\n    x\n```\n'
    const { document, node } = diagram(source, { extensions })
    expect(node.kind).toBe('failing')
    expect(node.support).toBe('static')
    expect(node.error).toBe('no reader yet')
    expect(node.model).toBeUndefined()
    expect(document.diagnostics).toEqual([
      expect.objectContaining({ code: 'DIAGRAM_INVALID', severity: 'warning', message: 'The Failing block could not be read and is shown as source (line 1).' }),
    ])
    const html = render(source, { extensions })
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram-error="no reader yet"[^>]*>/)
    expect(html).toContain('<code class="language-mermaid">failing\n    x</code>')
  })

  it('reports DIAGRAM_INVALID for a flowchart header the kind rejects', () => {
    const { document } = diagram('```mermaid\nflowchart-foo LR\n    a --> b\n```\n')
    expect(document.diagnostics.map((d) => [d.code, d.message])).toEqual([
      ['DIAGRAM_INVALID', 'The Flowchart block could not be read and is shown as source (line 1).'],
    ])
  })

  it('narrows problem diagnostics to the fence line they name', () => {
    const source = '# Title\n\n```mermaid\nflowchart LR\n    a --> b\n    a[unclosed\n    A ~~~ B\n    %% rmk-layout v1 {"nodes":{"a":{"x":"oops"}}}\n```\n'
    const { document } = diagram(source)
    const codes = document.diagnostics.map((d) => [d.code, d.range?.start.line, d.range?.end.line, d.range?.end.column])
    expect(codes).toEqual([
      ['DIAGRAM_SYNTAX_INVALID', 6, 6, 15],
      ['DIAGRAM_SYNTAX_IGNORED', 7, 7, 12],
      ['DIAGRAM_LAYOUT_INVALID', 8, 8, 50],
    ])
    expect(document.diagnostics.map((d) => d.message)).toEqual([
      'Line 3: The statement could not be read and is kept as written.',
      'Line 4: The invisible link is kept as written and not drawn.',
      'The layout annotation was ignored and the diagram auto-laid out: Expected a finite number.',
    ])
    expect(document.diagnostics[2]?.path).toBe('nodes.a.x')
    expect(document.diagnostics.filter((d) => d.path !== undefined)).toHaveLength(1)
  })

  it('caps per-problem diagnostics at twenty of each severity', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `    n${i}[unclosed`)
    const ignored = Array.from({ length: 25 }, (_, i) => `    p${i} ~~~ q${i}`)
    const { document, node } = diagram('```mermaid\nflowchart LR\n' + [...lines, ...ignored].join('\n') + '\n```\n')
    expect(node.problems).toHaveLength(50)
    expect(document.diagnostics.filter((d) => d.code === 'DIAGRAM_SYNTAX_INVALID')).toHaveLength(20)
    expect(document.diagnostics.filter((d) => d.code === 'DIAGRAM_SYNTAX_IGNORED')).toHaveLength(20)
  })

  it('carries retained lines and lossy features on the node', () => {
    const { node, document } = diagram('```mermaid\nflowchart LR\n    subgraph one\n    a --> b\n    end\n    classDef hot fill:#f00\n```\n')
    expect(node.retained).toEqual([{ line: 5, text: '    classDef hot fill:#f00', place: 'body' }])
    expect(node.lossy).toEqual(['subgraph'])
    expect(document.diagnostics).toEqual([])
  })
})

describe('mermaid({ kinds })', () => {
  it('defaults to the flowchart and sequence kinds and keeps the extension name', () => {
    const extension = mermaid()
    expect(extension.name).toBe('mermaid')
    expect(diagram('```mermaid\nsequenceDiagram\n    A->>B: hi\n```\n').node.support).toBe('static')
  })

  it('a trimmed registry shows the other kinds as source', () => {
    const extensions = [mermaid({ kinds: [flowchart()] })]
    const { document, node } = diagram('```mermaid\nsequenceDiagram\n    A->>B: hi\n```\n', { extensions })
    // `sequenceDiagram` is also a `MERMAID_KEYWORDS` entry, so without its
    // kind the fence is named and unsupported rather than undetected.
    expect(node.kind).toBe('sequenceDiagram')
    expect(node.support).toBe('source')
    expect(node.model).toBeUndefined()
    expect(document.diagnostics).toEqual([
      expect.objectContaining({ code: 'DIAGRAM_KIND_UNSUPPORTED', severity: 'info', message: 'sequenceDiagram diagrams are shown as source.' }),
    ])
    const html = render('```mermaid\nsequenceDiagram\n    A->>B: hi\n```\n', { extensions })
    expect(html).toContain('<code class="language-mermaid">')
    expect(html).toMatch(/<figure[^>]*data-rmk-diagram-support="source"[^>]*>/)
  })

  it('throws DIAGRAM_KINDS_INVALID when two kinds claim one keyword', () => {
    const clash: DiagramKind = { ...sequenceDiagram(), name: 'other', keywords: ['graph'] }
    expect(() => mermaid({ kinds: [flowchart(), clash] })).toThrow(MarkdownConfigurationError)
    expect(() => mermaid({ kinds: [flowchart(), clash] })).toThrow('Diagram kinds "flowchart" and "other" both claim keyword "graph".')
  })

  it('still reads the legacy JSON fences without a flowchart kind, as source', () => {
    const { node } = diagram(SKELETON, { extensions: [mermaid({ kinds: [sequenceDiagram()] })] })
    expect(node.kind).toBe('flowchart')
    expect(node.support).toBe('source')
    expect(node.model).toBeDefined()
    expect(render(SKELETON, { extensions: [mermaid({ kinds: [sequenceDiagram()] })] })).toContain('<code class="language-diagram">')
  })
})

describe('diagramNodeFrom and parseDiagramSource', () => {
  const kinds = [flowchart(), sequenceDiagram()]

  it('builds the node the syntax transform builds, with meta and position when given', () => {
    const position = { start: { line: 3, column: 1 }, end: { line: 6, column: 4 } }
    const node = diagramNodeFrom('flowchart LR\n    a --> b', 'mermaid', kinds, { meta: 'x', position })
    expect(node).toMatchObject({ type: 'diagram', format: 'mermaid', kind: 'flowchart', support: 'static', value: 'flowchart LR\n    a --> b', meta: 'x', position })
    expect(diagramNodeFrom('classDiagram\n  A', 'mermaid', kinds)).toEqual({ type: 'diagram', format: 'mermaid', kind: 'classDiagram', support: 'source', value: 'classDiagram\n  A' })
    expect(diagramNodeFrom('{"boxes":[]}', 'diagram', kinds)).toMatchObject({ kind: 'flowchart', support: 'static', model: { version: 3 } })
  })

  it('memoises a parse on the registry, kind and source', () => {
    const first = parseDiagramSource(kinds, 'flowchart', 'flowchart LR\n    a --> b')
    expect(parseDiagramSource(kinds, 'flowchart', 'flowchart LR\n    a --> b')).toBe(first)
    expect(parseDiagramSource(kinds, 'flowchart', 'flowchart LR\n    a --> c')).not.toBe(first)
    expect(parseDiagramSource([flowchart()], 'flowchart', 'flowchart LR\n    a --> b')).not.toBe(first)
    expect(parseDiagramSource(kinds, 'classDiagram', 'classDiagram')).toBeUndefined()
  })

  it('turns a kind whose parse throws into a parse error rather than a crash', () => {
    const throwing: DiagramKind = { name: 'boom', keywords: ['boom'], label: 'Boom', starter: 'boom', parse: () => { throw new Error('kaboom') } }
    expect(parseDiagramSource([throwing], 'boom', 'boom')).toEqual({ error: 'kaboom' })
  })
})
