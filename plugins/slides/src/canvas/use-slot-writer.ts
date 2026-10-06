/**
 * Writes one slot of one slide (its body or its notes) as the author types.
 *
 * The first write reads the slot from the latest outline; later writes
 * reuse the span the previous write produced, because the host may not
 * have re-rendered with the new source yet when the next keystroke lands.
 * A source the session did not emit (an edit made somewhere else) starts a
 * new session from the outline.
 */
import { useCallback, useRef } from 'react'
import { useCanvas } from './context.js'
import { writeSlot } from './edits.js'
import type { SlideOutline, SlideSlot } from './outline.js'

type SlotName = keyof Pick<SlideOutline, 'body' | 'notes'>

interface Session {
  readonly value: string
  readonly slot: SlideSlot
  /** The last few sources this session emitted; the host may still be rendering any of them. */
  readonly emitted: readonly string[]
}

const REMEMBERED = 8

export function useSlotWriter(index: number, name: SlotName, column?: 0 | 1, block?: number): (text: string) => void {
  const { source } = useCanvas()
  const session = useRef<Session | undefined>(undefined)

  return useCallback(
    (text: string) => {
      const latest = source.value()
      const current = session.current
      const resumed = current !== undefined && current.emitted.includes(latest)
      const slide = source.outline().slides[index]
      const blockSpan = block === undefined ? undefined : slide?.blocks[block]?.span
      const slot = resumed ? current.slot : block !== undefined
        ? blockSpan === undefined ? undefined : { span: blockSpan, insertAt: blockSpan.start, prefix: '' }
        : column === undefined ? slide?.[name] : slide?.columns?.[column]
      if (slot === undefined) return
      const base = resumed ? current.value : latest
      const written = writeSlot(base, slot, text)
      if (written.value === base) return
      session.current = { value: written.value, slot: written.slot, emitted: [...(resumed ? current.emitted : [base]), written.value].slice(-REMEMBERED) }
      source.emit(written.value, `${index}:${name}:${column ?? 'all'}:${block ?? 'all'}`)
    },
    [source, index, name, column, block],
  )
}
