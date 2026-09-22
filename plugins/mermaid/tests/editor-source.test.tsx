/**
 * Source mode inside <MarkdownEditor>: a sequence fence renders its preview
 * and problems, typing commits the source without a keystroke reaching
 * Lexical, the editing component holds while the textarea has focus and
 * switches on blur, quick keystrokes coalesce into one undo step, undo keys
 * route to Lexical, Tab indents, Escape moves to the header, unregistered
 * kinds show their notice, and `sourceEditor: false` hides the textarea.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownEditor, useMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { mount, run, type Mounted } from '../../../packages/editor/tests/helpers/mount.js'
import { mermaid } from '../src/editor.js'

const SEQUENCE = 'sequenceDiagram\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi'
const SEQUENCE_DOC = `Before.\n\n\`\`\`mermaid\n${SEQUENCE}\n\`\`\`\n\nAfter.\n`
/** One `ignored` line (a link) and one `invalid` line (a stray `end`). */
const PROBLEMS = 'sequenceDiagram\n    link Alice: Docs @ https://example.com\n    Alice->>Bob: Hello\n    end'
const PROBLEMS_DOC = `\`\`\`mermaid\n${PROBLEMS}\n\`\`\`\n`

function Capture({ onReady }: { onReady: (editor: MarkdownEditorInstance) => void }): null {
  onReady(useMarkdownEditorContext())
  return null
}

const views: Mounted[] = []
function open(value: string, options: Parameters<typeof mermaid>[0] = {}): { view: Mounted; editor: () => MarkdownEditorInstance } {
  let editor!: MarkdownEditorInstance
  const view = mount(
    <MarkdownEditor extensions={[mermaid(options)]} defaultValue={value}>
      <Capture onReady={(value) => (editor = value)} />
    </MarkdownEditor>,
  )
  views.push(view)
  return { view, editor: () => editor }
}

function textareaOf(view: Mounted): HTMLTextAreaElement {
  const textarea = view.container.querySelector<HTMLTextAreaElement>('.rmk-diagram-source-input')
  if (textarea === null) throw new Error('No source textarea.')
  return textarea
}

/** Types like a user: sets the value, fires `input`, one commit per call. */
function type(textarea: HTMLTextAreaElement, value: string): void {
  run(() => {
    textarea.value = value
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function keydown(target: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  run(() => {
    target.dispatchEvent(event)
  })
  return event
}

function focus(element: HTMLElement): void {
  run(() => {
    element.focus()
  })
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  for (const view of views.splice(0)) view.unmount()
  vi.useRealTimers()
})

describe('source mode', () => {
  it('renders the header, a preview and the textarea for a sequence fence', () => {
    const { view } = open(SEQUENCE_DOC)
    const block = view.container.querySelector('.rmk-diagram-block')
    expect(block?.getAttribute('data-rmk-diagram-kind')).toBe('sequenceDiagram')
    expect(block?.getAttribute('data-rmk-diagram-support')).toBe('static')
    expect(block?.getAttribute('data-rmk-diagram-mode')).toBe('source')
    expect(view.container.querySelector('.rmk-diagram-kind')?.textContent).toBe('Sequence diagram')
    expect(view.container.querySelector('.rmk-diagram-badge')?.textContent).toBe('Static')
    // No canvas toggle for a kind the canvas does not draw.
    expect(view.container.querySelector('.rmk-diagram-mode')).toBeNull()
    const svg = view.container.querySelector('.rmk-diagram-preview svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.textContent).toContain('Alice')
    expect(svg?.textContent).toContain('Hello')
    expect(textareaOf(view).value).toBe(SEQUENCE)
    expect(view.container.querySelector('.rmk-diagram-problems')).toBeNull()
  })

  it('lists problems with line numbers, invalid first with the Mermaid rejects prefix', () => {
    const { view } = open(PROBLEMS_DOC)
    const items = [...view.container.querySelectorAll('.rmk-diagram-problems li')]
    expect(items.length).toBe(2)
    expect(items[0]?.getAttribute('data-rmk-diagram-severity')).toBe('invalid')
    expect(items[0]?.textContent).toMatch(/^Line 4: Mermaid rejects: /)
    expect(items[1]?.getAttribute('data-rmk-diagram-severity')).toBe('ignored')
    expect(items[1]?.textContent).toMatch(/^Line 2: /)
    expect(items[1]?.textContent).not.toContain('Mermaid rejects')
  })

  it('commits typed text to the document and updates the preview', () => {
    const { view, editor } = open(SEQUENCE_DOC)
    const textarea = textareaOf(view)
    focus(textarea)
    type(textarea, SEQUENCE + '\n    Note over Alice: done')
    expect(editor().getMarkdown()).toBe(`Before.\n\n\`\`\`mermaid\n${SEQUENCE}\n    Note over Alice: done\n\`\`\`\n\nAfter.\n`)
    expect(view.container.querySelector('.rmk-diagram-preview svg')?.textContent).toContain('done')
  })

  it('stops key and clipboard events at the textarea so Lexical never sees them', () => {
    const { view } = open(SEQUENCE_DOC)
    const textarea = textareaOf(view)
    const root = view.container.querySelector('[role="textbox"]')
    if (root === null) throw new Error('No editor root.')
    const seen: string[] = []
    const record = (event: Event): void => {
      seen.push(event.type)
    }
    const types = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste', 'cut', 'copy', 'drop', 'compositionstart', 'compositionupdate', 'compositionend']
    for (const kind of types) root.addEventListener(kind, record)
    run(() => {
      for (const kind of types) textarea.dispatchEvent(new Event(kind, { bubbles: true, cancelable: true }))
    })
    for (const kind of types) root.removeEventListener(kind, record)
    expect(seen).toEqual([])
  })

  it('keeps its component while focused and switches to the canvas on blur', () => {
    const { view, editor } = open(SEQUENCE_DOC)
    const textarea = textareaOf(view)
    focus(textarea)
    type(textarea, 'flowchart LR\n    a --> b')
    // The kind and the badge follow at once; the textarea stays put.
    expect(view.container.querySelector('.rmk-diagram-kind')?.textContent).toBe('Flowchart')
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-kind')).toBe('flowchart')
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('source')
    expect(view.container.querySelector('.rmk-diagram-source-input')).toBe(textarea)
    expect(view.container.querySelector('.rmk-diagram-mode')).not.toBeNull()
    run(() => {
      textarea.blur()
    })
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('canvas')
    expect(view.container.querySelector('.rmk-diagram-source-input')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-canvas')).not.toBeNull()
    expect(editor().getMarkdown()).toContain('```mermaid\nflowchart LR\n    a --> b\n```')
  })

  it('toggles a flowchart between canvas and text, and back', () => {
    const { view } = open('```mermaid\nflowchart LR\n    a --> b\n```\n')
    expect(view.container.querySelector('.rmk-diagram-canvas')).not.toBeNull()
    const text = view.container.querySelector<HTMLButtonElement>('.rmk-diagram-mode-button[aria-label="Text"]')
    const canvas = view.container.querySelector<HTMLButtonElement>('.rmk-diagram-mode-button[aria-label="Canvas"]')
    expect(canvas?.getAttribute('aria-pressed')).toBe('true')
    run(() => text?.click())
    expect(view.container.querySelector('.rmk-diagram-canvas')).toBeNull()
    expect(textareaOf(view).value).toBe('flowchart LR\n    a --> b')
    expect(text?.getAttribute('aria-pressed')).toBe('true')
    run(() => canvas?.click())
    expect(view.container.querySelector('.rmk-diagram-canvas')).not.toBeNull()
  })

  it('coalesces three quick keystrokes into one undo step, and separates a slow one', () => {
    vi.useFakeTimers()
    const { view, editor } = open(SEQUENCE_DOC)
    const textarea = textareaOf(view)
    focus(textarea)
    type(textarea, SEQUENCE + '\n    A')
    vi.advanceTimersByTime(50)
    type(textarea, SEQUENCE + '\n    Al')
    vi.advanceTimersByTime(50)
    type(textarea, SEQUENCE + '\n    Ali')
    vi.advanceTimersByTime(1000)
    type(textarea, SEQUENCE + '\n    Alice->>Bob: again')
    expect(editor().getMarkdown()).toContain('    Alice->>Bob: again\n```')
    run(() => editor().undo())
    expect(editor().getMarkdown()).toContain(`${SEQUENCE}\n    Ali\n\`\`\``)
    expect(textareaOf(view).value).toBe(SEQUENCE + '\n    Ali')
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(SEQUENCE_DOC)
    expect(textareaOf(view).value).toBe(SEQUENCE)
    run(() => editor().redo())
    expect(textareaOf(view).value).toBe(SEQUENCE + '\n    Ali')
  })

  it('routes Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y in the textarea to Lexical', () => {
    vi.useFakeTimers()
    const { view, editor } = open(SEQUENCE_DOC)
    const textarea = textareaOf(view)
    focus(textarea)
    type(textarea, SEQUENCE + '\n    Note over Bob: x')
    vi.advanceTimersByTime(1000)
    const undo = keydown(textarea, { key: 'z', ctrlKey: true })
    expect(undo.defaultPrevented).toBe(true)
    expect(editor().getMarkdown()).toBe(SEQUENCE_DOC)
    expect(textareaOf(view).value).toBe(SEQUENCE)
    const redo = keydown(textarea, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(redo.defaultPrevented).toBe(true)
    expect(textareaOf(view).value).toBe(SEQUENCE + '\n    Note over Bob: x')
    keydown(textarea, { key: 'z', metaKey: true })
    expect(textareaOf(view).value).toBe(SEQUENCE)
    const y = keydown(textarea, { key: 'y', ctrlKey: true })
    expect(y.defaultPrevented).toBe(true)
    expect(textareaOf(view).value).toBe(SEQUENCE + '\n    Note over Bob: x')
  })

  it('indents with Tab, outdents with Shift+Tab, and moves to the header on Escape', () => {
    const { view, editor } = open('```mermaid\nsequenceDiagram\nA->>B: x\n```\n')
    const textarea = textareaOf(view)
    focus(textarea)
    run(() => textarea.setSelectionRange(16, 16))
    const tab = keydown(textarea, { key: 'Tab' })
    expect(tab.defaultPrevented).toBe(true)
    expect(textarea.value).toBe('sequenceDiagram\n  A->>B: x')
    expect(textarea.selectionStart).toBe(18)
    expect(editor().getMarkdown()).toBe('```mermaid\nsequenceDiagram\n  A->>B: x\n```\n')
    keydown(textarea, { key: 'Tab', shiftKey: true })
    expect(textarea.value).toBe('sequenceDiagram\nA->>B: x')
    expect(textarea.selectionStart).toBe(16)
    // Nothing to outdent: no change and no commit.
    keydown(textarea, { key: 'Tab', shiftKey: true })
    expect(textarea.value).toBe('sequenceDiagram\nA->>B: x')
    const escape = keydown(textarea, { key: 'Escape' })
    expect(escape.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(view.container.querySelector('.rmk-diagram-header'))
  })

  it('replaces the draft when the node changes from outside, with the caret at the end', () => {
    vi.useFakeTimers()
    const { view, editor } = open(SEQUENCE_DOC)
    const textarea = textareaOf(view)
    focus(textarea)
    type(textarea, SEQUENCE + '\n    Bob->>Alice: bye')
    vi.advanceTimersByTime(1000)
    run(() => textarea.setSelectionRange(0, 0))
    // An undo from outside the field (the toolbar) changes the node's source.
    run(() => editor().undo())
    expect(textareaOf(view)).toBe(textarea)
    expect(textarea.value).toBe(SEQUENCE)
    expect(textarea.selectionStart).toBe(SEQUENCE.length)
    run(() => textarea.setSelectionRange(0, 0))
    run(() => editor().redo())
    expect(textarea.value).toBe(SEQUENCE + '\n    Bob->>Alice: bye')
    expect(textarea.selectionStart).toBe(textarea.value.length)
  })

  it('shows the notice for a kind shown as source, and for no keyword with its hint', () => {
    const { view } = open('```mermaid\nclassDiagram\n    A <|-- B\n```\n')
    expect(view.container.querySelector('.rmk-diagram-kind')?.textContent).toBe('classDiagram')
    expect(view.container.querySelector('.rmk-diagram-badge')?.textContent).toBe('Source only')
    expect(view.container.querySelector('.rmk-diagram-preview')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-notice')?.textContent).toBe('classDiagram diagrams are shown as source.')
    expect(textareaOf(view).value).toBe('classDiagram\n    A <|-- B')

    const unknown = open('```mermaid\nSequenceDiagram\n    A->>B: x\n```\n')
    expect(unknown.view.container.querySelector('.rmk-diagram-kind')?.textContent).toBe('Not Mermaid')
    expect(unknown.view.container.querySelector('.rmk-diagram-notice')?.textContent).toBe(
      'The block does not start with a Mermaid diagram keyword. Mermaid keywords are case-sensitive; expected `sequenceDiagram`.',
    )
  })

  it('sourceEditor: false hides the textarea and keeps preview and problems', () => {
    const { view } = open(PROBLEMS_DOC, { sourceEditor: false })
    expect(view.container.querySelector('.rmk-diagram-source-input')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-preview svg')).not.toBeNull()
    expect(view.container.querySelectorAll('.rmk-diagram-problems li')).toHaveLength(2)
  })

  it('renders read-only as the preview only', () => {
    const view = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={PROBLEMS_DOC} readOnly />)
    views.push(view)
    expect(view.container.querySelector('.rmk-diagram-source-input')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-problems')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-preview svg')).not.toBeNull()
    const source = mount(<MarkdownEditor extensions={[mermaid()]} defaultValue={'```mermaid\nclassDiagram\n    A <|-- B\n```\n'} readOnly />)
    views.push(source)
    expect(source.container.querySelector('.rmk-diagram-source-pre')?.textContent).toBe('classDiagram\n    A <|-- B')
  })
})
