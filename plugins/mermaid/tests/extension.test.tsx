import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, compileMarkdown, defineMarkdownPreset, documentToMarkdown } from '@react-markdown-kit/renderer'
import { template } from '@react-markdown-kit/template'
import { mermaid, isDiagramNode } from '../src/index.js'

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

function render(source: string): string {
  return renderToStaticMarkup(createElement(Markdown, { preset, children: source }))
}

describe('mermaid(): syntax', () => {
  it('lifts a ```diagram fence into a diagram node with an expanded drawing', () => {
    const document = compileMarkdown(SKELETON, { preset })
    const node = document.tree.children?.[0]
    expect(node !== undefined && isDiagramNode(node)).toBe(true)
    if (node === undefined || !isDiagramNode(node)) return
    expect(node.format).toBe('diagram')
    expect(node.data?.shapes.map((shape) => shape.type)).toEqual(['rect', 'rect', 'cylinder', 'arrow', 'arrow'])
    expect(node.position).toBeDefined()
    expect(document.diagnostics).toEqual([])
  })

  it('keeps a ```drawing payload as-is and normalizes its bindings', () => {
    const node = compileMarkdown(DRAWING, { preset }).tree.children?.[0]
    if (node === undefined || !isDiagramNode(node)) throw new Error('expected a diagram node')
    expect(node.format).toBe('drawing')
    expect(node.data?.title).toBe('Two cards')
    expect(node.data?.shapes).toHaveLength(3)
  })

  it('reports invalid JSON as a diagnostic and keeps the source', () => {
    const document = compileMarkdown('```diagram\n{not json\n```\n', { preset })
    const node = document.tree.children?.[0]
    if (node === undefined || !isDiagramNode(node)) throw new Error('expected a diagram node')
    expect(node.data).toBeUndefined()
    expect(node.error).toBeDefined()
    expect(document.diagnostics.map((d) => d.code)).toEqual(['DIAGRAM_INVALID'])
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
})

describe('mermaid(): renderer', () => {
  it('renders a figure holding a static SVG', () => {
    const html = render(DRAWING)
    expect(html).toContain('<figure data-rmk-diagram="drawing">')
    expect(html).toContain('<svg')
    expect(html).toContain('<title>Two cards</title>')
    expect(html).toContain('<figcaption>Two cards</figcaption>')
    expect(html).toContain('<ellipse')
    expect(html).toContain('>go<')
    expect(html).not.toContain('<code')
  })

  it('lays out a skeleton and draws its labels', () => {
    const html = render(SKELETON)
    expect(html).toContain('<figure data-rmk-diagram="diagram">')
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
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onload=')
    expect(html).not.toContain('javascript:')
    // The payload text is drawn as escaped SVG text, wrapped to the box.
    expect(html).toContain('&lt;s')
  })
})

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
    expect(diagram.data?.shapes[0]?.text).toBe('{{name}}')
  })
})

describe('mermaid(): ```mermaid fences', () => {
  const FLOWCHART = '```mermaid\nflowchart LR\n    web[Web App] -->|REST| api[(API)]\n```\n'

  it('lifts a flowchart into a diagram node and renders it as SVG', () => {
    const document = compileMarkdown(FLOWCHART, { preset })
    const node = document.tree.children?.[0]
    if (node === undefined || !isDiagramNode(node)) throw new Error('expected a diagram node')
    expect(node.format).toBe('mermaid')
    expect(node.data?.shapes.map((shape) => shape.type)).toEqual(['rect', 'cylinder', 'arrow'])
    const html = render(FLOWCHART)
    expect(html).toContain('<figure data-rmk-diagram="mermaid">')
    expect(html).toContain('>Web App<')
    expect(html).toContain('>REST<')
  })

  it('serializes an untouched flowchart back byte for byte', async () => {
    const document = compileMarkdown(FLOWCHART, { preset })
    expect(await documentToMarkdown(document, { preset })).toBe(FLOWCHART)
  })

  it('leaves other Mermaid diagram types as ordinary code blocks', () => {
    const sequence = '```mermaid\nsequenceDiagram\n    A->>B: hi\n```\n'
    const document = compileMarkdown(sequence, { preset })
    expect(document.tree.children?.[0]?.type).toBe('code')
    expect(document.diagnostics).toEqual([])
    expect(render(sequence)).toContain('<code class="language-mermaid">')
  })
})
