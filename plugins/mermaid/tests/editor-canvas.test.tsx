/**
 * The canvas mounted inside <MarkdownEditor>: the block renders the header
 * and the canvas for a flowchart, the toolbar gains one insert button per
 * kind, labels and options reach the canvas, read-only shows the static
 * output, a lossy flowchart mounts read-only behind the block's notice,
 * "Copy as Mermaid" copies what a commit would write, a commit lands in
 * the document before the handler returns, keys on the canvas's own
 * controls stay theirs, the inline field keeps its events from Lexical's
 * root, and the overlay scale ignores a host's zoom transform.
 */
import mermaidJs from 'mermaid'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownEditor, useMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { button, click, mount, run, runAsync } from '../../../packages/editor/tests/helpers/mount.js'
import { flowchart, mermaid, sequenceDiagram, type DiagramKind } from '../src/editor.js'

/** The kind without `write`: the block edits it as text whatever the built-in gains. */
function sourceOnly(kind: DiagramKind): DiagramKind {
  return Object.fromEntries(Object.entries(kind).filter(([key]) => key !== 'write')) as unknown as DiagramKind
}

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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** jsdom has no pointer capture; the canvas captures on every press. */
function withPointerCapture(): void {
  if (!('setPointerCapture' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {}, configurable: true, writable: true })
  }
}

function fire(target: Element, type: string, init: MouseEventInit = {}): void {
  run(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }))
  })
}

function keyOn(target: Element, key: string): void {
  run(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

/** Selects the shape by a click on its group. */
function selectShape(container: HTMLElement, id: string): Element {
  const shape = container.querySelector(`[data-shape-id="${id}"]`)
  const surface = container.querySelector('.rmk-diagram-surface')
  if (shape === null || surface === null) throw new Error('No shape.')
  fire(shape, 'pointerdown', { clientX: 30, clientY: 50 })
  fire(surface, 'pointerup', { clientX: 30, clientY: 50 })
  return shape
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

  it('inserts the starter of a kind without a writer as text and focuses the textarea with the caret at the end', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor extensions={[mermaid({ kinds: [flowchart(), sourceOnly(sequenceDiagram())] })]} defaultValue="Hello.">
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
    // The block owns the notice; it sits above the canvas, not inside it.
    expect(notice?.closest('.rmk-diagram-canvas')).toBeNull()
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

  // Review C5: the clipboard text must equal what a commit writes, so the
  // title, the front matter, the retained lines and the width survive it.
  it('"Copy as Mermaid" copies the source a commit would write, retained lines and title included', async () => {
    const source =
      '---\ntitle: My flow\nconfig:\n  theme: dark\n---\nflowchart LR\n    %% a comment\n    classDef big fill:#fff\n    a[A] --> b[B]\n    click a "https://x"'
    const writeText = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor extensions={[mermaid()]} defaultValue={'```mermaid\n' + source + '\n```\n'}>
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    click(view.container.querySelector('.rmk-diagram-tool[aria-label="Copy as Mermaid"]'))
    await runAsync(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(writeText).toHaveBeenCalledTimes(1)
    const copied = writeText.mock.calls[0]?.[0] ?? ''
    // The writer emits the title as a JSON-quoted YAML scalar (review C3/C8).
    expect(copied.startsWith('---\ntitle: "My flow"\nconfig:\n  theme: dark\n---\nflowchart LR\n')).toBe(true)
    expect(copied).toContain('\n    %% a comment\n')
    expect(copied).toContain('\n    classDef big fill:#fff\n')
    expect(copied).toContain('\n    click a "https://x"\n')
    expect(copied).toContain('%% rmk-layout v1 ')
    // The same text a commit puts in the document: the first canvas edit
    // (a width preset) writes it with only the width added.
    click(view.container.querySelector('.rmk-diagram-tool[aria-label="Compact (shrink to content)"]'))
    const fence = editor.getMarkdown().replace(/^```mermaid\n/, '').replace(/\n```\n$/, '')
    expect(fence.replace('"width":"content",', '')).toBe(copied)
    // And Mermaid.js accepts it.
    await expect(mermaidJs.parse(copied)).resolves.toMatchObject({ diagramType: 'flowchart-v2' })
    view.unmount()
  })

  it('"Copy as Mermaid" copies the local state, including a width the canvas set', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const view = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={'```mermaid\nflowchart LR\n    a --> b\n```\n'} />)
    click(view.container.querySelector('.rmk-diagram-tool[aria-label="Compact (shrink to content)"]'))
    click(view.container.querySelector('.rmk-diagram-tool[aria-label="Copy as Mermaid"]'))
    await runAsync(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(writeText.mock.calls[0]?.[0]).toContain('"width":"content"')
    view.unmount()
  })

  // Review C21: a canvas commit is discrete like every other editing path,
  // so a host reading the document on the same event sees the gesture.
  it('commits a width preset before the click handler returns, and undoes it as one step', () => {
    let editor!: MarkdownEditorInstance
    const doc = '```mermaid\nflowchart LR\n    a --> b\n```\n'
    const view = mount(
      <MarkdownEditor extensions={[mermaid()]} defaultValue={doc}>
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    const compact = view.container.querySelector<HTMLButtonElement>('.rmk-diagram-tool[aria-label="Compact (shrink to content)"]')
    if (compact === null) throw new Error('No width preset.')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    let seen = ''
    run(() => {
      compact.click()
      seen = editor.getMarkdown()
    })
    expect(seen).toContain('"width":"content"')
    expect(view.container.querySelector('.rmk-diagram-canvas')?.classList.contains('is-content-width')).toBe(true)
    run(() => editor.undo())
    expect(editor.getMarkdown()).toBe(doc)
    expect(view.container.querySelector('.rmk-diagram-canvas')?.classList.contains('is-content-width')).toBe(false)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
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

  // Review S5: Enter on a focused tool activates the tool; Backspace there edits nothing of the selection.
  it('a key on a tool row or property bar control never edits or deletes the selection', () => {
    withPointerCapture()
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor extensions={[mermaid()]} defaultValue={DOCUMENT}>
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    const shape = selectShape(view.container, 'a')
    expect(shape.classList.contains('is-selected')).toBe(true)
    const tool = view.container.querySelector('.rmk-diagram-toolbar button')
    if (tool === null) throw new Error('No tool.')
    keyOn(tool, 'Enter')
    expect(view.container.querySelector('.rmk-diagram-text-input')).toBeNull()
    keyOn(tool, 'Backspace')
    expect(view.container.querySelector('[data-shape-id="a"]')).not.toBeNull()
    expect(editor.getMarkdown()).toBe(DOCUMENT)
    const root = view.container.querySelector('.rmk-diagram-canvas')
    if (root === null) throw new Error('No canvas.')
    keyOn(root, 'Enter')
    expect(view.container.querySelector('.rmk-diagram-text-input')).not.toBeNull()
    view.unmount()
  })

  // Review S3: `cut` at Lexical's root removes the document selection, so nothing but `input` may leave the field.
  it("the inline text field keeps its clipboard, drop, key and composition events from Lexical's root", () => {
    withPointerCapture()
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor extensions={[mermaid()]} defaultValue={DOCUMENT}>
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    const shape = view.container.querySelector('[data-shape-id="a"]')
    if (shape === null) throw new Error('No shape.')
    fire(shape, 'dblclick', { clientX: 30, clientY: 50 })
    const input = view.container.querySelector<HTMLTextAreaElement>('.rmk-diagram-text-input')
    const lexical = view.container.querySelector('.rmk-content > [contenteditable]')
    if (input === null || lexical === null) throw new Error('No field.')
    const seen = vi.fn()
    const events = ['keyup', 'keypress', 'beforeinput', 'paste', 'cut', 'copy', 'drop', 'compositionstart', 'compositionupdate', 'compositionend']
    for (const name of events) lexical.addEventListener(name, seen)
    for (const name of events) run(() => input.dispatchEvent(new Event(name, { bubbles: true, cancelable: true })))
    expect(seen).not.toHaveBeenCalled()
    expect(editor.getMarkdown()).toBe(DOCUMENT)
    view.unmount()
  })

  // `align: 'center'`: the stage's content box comes from the observer
  // (untransformed, like the scale), the drawing is offset to its middle
  // through the viewBox, the inline field follows, and a pointer maps through
  // the same offset, so a marquee drawn around the card on screen selects it.
  it('centres the drawing on the surface with `align: "center"`, and maps pointers through the offset', () => {
    withPointerCapture()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: (entries: readonly { contentRect: { width: number; height: number } }[]) => void) {}
        observe(target: Element): void {
          if (target.classList.contains('rmk-diagram-stage')) this.callback([{ contentRect: { width: 800, height: 600 } }])
        }
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    const view = mount(<MarkdownEditor extensions={[mermaid({ align: 'center' })]} defaultValue={DOCUMENT} />)
    const surface = view.container.querySelector('.rmk-diagram-surface')
    if (surface === null) throw new Error('No surface.')
    // The card is 150 by 80 at (20, 40): centred on 800 by 600 it moves by (305, 220).
    expect(surface.getAttribute('viewBox')).toBe('-305 -220 800 600')
    fire(surface, 'pointerdown', { clientX: 315, clientY: 250 })
    fire(surface, 'pointerup', { clientX: 485, clientY: 350 })
    expect(view.container.querySelector('[data-shape-id="a"]')?.classList.contains('is-selected')).toBe(true)
    fire(view.container.querySelector('[data-shape-id="a"]')!, 'dblclick', { clientX: 400, clientY: 300 })
    expect(view.container.querySelector<HTMLElement>('.rmk-diagram-overlay')?.style.transform).toBe('translate(305px, 220px) scale(1)')
    view.unmount()
  })

  it('leaves the drawing at the origin by default', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: (entries: readonly { contentRect: { width: number; height: number } }[]) => void) {}
        observe(): void {
          this.callback([{ contentRect: { width: 800, height: 600 } }])
        }
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    const view = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={DOCUMENT} />)
    expect(view.container.querySelector('.rmk-diagram-surface')?.getAttribute('viewBox')).toBeNull()
    view.unmount()
  })

  // Review S4: the overlay sits inside a host's zoom transform, so its scale
  // comes from the untransformed stage width, never from a client rect.
  it('scales the inline text field by the untransformed stage width under a host zoom', () => {
    withPointerCapture()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    // The stage is 200 px wide; a host zoom doubles every client rect.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('rmk-diagram-stage') ? 200 : 0
    })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 0, width: 400, height: 0, toJSON: () => ({}) } as DOMRect)
    const sized = DOCUMENT.replace('"canvasHeight":200', '"canvasHeight":200,"canvasWidth":400')
    const view = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={sized} />)
    const shape = view.container.querySelector('[data-shape-id="a"]')
    if (shape === null) throw new Error('No shape.')
    fire(shape, 'dblclick', { clientX: 30, clientY: 50 })
    const overlay = view.container.querySelector<HTMLElement>('.rmk-diagram-overlay')
    expect(overlay?.style.transform).toBe('scale(0.5)')
    view.unmount()
  })
})
