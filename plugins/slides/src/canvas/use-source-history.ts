/** Bounded history of Markdown snapshots. A typing burst is one undo step;
 * structural edits and edits from the host are separate steps. */
import { useCallback, useEffect, useRef, useState } from 'react'

const LIMIT = 100
const GROUP_MS = 750

export function useSourceHistory(value: string, onChange: ((value: string) => void) | undefined) {
  const history = useRef({ entries: [value], cursor: 0, group: undefined as string | undefined, time: 0 })
  const callback = useRef(onChange)
  callback.current = onChange
  const [, refresh] = useState(0)

  const record = useCallback((next: string, group?: string) => {
    const state = history.current
    if (state.entries[state.cursor] === next) return
    const now = Date.now()
    const merge = group !== undefined && group === state.group && now - state.time < GROUP_MS && state.cursor > 0 && state.cursor === state.entries.length - 1
    state.entries = state.entries.slice(0, state.cursor + 1)
    if (merge) state.entries[state.cursor] = next
    else {
      state.entries.push(next)
      if (state.entries.length > LIMIT) state.entries.shift()
      state.cursor = state.entries.length - 1
    }
    state.group = group
    state.time = now
    refresh((revision) => revision + 1)
  }, [])

  // Source edits made in a host pane join the same history as canvas edits.
  const editable = onChange !== undefined
  useEffect(() => {
    if (editable) record(value, 'source')
  }, [value, editable, record])

  const write = useCallback((next: string, group?: string) => {
    if (callback.current === undefined) return
    record(next, group)
    callback.current(next)
  }, [record])

  const travel = useCallback((direction: number) => {
    if (callback.current === undefined) return
    const state = history.current
    const cursor = state.cursor + direction
    const next = state.entries[cursor]
    if (next === undefined) return
    state.cursor = cursor
    state.group = undefined
    callback.current(next)
    refresh((revision) => revision + 1)
  }, [])

  return {
    write,
    undo: () => travel(-1),
    redo: () => travel(1),
    canUndo: onChange !== undefined && history.current.cursor > 0,
    canRedo: onChange !== undefined && history.current.cursor < history.current.entries.length - 1,
  }
}
