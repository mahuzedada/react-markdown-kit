/**
 * The sequence canvas inside <MarkdownEditor> (docs/MERMAID_PLATFORM.md
 * section 9.5): every gesture through pointer and keyboard events in jsdom,
 * each asserting the Mermaid written into the document; one history entry
 * per structural change and merged entries for inline typing; byte-exact
 * write-back while untouched; the `create-destroy` lock; read-only
 * rendering; and `mermaid({ editors })` replacing the built-in canvas.
 *
 * jsdom has no pointer events and no layout, so pointer events are mouse
 * events by another name and the layer's screen matrix is the identity:
 * client coordinates are picture coordinates, computed here from the same
 * `layoutSequence` the canvas reads.
 */
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownEditor, useMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { click, mount, run, runAsync, type Mounted } from '../../../packages/editor/tests/helpers/mount.js'
import { mermaid, type DiagramKindEditorProps, type MermaidEditorOptions } from '../src/editor.js'
import {
  columnRect,
  frameBottomRect,
  frameTabRect,
  layoutSequence,
  noteRect,
  sectionRect,
  type LayoutMessage,
  type SequenceLayout,
} from '../src/core/sequence/layout.js'
import { parseSequenceDiagram } from '../src/core/sequence/parse.js'
import { insertionY } from '../src/canvas/sequence/hit.js'

const SIMPLE = 'sequenceDiagram\n    A->>B: one\n    B-->>A: two'
const doc = (body: string): string => `Before.\n\n\`\`\`mermaid\n${body}\n\`\`\`\n\nAfter.\n`

function Capture({ onReady }: { onReady: (editor: MarkdownEditorInstance) => void }): null {
  onReady(useMarkdownEditorContext())
  return null
}

const views: Mounted[] = []
function open(body: string, options: MermaidEditorOptions = {}, readOnly = false): { view: Mounted; editor: () => MarkdownEditorInstance } {
  let editor!: MarkdownEditorInstance
  const view = mount(
    <MarkdownEditor extensions={[mermaid(options)]} defaultValue={doc(body)} readOnly={readOnly}>
      <Capture onReady={(value) => (editor = value)} />
    </MarkdownEditor>,
  )
  views.push(view)
  return { view, editor: () => editor }
}

afterEach(() => {
  for (const view of views.splice(0)) view.unmount()
  vi.useRealTimers()
})

function fence(editor: MarkdownEditorInstance): string {
  const match = /```mermaid\n([\s\S]*?)\n```/.exec(editor.getMarkdown())
  return match?.[1] ?? ''
}

/** The fence's statements after the header, trimmed. */
function statements(editor: MarkdownEditorInstance): string[] {
  return fence(editor).split('\n').slice(1).map((line) => line.trim())
}

function layoutOf(source: string): SequenceLayout {
  const parsed = parseSequenceDiagram(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return layoutSequence(parsed.model)
}

function query<T extends Element>(view: Mounted, selector: string): T {
  const found = view.container.querySelector<T>(selector)
  if (found === null) throw new Error(`No ${selector}.`)
  return found
}

function layer(view: Mounted): SVGSVGElement {
  return query<SVGSVGElement>(view, '.rmk-sequence-layer')
}

function root(view: Mounted): HTMLElement {
  return query<HTMLElement>(view, '.rmk-sequence-canvas')
}

function tool(view: Mounted, label: string): HTMLButtonElement {
  return query<HTMLButtonElement>(view, `.rmk-diagram-tool[aria-label="${label}"]`)
}

function pointer(target: Element, type: 'pointerdown' | 'pointermove' | 'pointerup' | 'dblclick', x: number, y: number, init: MouseEventInit = {}): void {
  run(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...init }))
  })
}

function press(view: Mounted, x: number, y: number, init: MouseEventInit = {}): void {
  pointer(layer(view), 'pointerdown', x, y, init)
  pointer(layer(view), 'pointerup', x, y, init)
}

function drag(view: Mounted, from: { x: number; y: number }, to: { x: number; y: number }): void {
  pointer(layer(view), 'pointerdown', from.x, from.y)
  pointer(layer(view), 'pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2)
  pointer(layer(view), 'pointermove', to.x, to.y)
  pointer(layer(view), 'pointerup', to.x, to.y)
}

function key(view: Mounted, keyName: string): void {
  run(() => {
    root(view).dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }))
  })
}

/** Types into a React-controlled textarea: the native setter, then the input event React listens to. */
function type(textarea: HTMLTextAreaElement, value: string): void {
  run(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function field(view: Mounted): HTMLTextAreaElement {
  return query<HTMLTextAreaElement>(view, '.rmk-sequence-text-input')
}

function fieldKey(textarea: HTMLTextAreaElement, keyName: string): void {
  run(() => {
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }))
  })
}

const messageMid = (message: LayoutMessage): { x: number; y: number } => ({ x: (message.fromX + message.toX) / 2, y: message.y })
const center = (rect: { x: number; y: number; w: number; h: number }): { x: number; y: number } => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })

describe('the sequence canvas: mounting', () => {
  it('mounts a sequence fence on the canvas with the picture, the tool row and the interaction layer, and writes back byte for byte while untouched', () => {
    const body = 'sequenceDiagram\n    %% a comment\n    participant A as Alice\n    A->>B: one\n    B-->>A: two'
    const { view, editor } = open(body)
    const block = query(view, '.rmk-diagram-block')
    expect(block.getAttribute('data-rmk-diagram-kind')).toBe('sequenceDiagram')
    expect(block.getAttribute('data-rmk-diagram-mode')).toBe('canvas')
    const canvas = root(view)
    expect(canvas.classList.contains('is-editable')).toBe(true)
    expect(canvas.classList.contains('rmk-diagram-canvas')).toBe(true)
    expect(query(view, '.rmk-sequence-picture svg').getAttribute('role')).toBe('img')
    expect(query(view, '.rmk-sequence-picture svg').textContent).toContain('Alice')
    expect(view.container.querySelector('.rmk-diagram-toolbar')).not.toBeNull()
    expect(view.container.querySelector('.rmk-sequence-layer')).not.toBeNull()
    expect(view.container.querySelector('.rmk-diagram-source-input')).toBeNull()
    expect(editor().getMarkdown()).toBe(doc(body))
  })

  it('renders the picture only in a read-only editor', () => {
    const { view } = open(SIMPLE, {}, true)
    expect(view.container.querySelector('.rmk-sequence-canvas')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-toolbar')).toBeNull()
    expect(query(view, '.rmk-diagram-preview svg').getAttribute('role')).toBe('img')
  })

  it('locks a create/destroy source behind the block notice: picture only, no tool row, nothing written', () => {
    const body = 'sequenceDiagram\n    A->>B: one\n    create participant C\n    B->>C: two'
    const { view, editor } = open(body)
    const notice = query(view, '.rmk-diagram-lossy')
    expect(notice.textContent).toContain('create-destroy')
    expect(notice.closest('.rmk-sequence-canvas')).toBeNull()
    const canvas = root(view)
    expect(canvas.classList.contains('is-editable')).toBe(false)
    expect(canvas.hasAttribute('tabindex')).toBe(false)
    expect(view.container.querySelector('.rmk-diagram-toolbar')).toBeNull()
    expect(view.container.querySelector('.rmk-sequence-layer')).toBeNull()
    expect(query(view, '.rmk-sequence-picture svg')).not.toBeNull()
    expect(editor().getMarkdown()).toBe(doc(body))
    click(notice.querySelectorAll('button')[0] ?? null)
    expect(root(view).classList.contains('is-editable')).toBe(true)
    expect(view.container.querySelector('.rmk-diagram-toolbar')).not.toBeNull()
    expect(editor().getMarkdown()).toBe(doc(body))
    // The first edit flattens create/destroy, as the notice said.
    click(tool(view, 'Autonumber'))
    expect(statements(editor())).toEqual(['autonumber', 'participant A', 'participant B', 'participant C', 'A->>B: one', 'B->>C: two'])
  })

  it('is replaced by name through mermaid({ editors })', () => {
    const seen: { props: DiagramKindEditorProps | null } = { props: null }
    function Custom(props: DiagramKindEditorProps): ReactElement {
      seen.props = props
      return <div className="custom-sequence" data-rmk-diagram-focus="" tabIndex={0} />
    }
    const { view } = open(SIMPLE, { editors: { sequenceDiagram: Custom } })
    expect(view.container.querySelector('.rmk-sequence-canvas')).toBeNull()
    expect(view.container.querySelector('.custom-sequence')).not.toBeNull()
    expect(seen.props?.kind.name).toBe('sequenceDiagram')
    expect(seen.props?.source).toBe(SIMPLE)
  })

  it('applies diagram.* labels to its controls', () => {
    const view = mount(
      <MarkdownEditor extensions={[mermaid()]} defaultValue={doc(SIMPLE)} labels={{ 'diagram.addParticipant': 'Teilnehmer', 'diagram.sequenceTools': 'Werkzeuge' }} />,
    )
    views.push(view)
    expect(view.container.querySelector('.rmk-diagram-tool[aria-label="Teilnehmer"]')).not.toBeNull()
    expect(view.container.querySelector('[role="toolbar"][aria-label="Werkzeuge"]')).not.toBeNull()
  })
})

describe('the sequence canvas: participants', () => {
  it('"Add participant" and "Add actor" append a fresh participant, select it, and each is one history entry', () => {
    const { view, editor } = open(SIMPLE)
    click(tool(view, 'Add participant'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'participant Participant', 'A->>B: one', 'B-->>A: two'])
    expect(view.container.querySelectorAll('.rmk-sequence-outline')).toHaveLength(1)
    expect(view.container.querySelector('[role="radiogroup"][aria-label="Participant kind"]')).not.toBeNull()
    click(tool(view, 'Add actor'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'participant Participant', 'actor Actor', 'A->>B: one', 'B-->>A: two'])
    run(() => editor().undo())
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'participant Participant', 'A->>B: one', 'B-->>A: two'])
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(doc(SIMPLE))
    run(() => editor().redo())
    expect(statements(editor())).toContain('participant Participant')
  })

  it('a click selects a participant, Escape clears the selection, Delete removes it with its messages', () => {
    const { view, editor } = open('sequenceDiagram\n    A->>B: one\n    B-->>A: two\n    B->>C: three')
    const layout = layoutOf(fence(editor()))
    const a = center(columnRect(layout.columns[0]!))
    press(view, a.x, a.y)
    expect(view.container.querySelectorAll('.rmk-sequence-outline')).toHaveLength(1)
    expect(view.container.querySelector('.rmk-diagram-tool[aria-label="Delete participant"]')).not.toBeNull()
    key(view, 'Escape')
    expect(view.container.querySelectorAll('.rmk-sequence-outline')).toHaveLength(0)
    press(view, a.x, a.y)
    key(view, 'Delete')
    expect(statements(editor())).toEqual(['participant B', 'participant C', 'B->>C: three'])
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(doc('sequenceDiagram\n    A->>B: one\n    B-->>A: two\n    B->>C: three'))
  })

  it('the property bar toggles a participant between participant and actor', () => {
    const { view, editor } = open(SIMPLE)
    const layout = layoutOf(fence(editor()))
    const a = center(columnRect(layout.columns[0]!))
    press(view, a.x, a.y)
    click(tool(view, 'Actor'))
    expect(statements(editor())[0]).toBe('actor A')
    expect(tool(view, 'Actor').getAttribute('aria-pressed')).toBe('true')
    click(tool(view, 'Participant'))
    expect(statements(editor())[0]).toBe('participant A')
  })

  it('dragging a participant box reorders the columns to the one under the pointer', () => {
    const { view, editor } = open('sequenceDiagram\n    participant A\n    participant B\n    participant C\n    A->>C: x')
    const layout = layoutOf(fence(editor()))
    const a = center(columnRect(layout.columns[0]!))
    const c = center(columnRect(layout.columns[2]!))
    drag(view, a, c)
    expect(statements(editor())).toEqual(['participant B', 'participant C', 'participant A', 'A->>C: x'])
    // The moved participant stays selected at its new column.
    expect(view.container.querySelectorAll('.rmk-sequence-outline')).toHaveLength(1)
    run(() => editor().undo())
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'participant C', 'A->>C: x'])
    // A click without travel is a selection, not a reorder.
    press(view, a.x, a.y)
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'participant C', 'A->>C: x'])
  })

  it('Enter edits the label inline, the id follows a label that was the id, keystrokes merge into one entry, Enter commits and Escape cancels', () => {
    vi.useFakeTimers()
    const { view, editor } = open(SIMPLE)
    const layout = layoutOf(fence(editor()))
    const a = center(columnRect(layout.columns[0]!))
    press(view, a.x, a.y)
    key(view, 'Enter')
    const input = field(view)
    expect(input.value).toBe('A')
    type(input, 'Au')
    vi.advanceTimersByTime(50)
    type(input, 'Auth')
    vi.advanceTimersByTime(50)
    type(input, 'Auth Service')
    expect(statements(editor())).toEqual(['participant AuthService as Auth Service', 'participant B', 'AuthService->>B: one', 'B-->>AuthService: two'])
    fieldKey(input, 'Enter')
    expect(view.container.querySelector('.rmk-sequence-text-input')).toBeNull()
    expect(document.activeElement).toBe(root(view))
    // The burst is one undo step.
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(doc(SIMPLE))
    run(() => editor().redo())
    expect(statements(editor())[0]).toBe('participant AuthService as Auth Service')

    // Escape restores the original label.
    const again = layoutOf(fence(editor()))
    const b = center(columnRect(again.columns[1]!))
    pointer(layer(view), 'dblclick', b.x, b.y)
    const second = field(view)
    expect(second.value).toBe('B')
    type(second, 'Bob')
    expect(statements(editor())[1]).toBe('participant Bob')
    fieldKey(second, 'Escape')
    expect(view.container.querySelector('.rmk-sequence-text-input')).toBeNull()
    expect(statements(editor())[1]).toBe('participant B')
  })
})

describe('the sequence canvas: messages', () => {
  it('dragging from one lifeline to another adds a `->>` message at the row under the pointer and opens its text for editing', () => {
    const { view, editor } = open(SIMPLE)
    const layout = layoutOf(fence(editor()))
    const [a, b] = layout.columns
    const y = insertionY(layout, 1)
    drag(view, { x: a!.x, y }, { x: b!.x, y })
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>B: one', 'A->>B:', 'B-->>A: two'])
    const input = field(view)
    expect(input.value).toBe('')
    type(input, 'hello')
    expect(statements(editor())[3]).toBe('A->>B: hello')
    fieldKey(input, 'Enter')
    expect(view.container.querySelector('.rmk-sequence-text-input')).toBeNull()
    // The message and its text are one undo step each: structure, then the typing burst.
    run(() => editor().undo())
    expect(statements(editor())[3]).toBe('A->>B:')
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(doc(SIMPLE))
  })

  it('dragging to the same lifeline adds a self message, below every row when released past them; a click on a lifeline adds nothing', () => {
    const { view, editor } = open(SIMPLE)
    const layout = layoutOf(fence(editor()))
    const a = layout.columns[0]!
    press(view, a.x, insertionY(layout, 1))
    expect(editor().getMarkdown()).toBe(doc(SIMPLE))
    const bottom = insertionY(layout, 2)
    drag(view, { x: a.x, y: bottom - 12 }, { x: a.x + 4, y: bottom })
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>B: one', 'B-->>A: two', 'A->>A:'])
  })

  it('a drag released away from any lifeline adds nothing', () => {
    const { view, editor } = open(SIMPLE)
    const layout = layoutOf(fence(editor()))
    const a = layout.columns[0]!
    const y = insertionY(layout, 1)
    drag(view, { x: a.x, y }, { x: layout.width + 200, y })
    expect(editor().getMarkdown()).toBe(doc(SIMPLE))
  })

  it('dragging a message vertically reorders it among its siblings', () => {
    const { view, editor } = open('sequenceDiagram\n    A->>B: one\n    B-->>A: two\n    A->>B: three')
    const layout = layoutOf(fence(editor()))
    const first = messageMid(layout.messages[0]!)
    drag(view, first, { x: first.x, y: insertionY(layout, 3) })
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'B-->>A: two', 'A->>B: three', 'A->>B: one'])
    expect(view.container.querySelectorAll('.rmk-sequence-outline')).toHaveLength(1)
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(doc('sequenceDiagram\n    A->>B: one\n    B-->>A: two\n    A->>B: three'))
  })

  it('the property bar sets the line, the head, two-way and swaps the ends', () => {
    const { view, editor } = open(SIMPLE)
    const layout = layoutOf(fence(editor()))
    const first = messageMid(layout.messages[0]!)
    press(view, first.x, first.y)
    click(tool(view, 'Dotted line'))
    expect(statements(editor())[2]).toBe('A-->>B: one')
    click(tool(view, 'Open arrowhead'))
    expect(statements(editor())[2]).toBe('A--)B: one')
    click(tool(view, 'Cross'))
    expect(statements(editor())[2]).toBe('A--xB: one')
    click(tool(view, 'No arrowhead'))
    expect(statements(editor())[2]).toBe('A-->B: one')
    click(tool(view, 'Two-way arrow'))
    expect(statements(editor())[2]).toBe('A<<-->>B: one')
    click(tool(view, 'Solid line'))
    expect(statements(editor())[2]).toBe('A<<->>B: one')
    click(tool(view, 'One-way arrow'))
    expect(statements(editor())[2]).toBe('A->>B: one')
    click(tool(view, 'Swap ends'))
    expect(statements(editor())[2]).toBe('B->>A: one')
    // Eight changes, eight entries.
    for (let i = 0; i < 8; i += 1) run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(doc(SIMPLE))
  })

  it('the property bar sets the activation suffix, offering `-` only where it deactivates something', () => {
    const { view, editor } = open(SIMPLE)
    const layout = layoutOf(fence(editor()))
    const first = messageMid(layout.messages[0]!)
    press(view, first.x, first.y)
    expect(tool(view, 'Deactivate the sender (-)').disabled).toBe(true)
    click(tool(view, 'Activate the receiver (+)'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>+B: one', 'B-->>A: two', 'deactivate B'])
    const second = messageMid(layoutOf(fence(editor())).messages[1]!)
    press(view, second.x, second.y)
    expect(tool(view, 'Deactivate the sender (-)').disabled).toBe(false)
    click(tool(view, 'Deactivate the sender (-)'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>+B: one', 'B-->>-A: two'])
    click(tool(view, 'No activation'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>+B: one', 'B-->>A: two', 'deactivate B'])
  })

  it('a double click edits a message text inline, and Delete removes the selected message', () => {
    const { view, editor } = open(SIMPLE)
    const layout = layoutOf(fence(editor()))
    const first = messageMid(layout.messages[0]!)
    pointer(layer(view), 'dblclick', first.x, first.y)
    const input = field(view)
    expect(input.value).toBe('one')
    type(input, 'first #1; go')
    expect(statements(editor())[2]).toBe('A->>B: first #35;1#59; go')
    fieldKey(input, 'Enter')
    const second = messageMid(layoutOf(fence(editor())).messages[1]!)
    press(view, second.x, second.y)
    key(view, 'Backspace')
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>B: first #35;1#59; go'])
  })
})

describe('the sequence canvas: notes', () => {
  it('hovering a lifeline gap shows the "+" affordance; clicking it adds a note over that participant at that row and opens its text', () => {
    const { view, editor } = open(SIMPLE)
    const layout = layoutOf(fence(editor()))
    const b = layout.columns[1]!
    expect(view.container.querySelector('.rmk-sequence-add-note')).toBeNull()
    pointer(layer(view), 'pointermove', b.x, insertionY(layout, 1))
    const affordance = query(view, '.rmk-sequence-add-note')
    expect(affordance.querySelector('title')?.textContent).toBe('Add note')
    pointer(affordance, 'pointerdown', b.x, insertionY(layout, 1))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>B: one', 'Note over B:', 'B-->>A: two'])
    const input = field(view)
    type(input, 'wait')
    expect(statements(editor())[3]).toBe('Note over B: wait')
    fieldKey(input, 'Enter')
    // Over a message, no affordance.
    const mid = messageMid(layoutOf(fence(editor())).messages[0]!)
    pointer(layer(view), 'pointermove', mid.x, mid.y)
    expect(view.container.querySelector('.rmk-sequence-add-note')).toBeNull()
  })

  it('the property bar moves a note between left of, right of and over, and adds or removes the second participant', () => {
    const { view, editor } = open('sequenceDiagram\n    A->>B: one\n    Note over A: n')
    const layout = layoutOf(fence(editor()))
    const note = center(noteRect(layout.notes[0]!))
    press(view, note.x, note.y)
    click(tool(view, 'Left of'))
    expect(statements(editor())[3]).toBe('Note left of A: n')
    click(tool(view, 'Right of'))
    expect(statements(editor())[3]).toBe('Note right of A: n')
    click(tool(view, 'Over'))
    expect(statements(editor())[3]).toBe('Note over A: n')
    const select = query<HTMLSelectElement>(view, 'select[aria-label="Second participant"]')
    expect([...select.options].map((option) => option.textContent)).toEqual(['None', 'B'])
    run(() => {
      select.value = 'B'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(statements(editor())[3]).toBe('Note over A,B: n')
    run(() => {
      query<HTMLSelectElement>(view, 'select[aria-label="Second participant"]').value = ''
      query<HTMLSelectElement>(view, 'select[aria-label="Second participant"]').dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(statements(editor())[3]).toBe('Note over A: n')
  })

  it('dragging a note vertically reorders it', () => {
    const { view, editor } = open('sequenceDiagram\n    A->>B: one\n    Note over A: n\n    B-->>A: two')
    const layout = layoutOf(fence(editor()))
    const note = center(noteRect(layout.notes[0]!))
    drag(view, note, { x: note.x, y: insertionY(layout, 0) })
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'Note over A: n', 'A->>B: one', 'B-->>A: two'])
  })
})

describe('the sequence canvas: frames', () => {
  it('"Wrap in" wraps the selected message, opens the label for editing, and a Shift+click range wraps contiguous siblings', () => {
    const { view, editor } = open('sequenceDiagram\n    A->>B: one\n    B-->>A: two\n    A->>B: three')
    const layout = layoutOf(fence(editor()))
    const first = messageMid(layout.messages[0]!)
    press(view, first.x, first.y)
    click(tool(view, 'Wrap in loop'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'loop', 'A->>B: one', 'end', 'B-->>A: two', 'A->>B: three'])
    const label = field(view)
    expect(label.value).toBe('')
    type(label, 'retry')
    expect(statements(editor())[2]).toBe('loop retry')
    fieldKey(label, 'Enter')
    // The wrap and the typing burst are one entry each.
    run(() => editor().undo())
    expect(statements(editor())[2]).toBe('loop')
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(doc('sequenceDiagram\n    A->>B: one\n    B-->>A: two\n    A->>B: three'))

    const again = layoutOf(fence(editor()))
    const second = messageMid(again.messages[1]!)
    const third = messageMid(again.messages[2]!)
    press(view, second.x, second.y)
    press(view, third.x, third.y, { shiftKey: true })
    expect(view.container.querySelectorAll('.rmk-sequence-outline')).toHaveLength(2)
    click(tool(view, 'Wrap in alt'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>B: one', 'alt', 'B-->>A: two', 'A->>B: three', 'end'])
    fieldKey(field(view), 'Escape')
  })

  it('clicking a frame tab selects the frame; the property bar adds a section after the current one and unwraps; Delete unwraps too', () => {
    const { view, editor } = open('sequenceDiagram\n    alt a\n        A->>B: one\n    else b\n        B-->>A: two\n    end')
    const layout = layoutOf(fence(editor()))
    const frame = layout.frames[0]!
    const tab = center(frameTabRect(frame))
    press(view, tab.x, tab.y)
    expect(view.container.querySelectorAll('.rmk-sequence-outline')).toHaveLength(1)
    click(tool(view, 'Add section'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'alt a', 'A->>B: one', 'else', 'else b', 'B-->>A: two', 'end'])
    const label = field(view)
    type(label, 'maybe')
    expect(statements(editor())[4]).toBe('else maybe')
    fieldKey(label, 'Enter')
    // A divider strip selects its section; the new one goes after it.
    const withThree = layoutOf(fence(editor()))
    const divider = center(sectionRect(withThree.frames[0]!, 2))
    press(view, divider.x, divider.y)
    click(tool(view, 'Add section'))
    fieldKey(field(view), 'Escape')
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'alt a', 'A->>B: one', 'else maybe', 'else b', 'B-->>A: two', 'else', 'end'])
    click(tool(view, 'Unwrap frame'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>B: one', 'B-->>A: two'])
    run(() => editor().undo())
    const restored = layoutOf(fence(editor()))
    const restoredTab = center(frameTabRect(restored.frames[0]!))
    press(view, restoredTab.x, restoredTab.y)
    key(view, 'Delete')
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>B: one', 'B-->>A: two'])
    // A loop has no dividers, so no "Add section".
    const loop = open('sequenceDiagram\n    loop l\n        A->>B: one\n    end')
    const loopTab = center(frameTabRect(layoutOf(fence(loop.editor())).frames[0]!))
    press(loop.view, loopTab.x, loopTab.y)
    expect(loop.view.container.querySelector('.rmk-diagram-tool[aria-label="Add section"]')).toBeNull()
    expect(loop.view.container.querySelector('.rmk-diagram-tool[aria-label="Unwrap frame"]')).not.toBeNull()
  })

  it('a double click on a frame tab or a divider edits that label inline', () => {
    const { view, editor } = open('sequenceDiagram\n    alt a\n        A->>B: one\n    else b\n        B-->>A: two\n    end')
    const layout = layoutOf(fence(editor()))
    const tab = center(frameTabRect(layout.frames[0]!))
    pointer(layer(view), 'dblclick', tab.x, tab.y)
    const label = field(view)
    expect(label.value).toBe('a')
    type(label, 'yes')
    fieldKey(label, 'Enter')
    expect(statements(editor())[2]).toBe('alt yes')
    const divider = center(sectionRect(layoutOf(fence(editor())).frames[0]!, 1))
    pointer(layer(view), 'dblclick', divider.x, divider.y)
    const second = field(view)
    expect(second.value).toBe('b')
    type(second, 'no')
    fieldKey(second, 'Enter')
    expect(statements(editor())[4]).toBe('else no')
  })

  it('dragging a frame bottom edge extends it over following siblings and shrinks it back', () => {
    const { view, editor } = open('sequenceDiagram\n    loop l\n        A->>B: one\n    end\n    B-->>A: two\n    A->>B: three')
    const layout = layoutOf(fence(editor()))
    const frame = layout.frames[0]!
    const edge = center(frameBottomRect(frame))
    drag(view, edge, { x: edge.x, y: layout.messages[1]!.y + 4 })
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'loop l', 'A->>B: one', 'B-->>A: two', 'end', 'A->>B: three'])
    const grown = layoutOf(fence(editor()))
    const grownEdge = center(frameBottomRect(grown.frames[0]!))
    drag(view, grownEdge, { x: grownEdge.x, y: grown.messages[0]!.y + 4 })
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'loop l', 'A->>B: one', 'end', 'B-->>A: two', 'A->>B: three'])
  })
})

describe('the sequence canvas: tool row', () => {
  it('the autonumber toggle sets and clears numbering at 1, 1', () => {
    const { view, editor } = open(SIMPLE)
    click(tool(view, 'Autonumber'))
    expect(statements(editor())[0]).toBe('autonumber')
    expect(tool(view, 'Autonumber').getAttribute('aria-pressed')).toBe('true')
    click(tool(view, 'Autonumber'))
    expect(statements(editor())).toEqual(['participant A', 'participant B', 'A->>B: one', 'B-->>A: two'])
    run(() => editor().undo())
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(doc(SIMPLE))
  })

  it('"Copy as Mermaid" copies what a commit would write, retained lines included', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const body = 'sequenceDiagram\n    %% kept\n    A->>B: one'
    const { view, editor } = open(body)
    click(tool(view, 'Copy as Mermaid'))
    await runAsync(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(writeText).toHaveBeenCalledTimes(1)
    const copied = writeText.mock.calls[0]?.[0] ?? ''
    expect(copied).toBe('sequenceDiagram\n    participant A\n    participant B\n    %% kept\n    A->>B: one')
    click(tool(view, 'Autonumber'))
    expect(fence(editor())).toBe('sequenceDiagram\n    autonumber\n    participant A\n    participant B\n    %% kept\n    A->>B: one')
  })

  it('adopts an outside change: an undo from the toolbar drops the selection and shows the restored picture', () => {
    const { view, editor } = open(SIMPLE)
    click(tool(view, 'Add participant'))
    expect(view.container.querySelectorAll('.rmk-sequence-outline')).toHaveLength(1)
    run(() => editor().undo())
    expect(view.container.querySelectorAll('.rmk-sequence-outline')).toHaveLength(0)
    expect(query(view, '.rmk-sequence-picture svg').textContent).not.toContain('Participant')
  })
})
