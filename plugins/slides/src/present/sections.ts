/**
 * Reading and re-dressing the section elements the renderer hands the deck
 * as `children`. The static DOM is the contract (data-rmk-slide, -fragments,
 * -name, -body, -fragment on plain elements), so the deck learns everything
 * from props and adds its own attributes with `cloneElement`; the elements'
 * keys and types are untouched, so React keeps the same DOM nodes when the
 * mode changes.
 */
import { cloneElement, isValidElement, version, type ReactElement, type ReactNode } from 'react'

export type SectionElement = ReactElement<Record<string, unknown>>

export type SlideState = 'past' | 'current' | 'future'

/**
 * The value that writes `inert=""` on the React the page runs. React 19
 * knows `inert` as a boolean attribute (`true` writes it, `''` removes it);
 * React 18 does not know it, writes a string as given and drops `true`
 * with a warning.
 */
export function inertValue(reactVersion: string): true | '' {
  return Number(reactVersion.split('.')[0]) >= 19 ? true : ''
}

export const INERT = inertValue(version)

function isElementWith(node: ReactNode, attribute: string): node is SectionElement {
  return isValidElement(node) && (node.props as Record<string, unknown>)[attribute] !== undefined
}

/** Applies `fn` to each child, keeping a single child single so the element tree keeps its shape. */
function mapChildren(children: ReactNode, fn: (child: ReactNode) => ReactNode): ReactNode {
  return Array.isArray(children) ? children.map(fn) : fn(children)
}

export function collectSections(children: ReactNode): SectionElement[] {
  const nodes = Array.isArray(children) ? children : [children]
  return nodes.filter((node): node is SectionElement => isElementWith(node, 'data-rmk-slide'))
}

export function fragmentCount(section: SectionElement): number {
  const value = section.props['data-rmk-slide-fragments']
  return typeof value === 'string' ? Number(value) || 0 : 0
}

export function slideName(section: SectionElement): string | undefined {
  const value = section.props['data-rmk-slide-name']
  return typeof value === 'string' ? value : undefined
}

export function findNotes(section: SectionElement): SectionElement | undefined {
  const nodes = Array.isArray(section.props.children) ? section.props.children : [section.props.children]
  return nodes.find((node): node is SectionElement => isElementWith(node, 'data-rmk-slide-notes'))
}

/** Marks the fragment divs directly inside the body as shown or hidden. */
function revealFragments(sectionChildren: ReactNode, shown: number): ReactNode {
  return mapChildren(sectionChildren, (child) => {
    if (!isElementWith(child, 'data-rmk-slide-body')) return child
    const body = mapChildren(child.props.children as ReactNode, (block) => {
      if (!isElementWith(block, 'data-rmk-fragment')) return block
      const number = Number(block.props['data-rmk-fragment'])
      return cloneElement(block, { 'data-rmk-fragment-state': number <= shown ? 'shown' : 'hidden' })
    })
    return cloneElement(child, {}, body)
  })
}

/** The section as it appears while presenting: state attribute, `inert` off-stage, fragments revealed up to `fragment`. */
export function presentSection(section: SectionElement, state: SlideState, fragment: number): SectionElement {
  if (state !== 'current') return cloneElement(section, { 'data-rmk-slide-state': state, inert: INERT })
  return cloneElement(section, { 'data-rmk-slide-state': state }, revealFragments(section.props.children as ReactNode, fragment))
}
