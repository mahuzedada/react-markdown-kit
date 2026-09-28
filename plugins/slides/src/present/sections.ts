/**
 * Reading the section elements the renderer hands the deck as `children`.
 * The static DOM is the contract (data-rmk-slide, -fragments, -name, -body,
 * -fragment on plain elements), so the deck learns everything from props.
 * `present-section.ts` re-dresses them for present mode.
 */
import { isValidElement, version, type ReactElement, type ReactNode } from 'react'

export type SectionElement = ReactElement<Record<string, unknown>>

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

export function isElementWith(node: ReactNode, attribute: string): node is SectionElement {
  return isValidElement(node) && (node.props as Record<string, unknown>)[attribute] !== undefined
}

export function childList(children: unknown): readonly ReactNode[] {
  return Array.isArray(children) ? (children as ReactNode[]) : [children as ReactNode]
}

export function collectSections(children: ReactNode): SectionElement[] {
  return childList(children).filter((node): node is SectionElement => isElementWith(node, 'data-rmk-slide'))
}

export function fragmentCount(section: SectionElement): number {
  const value = section.props['data-rmk-slide-fragments']
  return typeof value === 'string' ? Number(value) || 0 : 0
}

export function slideName(section: SectionElement): string | undefined {
  const value = section.props['data-rmk-slide-name']
  return typeof value === 'string' ? value : undefined
}

export function slideTitle(section: SectionElement): string | undefined {
  const value = section.props['data-rmk-slide-title']
  return typeof value === 'string' ? value : undefined
}

export function findNotes(section: SectionElement): SectionElement | undefined {
  return childList(section.props.children).find((node): node is SectionElement => isElementWith(node, 'data-rmk-slide-notes'))
}
