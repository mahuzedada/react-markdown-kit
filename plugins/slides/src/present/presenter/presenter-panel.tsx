/**
 * The presenter's column: where the talk is (step counter and timers),
 * the next step, and the current slide's notes. The preview is a copy of
 * a section with its `id` dropped (an id must stay unique on the page) and
 * marked `data-rmk-slide-preview` so the stylesheet keeps it visible
 * among the hidden non-current sections.
 */
import type { ReactElement } from 'react'
import type { SlidesLabels } from '../labels.js'
import type { SectionElement } from '../sections.js'
import { nextStep } from './next-step.js'
import { PresenterNotes } from './presenter-notes.js'
import { PresenterTimer } from './presenter-timer.js'

export interface PresenterPanelProps {
  readonly sections: readonly SectionElement[]
  readonly index: number
  readonly fragment: number
  readonly labels: SlidesLabels
  readonly startedAt: number
  readonly notesScale: number
  readonly onResetTimer: () => void
  readonly onScaleNotes: (step: 1 | -1) => void
}

export function PresenterPanel(props: PresenterPanelProps): ReactElement {
  const { sections, index, fragment, labels } = props
  const preview = nextStep(sections, index, fragment)
  return (
    <div data-rmk-deck-presenter="">
      <PresenterTimer startedAt={props.startedAt} labels={labels} onReset={props.onResetTimer} />
      <figure data-rmk-deck-preview="" aria-label={labels.preview}>
        <figcaption>{labels.preview}</figcaption>
        {preview ?? <p data-rmk-deck-preview-end="">{labels.endOfDeck}</p>}
      </figure>
      <PresenterNotes current={sections[index]} scale={props.notesScale} labels={labels} onScale={props.onScaleNotes} />
    </div>
  )
}
