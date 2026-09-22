/**
 * The canvas mounted inside <MarkdownEditor>: the block renders the header
 * and the canvas for a flowchart, the toolbar gains one insert button per
 * kind, labels and options reach the canvas, read-only shows the static
 * output, and a lossy flowchart mounts read-only behind its notice.
 */
import { describe, expect, it } from 'vitest'
import { MarkdownEditor, useMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { button, click, mount, run } from '../../../packages/editor/tests/helpers/mount.js'
import { mermaid } from '../src/editor.js'

const DOCUMENT = `Before.

\`\`\`drawing
{"version":3,"canvasHeight":200,"title":"Two cards","shapes":[{"id":"a","type":"rect","x":20,"y":40,"width":150,"height":80,"stroke":"#1971c2","fill":"#a5d8ff","strokeWidth":2,"text":"A"}]}
\`\`\`

After.
`

const LOSSY = 'Before.\n\n```mermaid\nflowchart LR\n    a --> b\n    a ==> c\n    subgraph one\n    d\n    end\n```\n'

function Capture({ onReady }: { onReady: (editor: MarkdownEditorInstance) => void }): null {
  onReady(useMarkdownEditorContext())
  return null
}

describe('the diagram canvas in <MarkdownEditor>', () => {
  it('renders the header and the canvas for a ```drawing fence, and the insert buttons in the toolbar', () => {
    const view = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={DOCUMENT} />)
    const block = view.container.querySelector('.rmk-diagram-block')
    expect(block?.getAttribute('data-rmk-diagram-kind')).toBe('flowchart')
    expect(block?.getAttribute('data-rmk-diagram-support')).toBe('static')
    expect(block?.getAttribute('data-rmk-diagram-mode')).toBe('canvas')
    expect(view.container.querySelector('.rmk-diagram-kind')?.textContent).toBe('Flowchart')
    expect(view.container.querySelector('.rmk-diagram-badge')?.textContent).toBe('Static')
    const canvas = view.container.querySelector('.rmk-diagram-canvas')
    expect(canvas).not.toBeNull()
    expect(canvas?.classList.contains('is-editable')).toBe(true)
    expect(view.container.querySelector('.rmk-diagram-surface')?.getAttribute('aria-label')).toBe('Two cards')
    expect(view.container.querySelector('.rmk-diagram-toolbar')).not.toBeNull()
    expect(view.container.querySelector('[data-rmk-diagram="drawing"]')).not.toBeNull()
    const insert = button(view.container, 'diagram')
    expect(insert.getAttribute('aria-label')).toBe('Insert diagram')
    const sequence = button(view.container, 'diagram-sequenceDiagram')
    expect(sequence.getAttribute('aria-label')).toBe('Insert sequence diagram')
    expect(sequence.closest('[role="group"]')).toBe(insert.closest('[role="group"]'))
    view.unmount()
  })

  it('inserts the flowchart starter from the toolbar, writes it as ```mermaid and focuses the canvas', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor extensions={[mermaid({ newBlockWidth: 'content' })]} defaultValue="Hello.">
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    expect(view.container.querySelectorAll('.rmk-diagram-canvas')).toHaveLength(0)
    click(button(view.container, 'diagram'))
    expect(view.container.querySelectorAll('.rmk-diagram-canvas')).toHaveLength(1)
    expect(document.activeElement).toBe(view.container.querySelector('.rmk-diagram-canvas'))
    const markdown = editor.getMarkdown()
    expect(markdown).toContain('Hello.')
    expect(markdown).toContain('```mermaid\nflowchart LR\n    A["Start"]\n    B["Next"]\n    A --> B\n    %% rmk-layout v1 {"canvasHeight":154,"width":"content",')
    view.unmount()
  })

  it('inserts the sequence starter as text and focuses the textarea with the caret at the end', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor extensions={[mermaid()]} defaultValue="Hello.">
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    click(button(view.container, 'diagram-sequenceDiagram'))
    const textarea = view.container.querySelector<HTMLTextAreaElement>('.rmk-diagram-source-input')
    expect(textarea).not.toBeNull()
    expect(document.activeElement).toBe(textarea)
    expect(textarea?.selectionStart).toBe(textarea?.value.length)
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('source')
    expect(editor.getMarkdown()).toContain('```mermaid\nsequenceDiagram\n    Alice->>Bob: Hello Bob\n    Bob-->>Alice: Hi Alice\n```')
    view.unmount()
  })

  it('applies diagram.* labels and the ink style', () => {
    const view = mount(
      <MarkdownEditor
        extensions={[mermaid({ style: 'ink' })]}
        defaultValue={'```drawing\n{"version":3,"canvasHeight":200,"shapes":[]}\n```\n'}
        labels={{ 'diagram.canvas': 'Zeichnung', 'diagram.tools': 'Werkzeuge', 'diagram.staticBadge': 'Statisch', diagram: 'Diagramm einfügen' }}
      />,
    )
    expect(view.container.querySelector('.rmk-diagram-canvas')?.classList.contains('is-ink')).toBe(true)
    expect(view.container.querySelector('.rmk-diagram-surface')?.getAttribute('aria-label')).toBe('Zeichnung')
    expect(view.container.querySelector('[role="toolbar"][aria-label="Werkzeuge"]')).not.toBeNull()
    expect(view.container.querySelector('.rmk-diagram-badge')?.textContent).toBe('Statisch')
    expect(button(view.container, 'diagram').getAttribute('aria-label')).toBe('Diagramm einfügen')
    view.unmount()
  })

  it('renders read-only as the header and the static output, no canvas, no toggle', () => {
    const view = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={DOCUMENT} readOnly />)
    expect(view.container.querySelector('.rmk-diagram-kind')?.textContent).toBe('Flowchart')
    expect(view.container.querySelector('.rmk-diagram-mode')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-canvas')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-toolbar')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-resize')).toBeNull()
    const svg = view.container.querySelector('.rmk-diagram-preview svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.querySelector('title')?.textContent).toBe('Two cards')
    expect(svg?.textContent).toContain('A')
    view.unmount()
  })

  it('mounts a lossy flowchart read-only behind the notice until acknowledged', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor extensions={[mermaid()]} defaultValue={LOSSY}>
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    const canvas = view.container.querySelector('.rmk-diagram-canvas')
    expect(canvas?.classList.contains('is-editable')).toBe(false)
    expect(canvas?.hasAttribute('tabindex')).toBe(false)
    expect(view.container.querySelector('.rmk-diagram-toolbar')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-resize')).toBeNull()
    const notice = view.container.querySelector('.rmk-diagram-lossy')
    expect(notice?.textContent).toContain('Editing on the canvas cannot keep: subgraph, edge-style')
    const actions = [...(notice?.querySelectorAll('button') ?? [])].map((action) => action.textContent)
    expect(actions).toEqual(['Edit on canvas', 'Edit as text'])
    // Nothing was written while the canvas only showed.
    expect(editor.getMarkdown()).toBe(LOSSY)

    click(notice?.querySelectorAll('button')[0] ?? null)
    expect(view.container.querySelector('.rmk-diagram-canvas')?.classList.contains('is-editable')).toBe(true)
    expect(view.container.querySelector('.rmk-diagram-lossy')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-toolbar')).not.toBeNull()
    expect(editor.getMarkdown()).toBe(LOSSY)
    view.unmount()
  })

  it('"Edit as text" in the lossy notice switches the block to source mode', () => {
    const view = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={LOSSY} />)
    const notice = view.container.querySelector('.rmk-diagram-lossy')
    click(notice?.querySelectorAll('button')[1] ?? null)
    expect(view.container.querySelector('.rmk-diagram-canvas')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('source')
    expect(view.container.querySelector<HTMLTextAreaElement>('.rmk-diagram-source-input')?.value).toBe(
      'flowchart LR\n    a --> b\n    a ==> c\n    subgraph one\n    d\n    end',
    )
    // The toggle brings the canvas back, still behind its notice.
    const canvasButton = view.container.querySelector<HTMLButtonElement>('.rmk-diagram-mode-button[aria-label="Canvas"]')
    run(() => canvasButton?.click())
    expect(view.container.querySelector('.rmk-diagram-lossy')).not.toBeNull()
    view.unmount()
  })
})
