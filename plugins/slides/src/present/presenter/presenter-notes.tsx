/**
 * The current slide's notes, with their `hidden` lifted, at a size the
 * presenter picks (`+` / `-`, or the two buttons). A slide without notes
 * says so, so an empty column never reads as a broken one.
 */
import { cloneElement, type ReactElement } from 'react'
import type { SlidesLabels } from '../labels.js'
import { findNotes, type SectionElement } from '../sections.js'

export interface PresenterNotesProps {
  readonly current: SectionElement | undefined
  /** Multiplies the notes' font size */
  readonly scale: number
  readonly labels: SlidesLabels
  readonly onScale: (step: 1 | -1) => void
}

export function PresenterNotes({ current, scale, labels, onScale }: PresenterNotesProps): ReactElement {
  const notes = current === undefined ? undefined : findNotes(current)
  return (
    <div data-rmk-deck-notes="" role="region" aria-label={labels.notes} style={{ '--rmk-deck-notes-scale': String(scale) } as Record<string, string>}>
      <div data-rmk-deck-notes-size="">
        <button type="button" data-rmk-deck-action="notes-smaller" aria-label={labels.notesSmaller} title={labels.notesSmaller} onClick={() => onScale(-1)}>
          A−
        </button>
        <button type="button" data-rmk-deck-action="notes-larger" aria-label={labels.notesLarger} title={labels.notesLarger} onClick={() => onScale(1)}>
          A+
        </button>
      </div>
      {notes === undefined ? <p data-rmk-deck-notes-empty="">{labels.noNotes}</p> : cloneElement(notes, { hidden: false })}
    </div>
  )
}
