/**
 * The diagram block through the editor's headless bridge: an untouched fence
 * writes back byte for byte (every kind, the legacy JSON fences, even an
 * unparseable payload), the first edit turns a legacy block into ```mermaid
 * without touching its neighbours, a canvas edit re-emits what the parser
 * read through, a source edit writes the text, and older node JSON imports.
 */
import { describe, expect, it } from 'vitest'
import { $getRoot, type LexicalEditor } from 'lexical'
import { createMarkdownBridge } from '@react-markdown-kit/editor'
import { INSERT_DIAGRAM_COMMAND, mermaid } from '../src/editor.js'
import { DiagramNode, $isDiagramNode } from '../src/node/diagram-node.js'
import { flowchart, type DrawingData } from '../src/index.js'
import { defaultKinds } from '../src/core/kinds.js'

const DRAWING_PAYLOAD =
  '{"version":3,"canvasHeight":200,"shapes":[{"id":"a","type":"rect","x":20,"y":40,"width":150,"height":80,"stroke":"#1971c2","fill":"#a5d8ff","strokeWidth":2,"text":"A"}]}'

const SKELETON_PAYLOAD = '{"boxes":[{"id":"web","text":"Web"},{"id":"api","text":"API"}],"connectors":[{"from":"web","to":"api"}]}'

const FLOWCHART = 'flowchart LR\n    web[Web App] -->|REST| api[(API)]'
const SEQUENCE = 'sequenceDiagram\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi'
const CLASS = 'classDiagram\n    Animal <|-- Duck'

const DOCUMENT = `# Title

Before the drawing.

\`\`\`drawing
${DRAWING_PAYLOAD}
\`\`\`

Between the two.

\`\`\`diagram
${SKELETON_PAYLOAD}
\`\`\`

After the diagram.

\`\`\`mermaid
${FLOWCHART}
\`\`\`

After the flowchart.

\`\`\`mermaid
${SEQUENCE}
\`\`\`

\`\`\`mermaid
${CLASS}
\`\`\`

The end.
`

function open(source: string): { editor: LexicalEditor; bridge: ReturnType<typeof createMarkdownBridge> } {
  const bridge = createMarkdownBridge({ extensions: [mermaid()], headless: true })
  bridge.load(source)
  return { editor: bridge.getNativeEditor() as LexicalEditor, bridge }
}

function diagramNodes(editor: LexicalEditor): DiagramNode[] {
  return editor.getEditorState().read(() => $getRoot().getChildren().filter($isDiagramNode))
}

/** Node methods need an active editor state, like any `$` helper. */
function read<T>(editor: LexicalEditor, callback: () => T): T {
  return editor.getEditorState().read(callback)
}

function edit(editor: LexicalEditor, node: DiagramNode, source: string): void {
  editor.update(
    () => {
      node.setSource(source, defaultKinds())
    },
    { discrete: true },
  )
}

const kinds = defaultKinds()

describe('mermaid() on the editor bridge', () => {
  it('round-trips a document with every fence byte for byte', () => {
    const { editor, bridge } = open(DOCUMENT)
    expect(bridge.getMarkdown()).toBe(DOCUMENT)
    const nodes = diagramNodes(editor)
    expect(nodes).toHaveLength(5)
    expect(read(editor, () => nodes.map((node) => node.getFormat()))).toEqual(['drawing', 'diagram', 'mermaid', 'mermaid', 'mermaid'])
    expect(read(editor, () => nodes.map((node) => node.getKind()))).toEqual([
      'flowchart',
      'flowchart',
      'flowchart',
      'sequenceDiagram',
      'classDiagram',
    ])
    // A ```mermaid fence's source is its body; the raw bytes hold the fence.
    expect(read(editor, () => nodes[2]?.getSource())).toBe(FLOWCHART)
    expect(read(editor, () => nodes[3]?.getSource())).toBe(SEQUENCE)
    expect(read(editor, () => nodes[4]?.getRaw())).toBe('```mermaid\n' + CLASS + '\n```')
    expect(read(editor, () => nodes[2]?.getOrigin()?.type)).toBe('diagram')
  })

  it('converts a legacy fence on import: its source is the flowchart writer output, its bytes stay JSON', () => {
    const { editor } = open(DOCUMENT)
    const [drawing, skeleton] = diagramNodes(editor)
    if (drawing === undefined || skeleton === undefined) throw new Error('expected diagram nodes')
    expect(read(editor, () => drawing.getSource())).toBe(
      'flowchart LR\n    a("A")\n    style a fill:#a5d8ff,stroke:#1971c2\n    %% rmk-layout v1 {"canvasHeight":200,"nodes":{"a":{"x":20,"y":40,"width":150,"height":80,"strokeWidth":2}},"edges":{}}',
    )
    expect(read(editor, () => drawing.getRaw())).toBe('```drawing\n' + DRAWING_PAYLOAD + '\n```')
    // The skeleton is expanded on import: two boxes and one bound arrow.
    expect(read(editor, () => skeleton.getSource())).toContain('    web --> api\n')
    expect(read(editor, () => skeleton.getKind())).toBe('flowchart')
  })

  it('writes the edited legacy block as ```mermaid and leaves the neighbours alone', () => {
    const { editor, bridge } = open(DOCUMENT)
    const [first] = diagramNodes(editor)
    if (first === undefined) throw new Error('expected a diagram node')
    const source = read(editor, () => first.getSource())
    edit(editor, first, source.replace('"canvasHeight":200', '"canvasHeight":260'))
    const out = bridge.getMarkdown()
    expect(out).toContain('```mermaid\nflowchart LR\n    a("A")\n')
    expect(out).toContain('%% rmk-layout v1 {"canvasHeight":260,')
    expect(out).not.toContain(DRAWING_PAYLOAD)
    expect(out).toContain('# Title\n\nBefore the drawing.\n\n')
    expect(out).toContain('\n\nBetween the two.\n\n')
    expect(out).toContain('\n\nAfter the diagram.\n')
    // The untouched skeleton and fences are still the original bytes.
    expect(out).toContain('```diagram\n' + SKELETON_PAYLOAD + '\n```')
    expect(out).toContain('```mermaid\n' + FLOWCHART + '\n```\n\nAfter the flowchart.\n')
    expect(out).toContain('```mermaid\n' + SEQUENCE + '\n```\n\n```mermaid\n' + CLASS + '\n```\n\nThe end.\n')
  })

  it('expands a ```diagram skeleton one way: the first edit makes it ```mermaid', () => {
    const { editor, bridge } = open(DOCUMENT)
    const [, skeleton] = diagramNodes(editor)
    if (skeleton === undefined) throw new Error('expected a diagram node')
    const source = read(editor, () => skeleton.getSource())
    edit(editor, skeleton, source.replace('%% rmk-layout v1 {', '%% rmk-layout v1 {"width":"text",'))
    const out = bridge.getMarkdown()
    expect(out).not.toContain('```diagram')
    expect(out.match(/```mermaid/g)).toHaveLength(4)
    expect(out).toContain('    web --> api\n')
    expect(out).toContain('"width":"text"')
    // The first block was never touched and is still its original bytes.
    expect(out).toContain('```drawing\n' + DRAWING_PAYLOAD + '\n```')
  })

  it('keeps an unparseable payload byte for byte until it is edited', () => {
    const broken = 'Intro.\n\n```drawing\n{not json\n```\n\nOutro.\n'
    const { editor, bridge } = open(broken)
    expect(bridge.getMarkdown()).toBe(broken)
    const [node] = diagramNodes(editor)
    if (node === undefined) throw new Error('expected a diagram node')
    // Opens as an empty flowchart rather than failing.
    expect(read(editor, () => node.getSource())).toBe('flowchart LR\n    %% rmk-layout v1 {"canvasHeight":320,"nodes":{},"edges":{}}')
    edit(editor, node, 'flowchart LR\n    %% rmk-layout v1 {"canvasHeight":200,"nodes":{},"edges":{}}')
    expect(bridge.getMarkdown()).toBe(
      'Intro.\n\n```mermaid\nflowchart LR\n    %% rmk-layout v1 {"canvasHeight":200,"nodes":{},"edges":{}}\n```\n\nOutro.\n',
    )
  })

  it('re-emits retained lines on a canvas edit', () => {
    const source = 'flowchart LR\n    %% a comment\n    classDef big fill:#fff\n    a[A] --> b[B]'
    const { editor, bridge } = open(`\`\`\`mermaid\n${source}\n\`\`\`\n`)
    const [node] = diagramNodes(editor)
    if (node === undefined) throw new Error('expected a diagram node')
    const kind = flowchart()
    const parsed = kind.parse(source)
    if ('error' in parsed) throw new Error(parsed.error)
    expect(parsed.retained.map((line) => line.text)).toEqual(['    %% a comment', '    classDef big fill:#fff'])
    // What the canvas does on release: write the model with the retained lines.
    const moved: DrawingData = {
      ...parsed.model,
      shapes: parsed.model.shapes.map((shape) => (shape.id === 'a' ? { ...shape, x: 10, y: 10 } : shape)),
    }
    const written = kind.write?.(moved, { retained: parsed.retained })
    if (written === undefined) throw new Error('flowchart writes')
    edit(editor, node, written)
    const out = bridge.getMarkdown()
    expect(out).toContain('    a --> b\n    %% a comment\n    classDef big fill:#fff\n    %% rmk-layout v1 {')
    expect(out).toContain('"a":{"x":10,"y":10,')
    expect(out.match(/%% rmk-layout v1/g)).toHaveLength(1)
    // The written fence parses to the model that was written.
    const again = kind.parse(written)
    if ('error' in again) throw new Error(again.error)
    expect(again.model).toEqual(moved)
  })

  it('writes a source edit as the text, and re-detects the kind', () => {
    const { editor, bridge } = open(`Intro.\n\n\`\`\`mermaid\n${SEQUENCE}\n\`\`\`\n`)
    const [node] = diagramNodes(editor)
    if (node === undefined) throw new Error('expected a diagram node')
    const next = SEQUENCE + '\n    Note over Alice: done'
    edit(editor, node, next)
    expect(bridge.getMarkdown()).toBe(`Intro.\n\n\`\`\`mermaid\n${next}\n\`\`\`\n`)
    expect(read(editor, () => node.getKind())).toBe('sequenceDiagram')
    expect(read(editor, () => [node.getRaw(), node.getOrigin(), node.getFormat()])).toEqual([null, null, 'mermaid'])
    edit(editor, node, 'classDiagram\n    A <|-- B')
    expect(read(editor, () => node.getKind())).toBe('classDiagram')
    edit(editor, node, 'nothing here')
    expect(read(editor, () => node.getKind())).toBe('unknown')
    expect(bridge.getMarkdown()).toBe('Intro.\n\n```mermaid\nnothing here\n```\n')
  })

  it('carries the fence meta through an edit', () => {
    const { editor, bridge } = open('```mermaid title="Flow"\nflowchart LR\n    a --> b\n```\n')
    const [node] = diagramNodes(editor)
    if (node === undefined) throw new Error('expected a diagram node')
    expect(read(editor, () => node.getMeta())).toBe('title="Flow"')
    edit(editor, node, 'flowchart LR\n    a --> c')
    expect(bridge.getMarkdown()).toBe('```mermaid title="Flow"\nflowchart LR\n    a --> c\n```\n')
  })

  it('imports version 1 node JSON by converting the drawing, and version 2 as is', () => {
    const { editor } = open('Hello.\n')
    editor.update(
      () => {
        const v1 = DiagramNode.importJSON({ type: 'rmk-diagram', version: 1, data: DRAWING_PAYLOAD, format: 'drawing' })
        expect(v1.getKind()).toBe('flowchart')
        expect(v1.getSource()).toContain('flowchart LR\n    a("A")\n')
        expect(v1.getSource()).toContain('%% rmk-layout v1 {"canvasHeight":200,')
        expect([v1.getRaw(), v1.getOrigin(), v1.getFormat()]).toEqual([null, null, 'mermaid'])
        const v2 = DiagramNode.importJSON({ type: 'rmk-diagram', version: 2, source: SEQUENCE, kind: 'sequenceDiagram', format: 'mermaid' })
        expect(v2.getSource()).toBe(SEQUENCE)
        expect(v2.getKind()).toBe('sequenceDiagram')
        expect(v2.exportJSON()).toEqual({ type: 'rmk-diagram', version: 2, source: SEQUENCE, kind: 'sequenceDiagram', format: 'mermaid' })
      },
      { discrete: true },
    )
  })

  it('inserts a registered kind by name and refuses one that is not registered', () => {
    const { editor, bridge } = open('Hello.\n')
    // The React hook registers plugins; a headless bridge is asked to.
    const unregister = bridge.registerPlugins()
    let inserted: boolean | undefined
    let refused: boolean | undefined
    editor.update(
      () => {
        refused = editor.dispatchCommand(INSERT_DIAGRAM_COMMAND, { kind: 'gantt' })
      },
      { discrete: true },
    )
    expect(refused).toBe(false)
    expect(diagramNodes(editor)).toHaveLength(0)
    editor.update(
      () => {
        inserted = editor.dispatchCommand(INSERT_DIAGRAM_COMMAND, { kind: 'sequenceDiagram' })
      },
      { discrete: true },
    )
    expect(inserted).toBe(true)
    const [node] = diagramNodes(editor)
    expect(read(editor, () => [node?.getKind(), node?.getFormat(), node?.getRaw()])).toEqual(['sequenceDiagram', 'mermaid', null])
    expect(bridge.getMarkdown()).toContain('```mermaid\nsequenceDiagram\n    Alice->>Bob: Hello Bob\n')
    unregister()
  })

  it('exposes the editor capability under the same extension name, one button per kind', () => {
    const extension = mermaid({ style: 'ink', newBlockWidth: 'text' })
    expect(extension.name).toBe('mermaid')
    expect(extension.capabilities?.editor?.nodes).toHaveLength(1)
    expect(extension.capabilities?.editor?.blocks).toHaveLength(1)
    expect(extension.capabilities?.editor?.commands).toHaveLength(kinds.length)
    expect(extension.capabilities?.syntax?.nodeTypes).toEqual(['diagram'])
    const trimmed = mermaid({ kinds: [flowchart()] })
    expect(trimmed.capabilities?.editor?.commands).toHaveLength(1)
  })
})
