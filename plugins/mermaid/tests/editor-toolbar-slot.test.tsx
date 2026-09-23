/**
 * The detached tool row (docs/MERMAID_PLATFORM.md section 9.6): with a
 * `<DiagramToolbar>` mounted, a canvas renders its tool row into it instead
 * of along its own edge, the row still drives the canvas and keeps it
 * active, the slot shows the tools of the canvas that last had focus (the
 * first mounted before any has) and falls back when the owner unmounts,
 * the placeholder fills it while no canvas is on screen, and unmounting
 * the slot puts the row back inline.
 */
import { useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { MarkdownEditor, MarkdownEditorContent, MarkdownEditorProvider, useMarkdownEditor } from '@react-markdown-kit/editor'
import { click, mount, run, type Mounted } from '../../../packages/editor/tests/helpers/mount.js'
import { DiagramToolbar, mermaid } from '../src/editor.js'

const FLOWCHART = '```mermaid\nflowchart LR\n    a --> b\n```\n'
const SEQUENCE = '```mermaid\nsequenceDiagram\n    A->>B: hi\n```\n'
const CLASS = '```mermaid\nclassDiagram\n    class A\n```\n'

const FLOWCHART_ROW = '[role="toolbar"][aria-label="Drawing tools"]'
const SEQUENCE_ROW = '[role="toolbar"][aria-label="Sequence diagram tools"]'

const views: Mounted[] = []
afterEach(() => {
  for (const view of views.splice(0)) view.unmount()
})

function open(element: ReactElement): HTMLElement {
  const view = mount(element)
  views.push(view)
  return view.container
}

/** The slot as the demo mounts it: inside the provider, outside the content surface. */
function Composed({ value, slot = true }: { value: string; slot?: boolean }): ReactElement {
  const editor = useMarkdownEditor({ value, extensions: [mermaid()] })
  return (
    <MarkdownEditorProvider editor={editor}>
      {slot ? <DiagramToolbar placeholder="No canvas" /> : null}
      <div className="rmk-editor">
        <MarkdownEditorContent aria-label="Document" />
      </div>
    </MarkdownEditorProvider>
  )
}

function host(container: HTMLElement): HTMLElement {
  const found = container.querySelector<HTMLElement>('.rmk-diagram-toolbar-host')
  if (found === null) throw new Error('No toolbar host.')
  return found
}

function canvas(container: HTMLElement, selector = '.rmk-diagram-canvas'): HTMLElement {
  const found = container.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`No canvas ${selector}.`)
  return found
}

describe('<DiagramToolbar>', () => {
  it('takes the flowchart tool row out of the canvas, as a child of <MarkdownEditor> or beside the content', () => {
    for (const element of [
      <MarkdownEditor extensions={[mermaid()]} value={FLOWCHART} toolbar={false}>
        <DiagramToolbar />
      </MarkdownEditor>,
      <Composed value={FLOWCHART} />,
    ]) {
      const container = open(element)
      const slot = host(container)
      expect(slot.classList.contains('rmk-editor')).toBe(true)
      expect(slot.dataset.rmkDiagramToolbar).toBe('filled')
      const row = slot.querySelector('.rmk-diagram-toolbar')
      expect(row).not.toBeNull()
      expect(row?.classList.contains('is-detached')).toBe(true)
      expect(row?.querySelector(FLOWCHART_ROW)).not.toBeNull()
      expect(canvas(container).querySelector('.rmk-diagram-toolbar')).toBeNull()
      expect(slot.querySelector('.rmk-diagram-toolbar-placeholder')).toBeNull()
    }
  })

  it('takes the sequence tool row the same way', () => {
    const container = open(<Composed value={SEQUENCE} />)
    expect(host(container).querySelector(SEQUENCE_ROW)).not.toBeNull()
    expect(canvas(container, '.rmk-sequence-canvas').querySelector('.rmk-diagram-toolbar')).toBeNull()
  })

  it('drives the canvas from the detached row', () => {
    const container = open(<Composed value={FLOWCHART} />)
    const rectangle = host(container).querySelector<HTMLButtonElement>('button[aria-label="Rectangle"]')
    expect(rectangle?.getAttribute('aria-pressed')).toBe('false')
    click(rectangle)
    expect(rectangle?.getAttribute('aria-pressed')).toBe('true')
    expect(host(container).querySelector('button[aria-label="Select"]')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('keeps the canvas active while focus is in the detached row, and releases it when focus leaves both', () => {
    const container = open(<Composed value={FLOWCHART} />)
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    try {
      const row = (): Element | null => host(container).querySelector('.rmk-diagram-toolbar')
      expect(row()?.classList.contains('is-active')).toBe(false)
      run(() => canvas(container).focus())
      expect(row()?.classList.contains('is-active')).toBe(true)
      run(() => host(container).querySelector<HTMLButtonElement>('button[aria-label="Rectangle"]')?.focus())
      expect(row()?.classList.contains('is-active')).toBe(true)
      run(() => outside.focus())
      expect(row()?.classList.contains('is-active')).toBe(false)
    } finally {
      outside.remove()
    }
  })

  it('shows the placeholder while no canvas is on screen', () => {
    const container = open(<Composed value={CLASS} />)
    const slot = host(container)
    expect(slot.dataset.rmkDiagramToolbar).toBe('empty')
    expect(slot.querySelector('.rmk-diagram-toolbar-placeholder')?.textContent).toBe('No canvas')
    expect(slot.querySelector('.rmk-diagram-toolbar')).toBeNull()
  })

  it('shows the first canvas mounted, then the one that last had focus, then the oldest left when the owner unmounts', () => {
    const view = mount(<Composed value={FLOWCHART + '\n' + SEQUENCE} />)
    views.push(view)
    const { container } = view
    expect(host(container).querySelector(FLOWCHART_ROW)).not.toBeNull()
    expect(host(container).querySelector(SEQUENCE_ROW)).toBeNull()

    run(() => canvas(container, '.rmk-sequence-canvas').focus())
    expect(host(container).querySelector(FLOWCHART_ROW)).toBeNull()
    expect(host(container).querySelector(SEQUENCE_ROW)).not.toBeNull()
    // The flowchart's row is not shown anywhere meanwhile.
    expect(container.querySelector('.rmk-diagram-canvas:not(.rmk-sequence-canvas) .rmk-diagram-toolbar')).toBeNull()

    view.rerender(<Composed value={FLOWCHART} />)
    expect(host(container).querySelector(SEQUENCE_ROW)).toBeNull()
    expect(host(container).querySelector(FLOWCHART_ROW)).not.toBeNull()
  })

  it('puts the row back inline when the slot unmounts', () => {
    function Toggle(): ReactElement {
      const [slot, setSlot] = useState(true)
      return (
        <>
          <button type="button" data-toggle onClick={() => setSlot((on) => !on)}>
            toggle
          </button>
          <Composed value={FLOWCHART} slot={slot} />
        </>
      )
    }
    const container = open(<Toggle />)
    expect(host(container).querySelector('.rmk-diagram-toolbar')).not.toBeNull()
    click(container.querySelector('[data-toggle]'))
    expect(container.querySelector('.rmk-diagram-toolbar-host')).toBeNull()
    const inline = canvas(container).querySelector('.rmk-diagram-toolbar')
    expect(inline).not.toBeNull()
    expect(inline?.classList.contains('is-detached')).toBe(false)
    click(container.querySelector('[data-toggle]'))
    expect(host(container).querySelector('.rmk-diagram-toolbar')).not.toBeNull()
    expect(canvas(container).querySelector('.rmk-diagram-toolbar')).toBeNull()
  })
})
