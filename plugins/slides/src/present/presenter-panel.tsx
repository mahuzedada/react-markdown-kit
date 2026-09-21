/**
 * The presenter's column: a preview of the next slide, the current slide's
 * notes with their `hidden` lifted, and a clock. The preview is the next
 * section cloned with its `id` dropped (an id must stay unique on the page)
 * and marked `data-rmk-slide-preview` so the stylesheet keeps it visible
 * among the hidden non-current sections.
 */
import { cloneElement, useEffect, useState, type ReactElement } from 'react'
import type { SlidesLabels } from './labels.js'
import type { SectionElement } from './sections.js'
import { INERT, findNotes } from './sections.js'

export interface PresenterPanelProps {
  readonly next: SectionElement | undefined
  readonly current: SectionElement | undefined
  readonly labels: SlidesLabels
}

function clock(now: Date): string {
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function PresenterPanel({ next, current, labels }: PresenterPanelProps): ReactElement {
  const now = useClock()
  const notes = current === undefined ? undefined : findNotes(current)
  return (
    <div data-rmk-deck-presenter="">
      <div data-rmk-deck-preview="" aria-label={labels.preview}>
        {next === undefined
          ? null
          : cloneElement(next, { id: undefined, 'data-rmk-slide-preview': '', 'aria-hidden': true, inert: INERT })}
      </div>
      <div data-rmk-deck-notes="" aria-label={labels.notes}>
        {notes === undefined ? null : cloneElement(notes, { hidden: false })}
      </div>
      <time data-rmk-deck-clock="" dateTime={now.toISOString()}>
        {clock(now)}
      </time>
    </div>
  )
}
