/**
 * The per-kind canvas slot of the block (docs/MERMAID_PLATFORM.md section
 * 9.2): a kind that writes and has a component in `editors` mounts on it
 * with the Text/Canvas toggle and receives the `DiagramKindEditorProps`
 * contract; `write` is read at render time; `mermaid({ editors })` adds a
 * component for a third-party kind and replaces a built-in by name; the
 * block owns the commit (discrete, one history entry per commit, merged
 * under 300 ms when asked, never across an outside change), the lossy lock
 * and its notice for every canvas kind, and the read-only rules. The
 * sequence kind takes the slot once it writes.
 */
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownEditor, useMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { button, click, mount, run, type Mounted } from '../../../packages/editor/tests/helpers/mount.js'
import {
  flowchart,
  mermaid,
  sequenceDiagram,
  type DiagramKind,
  type DiagramKindEditorProps,
  type MermaidEditorOptions,
} from '../src/editor.js'

/** A kind whose model is its statements, one per line, so a canvas can write it back. */
interface LinesModel {
  readonly lines: readonly string[]
}

const LINES_KIND = 'linesDiagram'

/**
 * The test kind. A line starting with `!` names `bang` as lossy and one
 * starting with `?` names `question`, so a document can change what the
 * canvas cannot keep. `write: false` leaves the writer out.
 */
function linesKind(options: { readonly write?: boolean } = {}): DiagramKind<LinesModel> {
  const write = (model: LinesModel): string => [LINES_KIND, ...model.lines.map((line) => `    ${line}`)].join('\n')
  return {
    name: LINES_KIND,
    keywords: [LINES_KIND],
    label: 'Lines',
    starter: `${LINES_KIND}\n    one`,
    parse(source) {
      const [header, ...rest] = source.split('\n')
      if (header?.trim() !== LINES_KIND) return { error: 'Not a lines diagram.' }
      const lines = rest.map((line) => line.trim()).filter((line) => line !== '')
      const lossy = [...(lines.some((line) => line.startsWith('!')) ? ['bang'] : []), ...(lines.some((line) => line.startsWith('?')) ? ['question'] : [])]
      return { model: { lines }, problems: [], retained: [], lossy }
    },
    render: (model) => ({
      type: 'element',
      tagName: 'svg',
      properties: { role: 'img' },
      children: [
        { type: 'element', tagName: 'title', properties: {}, children: [{ type: 'text', value: 'Lines' }] },
        ...model.lines.map((line) => ({ type: 'element' as const, tagName: 'text', properties: {}, children: [{ type: 'text' as const, value: line }] })),
      ],
    }),
    ...(options.write === false ? {} : { write }),
  }
}

/** The kind without `write`: the block edits it as text whatever the built-in gains. */
function sourceOnly(kind: DiagramKind): DiagramKind {
  return Object.fromEntries(Object.entries(kind).filter(([key]) => key !== 'write')) as unknown as DiagramKind
}

/** The sequence kind with a writer, whether or not the built-in has one yet. */
function writingSequence(): DiagramKind {
  const kind = sequenceDiagram()
  return { ...kind, write: kind.write ?? (() => 'sequenceDiagram\n    A->>B: x') }
}

/** The props the test component last rendered with. */
let received: DiagramKindEditorProps | null = null

/** A canvas for `linesKind`: "add" commits a new line, "type" extends the last line and asks to merge. */
function LinesEditor(props: DiagramKindEditorProps): ReactElement {
  received = props
  // Standing in for a built-in, the model is that kind's; only `lines` is read.
  const model: LinesModel = { lines: (props.parse.model as Partial<LinesModel>).lines ?? [] }
  const write = (lines: readonly string[]): string =>
    (props.kind as DiagramKind<LinesModel>).write?.({ lines }, { retained: props.parse.retained }) ?? ''
  return (
    <div className="lines-editor" data-rmk-diagram-focus="" tabIndex={0} data-read-only={props.readOnly ? 'true' : 'false'}>
      <span className="lines-count">{model.lines.length}</span>
      <button type="button" className="lines-add" onClick={() => props.commit(write([...model.lines, `line${model.lines.length + 1}`]))}>
        add
      </button>
      <button
        type="button"
        className="lines-type"
        onClick={() => props.commit(write([...model.lines.slice(0, -1), `${model.lines[model.lines.length - 1] ?? ''}x`]), { merge: true })}
      >
        type
      </button>
    </div>
  )
}

const LINES_DOC = `Before.\n\n\`\`\`mermaid\n${LINES_KIND}\n    a\n    b\n\`\`\`\n\nAfter.\n`

function Capture({ onReady }: { onReady: (editor: MarkdownEditorInstance) => void }): null {
  onReady(useMarkdownEditorContext())
  return null
}

const views: Mounted[] = []
function open(
  value: string,
  options: MermaidEditorOptions = { kinds: [flowchart(), linesKind()], editors: { [LINES_KIND]: LinesEditor } },
  readOnly = false,
): { view: Mounted; editor: () => MarkdownEditorInstance } {
  let editor!: MarkdownEditorInstance
  const view = mount(
    <MarkdownEditor extensions={[mermaid(options)]} defaultValue={value} readOnly={readOnly}>
      <Capture onReady={(value) => (editor = value)} />
    </MarkdownEditor>,
  )
  views.push(view)
  return { view, editor: () => editor }
}

function fence(editor: MarkdownEditorInstance): string {
  const match = /```mermaid\n([\s\S]*?)\n```/.exec(editor.getMarkdown())
  return match?.[1] ?? ''
}

function modeButton(view: Mounted, label: 'Text' | 'Canvas'): HTMLButtonElement {
  const found = view.container.querySelector<HTMLButtonElement>(`.rmk-diagram-mode-button[aria-label="${label}"]`)
  if (found === null) throw new Error(`No ${label} toggle.`)
  return found
}

afterEach(() => {
  for (const view of views.splice(0)) view.unmount()
  received = null
  vi.useRealTimers()
})

describe('the per-kind canvas slot', () => {
  it('mounts a kind that writes on its component from `editors`, with the toggle, and hands it the contract', () => {
    const { view } = open(LINES_DOC)
    const block = view.container.querySelector('.rmk-diagram-block')
    expect(block?.getAttribute('data-rmk-diagram-kind')).toBe(LINES_KIND)
    expect(block?.getAttribute('data-rmk-diagram-mode')).toBe('canvas')
    expect(view.container.querySelector('.rmk-diagram-kind')?.textContent).toBe('Lines')
    expect(view.container.querySelector('.lines-editor')).not.toBeNull()
    expect(view.container.querySelector('.rmk-diagram-source-input')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-mode')).not.toBeNull()
    expect(received?.kind.name).toBe(LINES_KIND)
    expect(received?.source).toBe(`${LINES_KIND}\n    a\n    b`)
    expect(received?.parse.model).toEqual({ lines: ['a', 'b'] })
    expect(received?.readOnly).toBe(false)
    expect(typeof received?.commit).toBe('function')
  })

  it('toggles between text and the component, and back', () => {
    const { view } = open(LINES_DOC)
    expect(modeButton(view, 'Canvas').getAttribute('aria-pressed')).toBe('true')
    click(modeButton(view, 'Text'))
    expect(view.container.querySelector('.lines-editor')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('source')
    expect(view.container.querySelector<HTMLTextAreaElement>('.rmk-diagram-source-input')?.value).toBe(`${LINES_KIND}\n    a\n    b`)
    expect(modeButton(view, 'Text').getAttribute('aria-pressed')).toBe('true')
    click(modeButton(view, 'Canvas'))
    expect(view.container.querySelector('.lines-editor')).not.toBeNull()
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('canvas')
  })

  it('reads `write` at render time: a kind with a component but no writer is edited as text, without the toggle', () => {
    const { view } = open(LINES_DOC, { kinds: [flowchart(), linesKind({ write: false })], editors: { [LINES_KIND]: LinesEditor } })
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('source')
    expect(view.container.querySelector('.lines-editor')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-mode')).toBeNull()
    expect(view.container.querySelector<HTMLTextAreaElement>('.rmk-diagram-source-input')?.value).toBe(`${LINES_KIND}\n    a\n    b`)
    expect(received).toBeNull()
  })

  it('edits a kind that writes but has no component as text', () => {
    const { view } = open(LINES_DOC, { kinds: [flowchart(), linesKind()] })
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('source')
    expect(view.container.querySelector('.rmk-diagram-mode')).toBeNull()
  })

  it('replaces a built-in component by name', () => {
    const { view } = open('```mermaid\nflowchart LR\n    a --> b\n```\n', { editors: { flowchart: LinesEditor } })
    expect(view.container.querySelector('.rmk-diagram-canvas')).toBeNull()
    expect(view.container.querySelector('.lines-editor')).not.toBeNull()
    expect(received?.kind.name).toBe('flowchart')
    expect(received?.source).toBe('flowchart LR\n    a --> b')

    const sequence = open('```mermaid\nsequenceDiagram\n    A->>B: x\n```\n', {
      kinds: [flowchart(), writingSequence()],
      editors: { sequenceDiagram: LinesEditor },
    })
    expect(sequence.view.container.querySelector('.lines-editor')).not.toBeNull()
    expect(received?.kind.name).toBe('sequenceDiagram')
    // The other built-in keeps its component.
    const flow = open('```mermaid\nflowchart LR\n    a --> b\n```\n', { editors: { sequenceDiagram: LinesEditor } })
    expect(flow.view.container.querySelector('.rmk-diagram-canvas')).not.toBeNull()
  })

  it('commits discretely as one history entry, and the component sees its own commit back as the parse', () => {
    const { view, editor } = open(LINES_DOC)
    const add = view.container.querySelector<HTMLButtonElement>('.lines-add')
    if (add === null) throw new Error('No add button.')
    let seen = ''
    run(() => {
      add.click()
      seen = editor().getMarkdown()
    })
    expect(seen).toContain(`${LINES_KIND}\n    a\n    b\n    line3\n\`\`\``)
    expect(received?.source).toBe(`${LINES_KIND}\n    a\n    b\n    line3`)
    expect(received?.parse.model).toEqual({ lines: ['a', 'b', 'line3'] })
    expect(view.container.querySelector('.lines-count')?.textContent).toBe('3')
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(LINES_DOC)
    expect(view.container.querySelector('.lines-count')?.textContent).toBe('2')
    run(() => editor().redo())
    expect(fence(editor())).toBe(`${LINES_KIND}\n    a\n    b\n    line3`)
  })

  it('merges commits under 300 ms when asked, separates a slow one, and never merges across an outside change', () => {
    vi.useFakeTimers()
    const { view, editor } = open(LINES_DOC)
    const type = (): void => click(view.container.querySelector('.lines-type'))
    type()
    vi.advanceTimersByTime(50)
    type()
    vi.advanceTimersByTime(50)
    type()
    expect(fence(editor())).toBe(`${LINES_KIND}\n    a\n    bxxx`)
    // Three quick merged commits undo as one step.
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(LINES_DOC)
    run(() => editor().redo())
    expect(fence(editor())).toBe(`${LINES_KIND}\n    a\n    bxxx`)
    // A slow one is its own step.
    vi.advanceTimersByTime(1000)
    type()
    expect(fence(editor())).toBe(`${LINES_KIND}\n    a\n    bxxxx`)
    run(() => editor().undo())
    expect(fence(editor())).toBe(`${LINES_KIND}\n    a\n    bxxx`)
    // An undo from outside ends the burst: the next merge request is a new
    // entry, not a fold into the entry the undo restored.
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(LINES_DOC)
    vi.advanceTimersByTime(100)
    type()
    expect(fence(editor())).toBe(`${LINES_KIND}\n    a\n    bx`)
    run(() => editor().undo())
    expect(editor().getMarkdown()).toBe(LINES_DOC)
    run(() => editor().redo())
    expect(fence(editor())).toBe(`${LINES_KIND}\n    a\n    bx`)
  })

  it('does not merge when the component does not ask, however quick', () => {
    vi.useFakeTimers()
    const { view, editor } = open(LINES_DOC)
    click(view.container.querySelector('.lines-add'))
    vi.advanceTimersByTime(50)
    click(view.container.querySelector('.lines-add'))
    expect(fence(editor())).toBe(`${LINES_KIND}\n    a\n    b\n    line3\n    line4`)
    run(() => editor().undo())
    expect(fence(editor())).toBe(`${LINES_KIND}\n    a\n    b\n    line3`)
  })

  it('locks a lossy source behind the block notice until acknowledged, for any canvas kind', () => {
    const doc = `\`\`\`mermaid\n${LINES_KIND}\n    !a\n    b\n\`\`\`\n`
    const { view, editor } = open(doc)
    const notice = view.container.querySelector('.rmk-diagram-lossy')
    expect(notice).not.toBeNull()
    expect(notice?.closest('.lines-editor')).toBeNull()
    expect(notice?.textContent).toContain('Editing on the canvas cannot keep: bang')
    expect(received?.readOnly).toBe(true)
    expect(view.container.querySelector('.lines-editor')?.getAttribute('data-read-only')).toBe('true')
    expect(editor().getMarkdown()).toBe(doc)
    click(notice?.querySelectorAll('button')[0] ?? null)
    expect(view.container.querySelector('.rmk-diagram-lossy')).toBeNull()
    expect(received?.readOnly).toBe(false)
    // The acknowledgement holds for the same loss, across a commit and a toggle.
    click(view.container.querySelector('.lines-add'))
    expect(fence(editor())).toBe(`${LINES_KIND}\n    !a\n    b\n    line3`)
    expect(view.container.querySelector('.rmk-diagram-lossy')).toBeNull()
    click(modeButton(view, 'Text'))
    click(modeButton(view, 'Canvas'))
    expect(view.container.querySelector('.rmk-diagram-lossy')).toBeNull()
  })

  it('locks again when the text gains a loss the author has not accepted', () => {
    const { view } = open(`\`\`\`mermaid\n${LINES_KIND}\n    !a\n\`\`\`\n`)
    click(view.container.querySelector('.rmk-diagram-lossy button'))
    expect(view.container.querySelector('.rmk-diagram-lossy')).toBeNull()
    click(modeButton(view, 'Text'))
    const textarea = view.container.querySelector<HTMLTextAreaElement>('.rmk-diagram-source-input')
    if (textarea === null) throw new Error('No textarea.')
    run(() => {
      textarea.value = `${LINES_KIND}\n    !a\n    ?b`
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    click(modeButton(view, 'Canvas'))
    expect(view.container.querySelector('.rmk-diagram-lossy')?.textContent).toContain('cannot keep: bang, question')
    expect(received?.readOnly).toBe(true)
  })

  it('"Edit as text" in the notice switches to source mode; the toggle brings the notice back', () => {
    const { view } = open(`\`\`\`mermaid\n${LINES_KIND}\n    !a\n\`\`\`\n`)
    click(view.container.querySelector('.rmk-diagram-lossy')?.querySelectorAll('button')[1] ?? null)
    expect(view.container.querySelector('.lines-editor')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('source')
    click(modeButton(view, 'Canvas'))
    expect(view.container.querySelector('.rmk-diagram-lossy')).not.toBeNull()
    expect(received?.readOnly).toBe(true)
  })

  it('renders read-only as the static output, never the component', () => {
    const { view } = open(LINES_DOC, undefined, true)
    expect(view.container.querySelector('.lines-editor')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-mode')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-preview svg')?.textContent).toContain('a')
    expect(received).toBeNull()
  })

  it('focuses the component after an insert through its focus marker', () => {
    const { view, editor } = open('Hello.')
    click(button(view.container, `diagram-${LINES_KIND}`))
    expect(fence(editor())).toBe(`${LINES_KIND}\n    one`)
    expect(document.activeElement).toBe(view.container.querySelector('.lines-editor'))
  })

  it('puts the sequence kind on its canvas slot once it writes: canvas mode, the toggle, insert focus', () => {
    const options: MermaidEditorOptions = { kinds: [flowchart(), writingSequence()] }
    const { view } = open('```mermaid\nsequenceDiagram\n    A->>B: x\n```\n', options)
    const block = view.container.querySelector('.rmk-diagram-block')
    expect(block?.getAttribute('data-rmk-diagram-kind')).toBe('sequenceDiagram')
    expect(block?.getAttribute('data-rmk-diagram-mode')).toBe('canvas')
    expect(view.container.querySelector('.rmk-diagram-source-input')).toBeNull()
    expect(view.container.querySelector('.rmk-diagram-mode')).not.toBeNull()
    click(modeButton(view, 'Text'))
    expect(view.container.querySelector<HTMLTextAreaElement>('.rmk-diagram-source-input')?.value).toBe('sequenceDiagram\n    A->>B: x')

    const inserted = open('Hello.', options)
    click(button(inserted.view.container, 'diagram-sequenceDiagram'))
    const insertedBlock = inserted.view.container.querySelector('.rmk-diagram-block')
    expect(insertedBlock?.getAttribute('data-rmk-diagram-mode')).toBe('canvas')
    expect(insertedBlock?.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('keeps a sequence kind without a writer as text', () => {
    const { view } = open('```mermaid\nsequenceDiagram\n    A->>B: x\n```\n', { kinds: [flowchart(), sourceOnly(sequenceDiagram())] })
    expect(view.container.querySelector('.rmk-diagram-block')?.getAttribute('data-rmk-diagram-mode')).toBe('source')
    expect(view.container.querySelector('.rmk-diagram-mode')).toBeNull()
  })
})
