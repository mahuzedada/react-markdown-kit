/**
 * The canvas mounted inside <MarkdownEditor>: the decorator renders, the
 * toolbar gains an insert button that adds a drawing, labels and options
 * reach the canvas, and read-only hides the tools.
 */
import { describe, expect, it } from 'vitest'
import { MarkdownEditor, useMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { button, click, mount } from '../../../packages/editor/tests/helpers/mount.js'
import { mermaid } from '../src/editor.js'

const DOCUMENT = `Before.

\`\`\`drawing
{"version":3,"canvasHeight":200,"title":"Two cards","shapes":[{"id":"a","type":"rect","x":20,"y":40,"width":150,"height":80,"stroke":"#1971c2","fill":"#a5d8ff","strokeWidth":2,"text":"A"}]}
\`\`\`

After.
`

function Capture({ onReady }: { onReady: (editor: MarkdownEditorInstance) => void }): null {
  onReady(useMarkdownEditorContext())
  return null
}

describe('the diagram canvas in <MarkdownEditor>', () => {
  it('renders the canvas for a ```drawing fence and the insert button in the toolbar', () => {
    const view = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={DOCUMENT} />)
    const canvas = view.container.querySelector('.rmk-diagram-canvas')
    expect(canvas).not.toBeNull()
    expect(canvas?.classList.contains('is-editable')).toBe(true)
    expect(view.container.querySelector('.rmk-diagram-surface')?.getAttribute('aria-label')).toBe('Two cards')
    expect(view.container.querySelector('.rmk-diagram-toolbar')).not.toBeNull()
    expect(view.container.querySelector('[data-rmk-diagram="drawing"]')).not.toBeNull()
    const insert = button(view.container, 'diagram')
    expect(insert.getAttribute('aria-label')).toBe('Insert diagram')
    view.unmount()
  })

  it('inserts an empty drawing from the toolbar and writes it as ```mermaid', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor extensions={[mermaid({ newBlockWidth: 'content' })]} defaultValue="Hello.">
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    expect(view.container.querySelectorAll('.rmk-diagram-canvas')).toHaveLength(0)
    click(button(view.container, 'diagram'))
    expect(view.container.querySelectorAll('.rmk-diagram-canvas')).toHaveLength(1)
    const markdown = editor.getMarkdown()
    expect(markdown).toContain('Hello.')
    expect(markdown).toContain('```mermaid\nflowchart LR\n    %% rmk-layout v1 {"canvasHeight":320,"width":"content","nodes":{},"edges":{}}\n```')
    view.unmount()
  })

  it('applies diagram.* labels and the ink style', () => {
    const view = mount(
      <MarkdownEditor
        extensions={[mermaid({ style: 'ink' })]}
        defaultValue={'```drawing\n{"version":3,"canvasHeight":200,"shapes":[]}\n```\n'}
        labels={{ 'diagram.canvas': 'Zeichnung', 'diagram.tools': 'Werkzeuge', diagram: 'Diagramm einfügen' }}
      />,
    )
    expect(view.container.querySelector('.rmk-diagram-canvas')?.classList.contains('is-ink')).toBe(true)
    expect(view.container.querySelector('.rmk-diagram-surface')?.getAttribute('aria-label')).toBe('Zeichnung')
    expect(view.container.querySelector('[role="toolbar"][aria-label="Werkzeuge"]')).not.toBeNull()
    expect(button(view.container, 'diagram').getAttribute('aria-label')).toBe('Diagramm einfügen')
    view.unmount()
  })

  it('renders read-only without the tool row or the height grip', () => {
    const view = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={DOCUMENT} readOnly />)
    const canvas = view.container.querySelector('.rmk-diagram-canvas')
    expect(canvas).not.toBeNull()
    expect(canvas?.classList.contains('is-editable')).toBe(false)
    expect(view.container.querySelector('.rmk-diagram-toolbar')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-resize')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-surface text')?.textContent).toBe('A')
    view.unmount()
  })
})
