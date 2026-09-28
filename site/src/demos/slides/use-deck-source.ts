/**
 * The deck source and everything that follows it: this browser's storage
 * (the reader's own edits only, so opening someone's link never replaces
 * the deck this browser was keeping), the `?d=` link after a pause, and
 * Reset with an Undo that stays on offer for a few seconds. `status` is the
 * short confirmation the header shows, cleared on its own.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { InitialSource } from './initial-source'
import { SAMPLE_DECK } from './sample-deck'
import { clearStoredSource, encodeSource, readStoredSource, storeSource, writeSourceParam } from './url-state'

const URL_DEBOUNCE_MS = 400
const STATUS_MS = 3500
/** Long enough to reach Undo after a reset. */
const UNDO_MS = 8000

export interface DeckSource {
  readonly source: string
  readonly edit: (next: string) => void
  readonly notice: string | undefined
  readonly restoredNotice: boolean
  readonly status: string
  readonly setStatus: (status: string) => void
  readonly canUndo: boolean
  readonly reset: () => void
  readonly undoReset: () => void
  /** The `?d=` value of the source on screen. */
  readonly encodedNow: () => Promise<string>
}

export function useDeckSource(initial: InitialSource): DeckSource {
  const [source, setSource] = useState(initial.source)
  const [notice, setNotice] = useState(initial.notice)
  const [restoredNotice, setRestoredNotice] = useState(initial.fromStorage && initial.notice === undefined)
  const [status, setStatus] = useState('')
  // The deck a reset replaced, while Undo is on offer, and whether the reset cleared it from storage.
  const [undo, setUndo] = useState<{ readonly source: string; readonly cleared: boolean } | undefined>(undefined)
  const [encoded, setEncoded] = useState<string | undefined>(undefined)

  const current = useRef(source)
  current.current = source
  const edit = useCallback((next: string): void => {
    if (next === current.current) return
    setSource(next)
    storeSource(next)
    setRestoredNotice(false)
  }, [])

  // The address bar follows after a pause (encoding is async). The sample keeps the plain URL.
  useEffect(() => {
    setEncoded(undefined)
    let cancelled = false
    const timer = setTimeout(() => {
      void encodeSource(source).then((value) => {
        if (cancelled) return
        setEncoded(value)
        writeSourceParam(source === SAMPLE_DECK ? undefined : value)
      })
    }, URL_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [source])

  useEffect(() => {
    if (status === '') return
    const timer = setTimeout(
      () => {
        setStatus('')
        setUndo(undefined)
      },
      undo === undefined ? STATUS_MS : UNDO_MS,
    )
    return () => clearTimeout(timer)
  }, [status, undo])

  const reset = useCallback((): void => {
    // Storage is cleared only when it holds the deck on screen: resetting a
    // deck opened from someone's link leaves this browser's own deck alone.
    const cleared = readStoredSource() === source
    if (cleared) clearStoredSource()
    setUndo(source === SAMPLE_DECK ? undefined : { source, cleared })
    setSource(SAMPLE_DECK)
    setNotice(undefined)
    setRestoredNotice(false)
    setStatus('Sample deck restored.')
  }, [source])

  const undoReset = useCallback((): void => {
    if (undo === undefined) return
    setSource(undo.source)
    if (undo.cleared) storeSource(undo.source)
    setUndo(undefined)
    setStatus('Your deck is back.')
  }, [undo])

  const encodedNow = useCallback(async (): Promise<string> => encoded ?? encodeSource(source), [encoded, source])

  return { source, edit, notice, restoredNotice, status, setStatus, canUndo: undo !== undefined, reset, undoReset, encodedNow }
}
