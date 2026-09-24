/**
 * `createMermaidCanvas(container, options)`: the standalone canvas for a
 * page that is not written in React. It renders `<MermaidCanvas>` into the
 * given element (React and ReactDOM are still the peers that draw it) and
 * hands back a small imperative handle.
 */
import { createRoot } from 'react-dom/client'
import { MermaidCanvas, type MermaidCanvasProps } from './mermaid-canvas.js'

export type MermaidCanvasOptions = Omit<MermaidCanvasProps, 'value' | 'children'> & {
  /** The initial source. Default: an empty flowchart. */
  readonly value?: string
}

export interface MermaidCanvasHandle {
  /** The current source, a flowchart's with its layout line. */
  getValue(): string
  /** Replaces the source; one undo step. Does not call `onChange`. */
  setValue(source: string): void
  /** Changes options (zoom, toolbar, style…) without losing the source or its history. */
  update(options: Partial<MermaidCanvasOptions>): void
  /** Unmounts the canvas and leaves the container empty. */
  destroy(): void
}

export function createMermaidCanvas(container: HTMLElement, options: MermaidCanvasOptions = {}): MermaidCanvasHandle {
  const root = createRoot(container)
  let current = options
  let value = options.value ?? options.defaultValue ?? 'flowchart TD'
  const render = (): void => {
    const onChange = (next: string): void => {
      value = next
      current.onChange?.(next)
    }
    root.render(<MermaidCanvas {...current} value={value} onChange={onChange} />)
  }
  render()
  return {
    getValue: () => value,
    setValue(source) {
      value = source
      render()
    },
    update(next) {
      current = { ...current, ...next }
      render()
    },
    destroy() {
      root.unmount()
    },
  }
}
