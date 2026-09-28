/**
 * A section as it appears while presenting. The current slide carries its
 * state, its revealed steps and any layers (drawing, laser) appended after
 * its own children; the others are `inert` and hidden by the stylesheet,
 * except in the overview, where every slide stays visible and clickable.
 * The elements' keys and types are untouched, so React keeps the same DOM
 * nodes when the mode changes.
 */
import { cloneElement, type ReactNode } from 'react'
import { revealTree } from './reveal.js'
import { INERT, childList, fragmentCount, type SectionElement } from './sections.js'

export type SlideState = 'past' | 'current' | 'future'

export function slideStateOf(index: number, current: number): SlideState {
  return index < current ? 'past' : index === current ? 'current' : 'future'
}

export interface PresentSectionOptions {
  readonly state: SlideState
  readonly fragment: number
  /** Every slide is a tile of the overview: none is inert. */
  readonly overview: boolean
  readonly layers?: ReactNode
}

export function presentSection(section: SectionElement, options: PresentSectionOptions): SectionElement {
  const { state, fragment, overview, layers } = options
  if (state !== 'current') return cloneElement(section, { 'data-rmk-slide-state': state, ...(overview ? {} : { inert: INERT }) })
  // A slide without steps has nothing to reveal, so its tree (a whole diagram, say) is not walked.
  const own = childList(section.props.children)
  const children = fragmentCount(section) === 0 ? own : own.map((child) => revealTree(child, fragment))
  return cloneElement(section, { 'data-rmk-slide-state': state }, ...children, ...(layers === undefined ? [] : [layers]))
}

/** A copy of a section at one reveal step, for a preview or a printed page: no id, hidden from assistive tech, inert. */
export function sectionAtStep(section: SectionElement, fragment: number, marker: string): SectionElement {
  const children = childList(section.props.children).map((child) => revealTree(child, fragment))
  return cloneElement(section, { id: undefined, [marker]: '', 'aria-hidden': true, inert: INERT }, ...children)
}
