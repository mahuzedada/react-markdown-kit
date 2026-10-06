import { afterAll, beforeAll, afterEach, describe, expect, it } from 'vitest'
import { act, useState, type ReactNode } from 'react'
import { $getSelection, $isRangeSelection, INSERT_PARAGRAPH_COMMAND, type LexicalEditor } from 'lexical'
import { useCanvas } from '../src/canvas/context.js'
import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { click, mount, type Mounted } from '../../../packages/editor/tests/helpers/mount.js'
import { SlideCanvas } from '../src/canvas/slide-canvas.js'
import { slides } from '../src/editor.js'

const rangeRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')
beforeAll(() => { Range.prototype.getBoundingClientRect = () => new DOMRect() })
afterAll(() => {
  if (rangeRect === undefined) delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect
  else Object.defineProperty(Range.prototype, 'getBoundingClientRect', rangeRect)
})

const preset = defineMarkdownPreset({ extensions: [gfm(), slides()] })
const SOURCE = '---\ntitle: Review\n---\n\n<!-- layout: cover -->\n\n# One\n\n???\n\nKeep my notes.\n\n---\n\n# Two\n'
let view: Mounted | undefined
let source: string
function Canvas({ initial = SOURCE, children }: { initial?: string; children?: ReactNode }) {
  const [value, setValue] = useState(initial)
  source = value
  return <SlideCanvas value={value} onChange={setValue} preset={preset}>{children}</SlideCanvas>
}
function button(name: string) {
  return view!.container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!
}
afterEach(() => view?.unmount())

describe('slide workspace', () => {
  it('undoes and redoes structural edits without losing metadata or notes', () => {
    view = mount(<Canvas />)
    click(button('Delete slide'))
    expect(source).not.toContain('# One')
    click(button('Undo'))
    expect(source).toBe(SOURCE)
    click(button('Redo'))
    expect(source).not.toContain('# One')
    click(button('Undo'))
    click(button('Add slide'))
    expect(source).toContain('## New slide')
    expect(button('Redo').disabled).toBe(true)
  })

  it('writes layout to Markdown and reverses it through the same history', () => {
    view = mount(<Canvas />)
    click(button('Properties'))
    const select = view.container.querySelector<HTMLSelectElement>('select[aria-label="Layout"]')!
    act(() => {
      select.value = 'section'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(source).toBe(SOURCE.replace('layout: cover', 'layout: section'))
    expect(view.container.querySelector('[data-rmk-canvas-frame] [data-rmk-slide]')?.getAttribute('data-rmk-slide-layout')).toBe('section')
    click(button('Undo'))
    expect(source).toBe(SOURCE)
  })

  it('keeps host source edits in undo history', () => {
    const changes: string[] = []
    view = mount(<SlideCanvas value={SOURCE} onChange={(next) => changes.push(next)} preset={preset} />)
    const external = SOURCE.replace('# One', '# Changed in source')
    view.rerender(<SlideCanvas value={external} onChange={(next) => changes.push(next)} preset={preset} />)
    click(button('Undo'))
    expect(changes.at(-1)).toBe(SOURCE)
  })

  it('keeps read-only slides navigable without exposing edit controls', () => {
    view = mount(<SlideCanvas value={SOURCE} preset={preset} />)
    expect(button('Delete slide')).toBeNull()
    expect(button('Undo')).toBeNull()
    expect(button('Previous slide').disabled).toBe(true)
    click(button('Next slide'))
    expect(view.container.querySelector('[data-rmk-canvas-counter]')?.textContent).toBe('2 / 2')
    expect(button('Next slide').disabled).toBe(true)
  })

  it('selects a block without editing, then edits only that block in its column', async () => {
    const initial = '<!-- layout: two-cols -->\n\n# Left\n\nKeep this.\n\n::right::\n\n# Right\n\nEdit here.\n\n???\n\nNotes.\n'
    view = mount(<Canvas initial={initial} />)
    const paragraph = view.container.querySelector('[data-rmk-canvas-frame] [data-rmk-slide-column="2"] p')!
    click(paragraph)
    expect(view.container.querySelector('[contenteditable="true"]')).toBeNull()
    expect(paragraph.hasAttribute('data-rmk-canvas-selected')).toBe(true)
    expect(source).toBe(initial)
    act(() => { paragraph.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
    const editor = view.container.querySelector('[contenteditable="true"]')!
    expect(editor.textContent).toBe('Edit here.')
    expect(source).toBe(initial)
    click(button('Heading'))
    expect(source).toBe(initial.replace('Edit here.', '## Edit here.'))
  })

  it('reports selected Markdown ranges and exposes contextual properties', () => {
    const spans: Array<{ start: number; end: number } | undefined> = []
    view = mount(<SlideCanvas value={SOURCE} onChange={() => {}} onBlockSelect={(span) => spans.push(span)} preset={preset} />)
    click(view.container.querySelector('[data-rmk-canvas-frame] h1'))
    const span = spans.at(-1)!
    expect(SOURCE.slice(span.start, span.end)).toBe('# One')
    click(button('Properties'))
    const field = view.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Block Markdown"]')!
    expect(field.value).toBe('# One')
    expect(view.container.querySelector('select[aria-label="Layout"]')).toBeNull()
    click(button('Slide properties'))
    expect(view.container.querySelector('select[aria-label="Layout"]')).not.toBeNull()
  })

  it('changes only the selected source range and can undo it', () => {
    view = mount(<Canvas />)
    click(view.container.querySelector('[data-rmk-canvas-frame] h1'))
    click(button('Properties'))
    const field = view.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Block Markdown"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, '# Revised')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(source).toBe(SOURCE.replace('# One', '# Revised'))
    click(button('Undo'))
    expect(source).toBe(SOURCE)
  })

  it('invalidates a selected block when the host replaces the source', () => {
    view = mount(<SlideCanvas value={SOURCE} onChange={() => {}} preset={preset} />)
    click(view.container.querySelector('[data-rmk-canvas-frame] h1'))
    expect(view.container.querySelector('[data-rmk-canvas-selected]')).not.toBeNull()
    view.rerender(<SlideCanvas value="# Replacement" onChange={() => {}} preset={preset} />)
    expect(view.container.querySelector('[data-rmk-canvas-selected]')).toBeNull()
    expect(view.container.querySelector('[data-rmk-canvas-frame] h1')?.textContent).toBe('Replacement')
  })

  it('moves selected blocks with controls and keyboard, preserving selection and undo', () => {
    const initial = '# One\n\nFirst.\n\n## Two\n\nLast.\n\n???\n\nNotes.\n'
    view = mount(<Canvas initial={initial} />)
    click(view.container.querySelector('[data-rmk-canvas-frame] h2'))
    click(button('Move block earlier'))
    expect(source).toBe(initial.replace('First.\n\n## Two', '## Two\n\nFirst.'))
    const selected = view.container.querySelector('[data-rmk-canvas-selected]')!
    expect(selected.textContent).toBe('Two')
    act(() => { selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true })) })
    expect(source).toBe(initial)
    click(button('Undo'))
    expect(source).not.toBe(initial)
    click(button('Undo'))
    expect(source).toBe(initial)
  })

  it('focuses the canvas without changing Markdown and restores the filmstrip', () => {
    view = mount(<Canvas />)
    click(button('Focus canvas'))
    expect(view.container.querySelector('[data-rmk-canvas-slides]')).toBeNull()
    expect(source).toBe(SOURCE)
    click(button('Exit focus'))
    expect(view.container.querySelector('[data-rmk-canvas-slides]')).not.toBeNull()
  })

  it('finishes inline editing through an explicit Done action', async () => {
    view = mount(<Canvas />)
    click(view.container.querySelector('[data-rmk-canvas-frame] h1'))
    click(button('Edit block'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
    expect(view.container.querySelector('[contenteditable="true"]')).not.toBeNull()
    click(view.container.querySelector('[data-rmk-canvas-done]'))
    expect(view.container.querySelector('[contenteditable="true"]')).toBeNull()
    expect(view.container.querySelector('[data-rmk-canvas-selected]')?.textContent).toBe('One')
    expect(source).toBe(SOURCE)
  })

  it('starts editing inserted text and undoes insertion as a structural change', async () => {
    view = mount(<Canvas />)
    click(button('Text'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
    expect(view.container.querySelector('[contenteditable="true"]')?.textContent).toBe('New text')
    expect(source).toContain('# One\n\nNew text')
    expect(source).toContain('Keep my notes.')
    click(view.container.querySelector('[data-rmk-canvas-done]'))
    click(button('Undo'))
    expect(source).toBe(SOURCE)
  })

  it('drops a selected block across columns without moving its neighbors', () => {
    const initial = '<!-- layout: two-cols -->\n\n# Left\n\nLeft text.\n\n::right::\n\n## Right\n\nRight text.\n'
    view = mount(<Canvas initial={initial} />)
    const origin = view.container.querySelector('[data-rmk-canvas-frame] h1')!
    const target = view.container.querySelector('[data-rmk-canvas-frame] h2')!
    click(origin)
    const transfer = { setData: () => {}, effectAllowed: '', dropEffect: '' }
    act(() => {
      for (const [element, type] of [[origin, 'dragstart'], [target, 'dragover'], [target, 'drop']] as const) {
        const event = new Event(type, { bubbles: true, cancelable: true })
        Object.defineProperty(event, 'dataTransfer', { value: transfer })
        element.dispatchEvent(event)
      }
    })
    expect(source).toBe(initial.replace('# Left\n\n', '').replace('## Right', '## Right\n\n# Left'))
    const left = view.container.querySelector('[data-rmk-canvas-frame] [data-rmk-slide-column="1"]')!
    const right = view.container.querySelector('[data-rmk-canvas-frame] [data-rmk-slide-column="2"]')!
    expect(left.textContent).toBe('Left text.')
    expect(right.textContent).toContain('Right text.')
    expect(right.querySelector('h1')?.textContent).toBe('Left')
  })

  it('uses the editor table picker and writes the chosen dimensions to Markdown', async () => {
    view = mount(<Canvas />)
    expect(view.container.querySelector('[data-rmk-canvas-selection-bar]')).toBeNull()
    click(button('Insert table'))
    expect(view.container.querySelector('.rmk-table-size-grid')).not.toBeNull()
    click(button('3 rows, 4 columns'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)) })
    const table = view.container.querySelector('[contenteditable="true"] table')!
    expect(table.querySelectorAll('tr')).toHaveLength(3)
    expect(table.querySelectorAll('th')).toHaveLength(4)
    expect(source).toContain('|')
    expect(source).toContain('Keep my notes.')
    expect(source).toContain('<!-- layout: cover -->')
    expect(source).toContain('# Two')
    click(view.container.querySelector('[data-rmk-canvas-done]'))
    click(button('Undo'))
    expect(source).toBe(SOURCE)
  })

  it('keeps Enter and repeated line breaks inside one persistent text box', async () => {
    let native: LexicalEditor | undefined
    function Capture() {
      native = useCanvas().editor?.getNativeEditor() as LexicalEditor | undefined
      return null
    }
    const initial = '<!-- layout: two-cols -->\n\nFirst line\n\n::right::\n\nUntouched.\n\n???\n\nNotes.\n'
    view = mount(<Canvas initial={initial}><Capture /></Canvas>)
    click(view.container.querySelector('[data-rmk-canvas-frame] p'))
    click(button('Edit block'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
    act(() => {
      native!.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)
      native!.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)
      native!.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) selection.insertText('Second line')
      }, { discrete: true })
    })
    expect(view.container.querySelectorAll('[contenteditable="true"] > p')).toHaveLength(1)
    expect(view.container.querySelectorAll('[contenteditable="true"] br')).toHaveLength(2)
    expect(source).toContain('Untouched.\n\n???\n\nNotes.')
    click(view.container.querySelector('[data-rmk-canvas-done]'))
    const column = view.container.querySelector('[data-rmk-canvas-frame] [data-rmk-slide-column="1"]')!
    expect(column.querySelectorAll('[data-rmk-canvas-block]')).toHaveLength(1)
    expect(column.querySelectorAll('br')).toHaveLength(2)
    click(column.querySelector('p'))
    click(button('Edit block'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
    expect(view.container.querySelectorAll('[contenteditable="true"] > p')).toHaveLength(1)
    expect(view.container.querySelectorAll('[contenteditable="true"] br')).toHaveLength(2)
    expect(view.container.querySelector('[contenteditable="true"]')?.textContent).toContain('Second line')
  })

  it.each([1, 2])('does not render backslashes after %i trailing empty lines', async (lines) => {
    let native: LexicalEditor | undefined
    function Capture() {
      native = useCanvas().editor?.getNativeEditor() as LexicalEditor | undefined
      return null
    }
    const initial = 'First line\n\nSibling.\n'
    view = mount(<Canvas initial={initial}><Capture /></Canvas>)
    click(view.container.querySelector('[data-rmk-canvas-frame] p'))
    click(button('Edit block'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
    act(() => {
      for (let i = 0; i < lines; i++) native!.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)
    })
    click(view.container.querySelector('[data-rmk-canvas-done]'))
    expect(source).toBe(initial)
    const paragraph = view.container.querySelector('[data-rmk-canvas-frame] p')!
    expect(paragraph.textContent).toBe('First line')
    click(paragraph)
    click(button('Edit block'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
    expect(view.container.querySelector('[contenteditable="true"]')?.textContent).toBe('First line')
  })

  it('renders canvas source mappings for selectable blocks', () => {
    view = mount(<Canvas />)
    expect(view.container.querySelectorAll('[data-rmk-canvas-block]').length).toBeGreaterThan(0)
  })

  it('adds the first slide to an empty deck', () => {
    view = mount(<Canvas initial="" />)
    click(button('Add slide'))
    expect(source).toContain('## New slide')
    expect(view.container.querySelector('[data-rmk-canvas-counter]')?.textContent).toBe('1 / 1')
  })
})
