/**
 * The standalone canvas (`/canvas`): it mounts without a Markdown editor,
 * floats the flowchart's tools in its island without the block-width
 * presets, writes Mermaid back through `onChange`, keeps its own undo, and
 * a multi-selection moves (arrow keys) and scales (frame handles) together.
 * `createMermaidCanvas` renders the same component into a given element.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, run, runAsync } from '../../../packages/editor/tests/helpers/mount.js'
import { MermaidCanvas, createMermaidCanvas } from '../src/canvas.js'
import { readLayoutAnnotation, type LayoutAnnotation } from '../src/index.js'

const SOURCE = [
  'flowchart LR',
  '    a[A] --> b[B]',
  '%% rmk-layout v1 {"canvasHeight":300,"nodes":{"a":{"x":40,"y":40,"width":100,"height":60},"b":{"x":240,"y":40,"width":100,"height":60}}}',
].join('\n')

function layoutOf(source: string | undefined): LayoutAnnotation {
  const line = (source ?? '').split('\n').map((candidate) => candidate.trim()).find((candidate) => candidate.startsWith('%% rmk-layout'))
  const read = readLayoutAnnotation(line ?? '')
  if (read.kind !== 'annotation') throw new Error(`No layout in ${source}`)
  return read.annotation
}

function key(target: Element, init: KeyboardEventInit): void {
  run(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
  })
}

function pointer(target: Element, type: string, init: MouseEventInit = {}): void {
  run(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

if (!('setPointerCapture' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {}, configurable: true, writable: true })
}

describe('<MermaidCanvas>', () => {
  it('draws a flowchart and floats its tools in the island, without block widths', () => {
    const view = mount(<MermaidCanvas defaultValue={SOURCE} />)
    const root = view.container.querySelector('.rmk-mermaid-canvas')
    expect(root?.getAttribute('data-rmk-mermaid-toolbar')).toBe('left')
    expect(root?.querySelectorAll('.rmk-diagram-surface [data-shape-id]').length).toBeGreaterThanOrEqual(3)
    const island = root?.querySelector('.rmk-mermaid-canvas-tools')
    expect(island?.querySelector('.rmk-diagram-toolbar [role="toolbar"]')?.getAttribute('aria-orientation')).toBe('vertical')
    expect(island?.querySelector('[aria-label="Select"]')).not.toBeNull()
    // No block-width presets: the canvas is the page
    expect(island?.querySelectorAll('.rmk-diagram-toolbar-group-end .rmk-diagram-tool')).toHaveLength(1)
    view.unmount()
  })

  it('moves a whole selection with the arrow keys, then undoes it', () => {
    const onChange = vi.fn<(source: string) => void>()
    const view = mount(<MermaidCanvas defaultValue={SOURCE} onChange={onChange} />)
    const canvas = view.container.querySelector('.rmk-diagram-canvas')!
    key(canvas, { key: 'a', ctrlKey: true })
    key(canvas, { key: 'ArrowRight', shiftKey: true })
    const moved = layoutOf(onChange.mock.lastCall?.[0])
    expect(moved.nodes?.['a']?.x).toBe(50)
    expect(moved.nodes?.['b']?.x).toBe(250)

    key(canvas, { key: 'z', ctrlKey: true })
    expect(layoutOf(onChange.mock.lastCall?.[0]).nodes?.['a']?.x).toBe(40)
    key(canvas, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(layoutOf(onChange.mock.lastCall?.[0]).nodes?.['a']?.x).toBe(50)
    view.unmount()
  })

  it('scales a multi-selection together from a corner of its frame', async () => {
    const onChange = vi.fn<(source: string) => void>()
    const view = mount(<MermaidCanvas defaultValue={SOURCE} onChange={onChange} />)
    const canvas = view.container.querySelector('.rmk-diagram-canvas')!
    const svg = view.container.querySelector('svg.rmk-diagram-surface')!
    key(canvas, { key: 'a', ctrlKey: true })
    const handles = view.container.querySelectorAll('.rmk-diagram-group-selection .rmk-diagram-handle')
    expect(handles.length).toBeGreaterThanOrEqual(4)
    // Handles run nw, ne, sw, se; the frame spans x 40…340, y 40…100
    const se = handles[3]!
    pointer(se, 'pointerdown', { clientX: 340, clientY: 100 })
    pointer(svg, 'pointermove', { clientX: 190, clientY: 70 })
    await runAsync(() => new Promise((resolve) => setTimeout(resolve, 40)))
    pointer(svg, 'pointerup', { clientX: 190, clientY: 70 })

    const scaled = layoutOf(onChange.mock.lastCall?.[0]).nodes
    expect(scaled?.['a']).toMatchObject({ x: 40, y: 40, width: 50, height: 30 })
    expect(scaled?.['b']).toMatchObject({ x: 140, y: 40, width: 50, height: 30 })
    view.unmount()
  })

  it('shows a kind without a canvas as its static picture', () => {
    const view = mount(<MermaidCanvas defaultValue={'pie\n  "a": 1'} />)
    expect(view.container.querySelector('.rmk-diagram-source-pre')?.textContent).toContain('pie')
    expect(view.container.querySelector('.rmk-mermaid-canvas-tools')).toBeNull()
    view.unmount()
  })
})

describe('createMermaidCanvas', () => {
  it('renders into the given container and hands back the source', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let handle: ReturnType<typeof createMermaidCanvas> | undefined
    run(() => {
      handle = createMermaidCanvas(container, { value: SOURCE, toolbar: 'top' })
    })
    expect(container.querySelector('.rmk-mermaid-canvas')?.getAttribute('data-rmk-mermaid-toolbar')).toBe('top')
    expect(handle?.getValue()).toBe(SOURCE)
    run(() => handle?.setValue('sequenceDiagram\n  A->>B: hi'))
    expect(container.querySelector('.rmk-sequence-canvas')).not.toBeNull()
    run(() => handle?.destroy())
    expect(container.innerHTML).toBe('')
  })
})
