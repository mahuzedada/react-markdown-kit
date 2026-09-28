/**
 * What the presenter sees as "next": the current slide with one more step
 * revealed while it has steps left, else the next slide as it opens, else
 * nothing (the end of the deck).
 */
import { sectionAtStep } from '../present-section.js'
import { fragmentCount, type SectionElement } from '../sections.js'

const PREVIEW = 'data-rmk-slide-preview'

export function nextStep(sections: readonly SectionElement[], index: number, fragment: number): SectionElement | undefined {
  const current = sections[index]
  if (current !== undefined && fragment < fragmentCount(current)) return sectionAtStep(current, fragment + 1, PREVIEW)
  const next = sections[index + 1]
  return next === undefined ? undefined : sectionAtStep(next, 0, PREVIEW)
}
