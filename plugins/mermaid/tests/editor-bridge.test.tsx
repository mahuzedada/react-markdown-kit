/**
 * The diagram block through the editor's headless bridge: an untouched fence
 * writes back byte for byte (both formats, even an unparseable payload), and
 * the first edit turns the block into ```drawing without touching its
 * neighbours.
 */
import { describe, expect, it } from 'vitest'
import { $getRoot, type LexicalEditor } from 'lexical'
import { createMarkdownBridge } from '@react-markdown-kit/editor'
import { mermaid } from '../src/editor.js'
import { $isDiagramNode, type DiagramNode } from '../src/node/diagram-node.js'
import type { DrawingData } from '../src/index.js'

const DRAWING_PAYLOAD =
  '{"version":3,"canvasHeight":200,"shapes":[{"id":"a","type":"rect","x":20,"y":40,"width":150,"height":80,"stroke":"#1971c2","fill":"#a5d8ff","strokeWidth":2,"text":"A"}]}'

const SKELETON_PAYLOAD = '{"boxes":[{"id":"web","text":"Web"},{"id":"api","text":"API"}],"connectors":[{"from":"web","to":"api"}]}'

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

describe('mermaid() on the editor bridge', () => {
  it('round-trips a document with both fence formats byte for byte', () => {
    const { editor, bridge } = open(DOCUMENT)
    expect(bridge.getMarkdown()).toBe(DOCUMENT)
    const nodes = diagramNodes(editor)
    expect(nodes).toHaveLength(2)
    expect(read(editor, () => nodes.map((node) => node.getFormat()))).toEqual(['drawing', 'diagram'])
    expect(read(editor, () => nodes[0]?.getData().shapes)).toHaveLength(1)
    // The skeleton is expanded on import: two boxes and one bound arrow.
    expect(read(editor, () => nodes[1]?.getData().shapes.map((shape) => shape.type))).toEqual([
      'rect',
      'rect',
      'arrow',
    ])
  })

  it('writes the edited block as ```mermaid and leaves the neighbours alone', () => {
    const { editor, bridge } = open(DOCUMENT)
    const [first] = diagramNodes(editor)
    if (first === undefined) throw new Error('expected a diagram node')
    const next: DrawingData = { ...read(editor, () => first.getData()), canvasHeight: 260 }
    editor.update(
      () => {
        first.setData(next)
      },
      { discrete: true },
    )
    const out = bridge.getMarkdown()
    expect(out).toContain('```mermaid\nflowchart LR\n    a["A"]\n')
    expect(out).toContain('%% rmk-layout v1 {"canvasHeight":260,')
    expect(out).not.toContain(DRAWING_PAYLOAD)
    expect(out).toContain('# Title\n\nBefore the drawing.\n\n')
    expect(out).toContain('\n\nBetween the two.\n\n')
    expect(out).toContain('\n\nAfter the diagram.\n')
    // The untouched skeleton is still the original bytes.
    expect(out).toContain('```diagram\n' + SKELETON_PAYLOAD + '\n```')
  })

  it('expands a ```diagram skeleton one way: the first edit makes it ```mermaid', () => {
    const { editor, bridge } = open(DOCUMENT)
    const [, skeleton] = diagramNodes(editor)
    if (skeleton === undefined) throw new Error('expected a diagram node')
    editor.update(
      () => {
        skeleton.setBlockWidth('text')
      },
      { discrete: true },
    )
    const out = bridge.getMarkdown()
    expect(out).not.toContain('```diagram')
    expect(out.match(/```mermaid/g)).toHaveLength(1)
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
    // Opens as an empty canvas rather than failing.
    expect(read(editor, () => node.getData().shapes)).toEqual([])
    editor.update(
      () => {
        node.setData({ version: 3, canvasHeight: 200, shapes: [] })
      },
      { discrete: true },
    )
    expect(bridge.getMarkdown()).toBe(
      'Intro.\n\n```mermaid\nflowchart LR\n    %% rmk-layout v1 {"canvasHeight":200,"nodes":{},"edges":{}}\n```\n\nOutro.\n',
    )
  })

  it('exposes the editor capability under the same extension name', () => {
    const extension = mermaid({ style: 'ink', newBlockWidth: 'text' })
    expect(extension.name).toBe('mermaid')
    expect(extension.capabilities?.editor?.nodes).toHaveLength(1)
    expect(extension.capabilities?.editor?.blocks).toHaveLength(1)
    expect(extension.capabilities?.syntax?.nodeTypes).toEqual(['diagram'])
  })
})
