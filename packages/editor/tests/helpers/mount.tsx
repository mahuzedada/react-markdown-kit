/**
 * A ~30-line mount helper so the editor tests need no testing-library
 * dependency. React 19 exports `act`; `createRoot` does the rest.
 */
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

export interface Mounted {
  readonly container: HTMLElement
  rerender(element: ReactElement): void
  unmount(): void
}

export function mount(element: ReactElement): Mounted {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let root: Root | undefined
  act(() => {
    root = createRoot(container)
    root.render(element)
  })
  return {
    container,
    rerender(next: ReactElement) {
      act(() => {
        root?.render(next)
      })
    },
    unmount() {
      act(() => {
        root?.unmount()
      })
      container.remove()
    },
  }
}

/** Runs a callback inside `act`, flushing effects and Lexical updates. */
export function run(callback: () => void): void {
  act(() => {
    callback()
  })
}

/** The async form, for a command that awaits an application promise. */
export async function runAsync(callback: () => Promise<unknown>): Promise<void> {
  await act(async () => {
    await callback()
  })
}

export function click(element: Element | null): void {
  if (element === null) throw new Error('No element to click.')
  act(() => {
    ;(element as HTMLElement).click()
  })
}

export function button(container: HTMLElement, id: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`[data-rmk-toolbar-item="${id}"]`)
  if (found === null) throw new Error(`No toolbar button ${id}.`)
  return found
}
