/** The presenter's clocks: time since the talk started (resettable with `t`) and the time of day. */
import { useEffect, useState, type ReactElement } from 'react'
import type { SlidesLabels } from '../labels.js'

export interface PresenterTimerProps {
  /** When the deck entered present mode, or the timer was last reset */
  readonly startedAt: number
  readonly labels: SlidesLabels
  readonly onReset: () => void
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

export function PresenterTimer({ startedAt, labels, onReset }: PresenterTimerProps): ReactElement {
  const now = useNow()
  return (
    <div data-rmk-deck-timers="">
      <span data-rmk-deck-elapsed="" role="timer" aria-label={labels.elapsed}>
        {formatElapsed(now - startedAt)}
      </span>
      <button type="button" data-rmk-deck-action="reset-timer" aria-label={labels.resetTimer} title={labels.resetTimer} onClick={onReset}>
        {labels.resetTimer}
      </button>
      <time data-rmk-deck-clock="" dateTime={new Date(now).toISOString()}>
        {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </time>
    </div>
  )
}
