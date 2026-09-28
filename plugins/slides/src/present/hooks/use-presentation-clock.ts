/** When the talk started: the moment the deck entered present mode, or the last `t`. */
import { useCallback, useEffect, useState } from 'react'

export function usePresentationClock(live: boolean): { readonly startedAt: number; readonly reset: () => void } {
  const [startedAt, setStartedAt] = useState(() => Date.now())
  useEffect(() => {
    if (live) setStartedAt(Date.now())
  }, [live])
  const reset = useCallback(() => setStartedAt(Date.now()), [])
  return { startedAt, reset }
}
