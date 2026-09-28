/** Every marker kind the dialect knows. A new marker is a new module listed here. */
import { columnMarker } from './column.js'
import type { MarkerKindSpec } from './marker-kind.js'
import { notesMarker } from './notes.js'
import { pauseMarker } from './pause.js'

export const MARKER_KINDS = [notesMarker, pauseMarker, columnMarker] as const

export type MarkerKind = (typeof MARKER_KINDS)[number]['kind']

const BY_KIND = new Map<string, MarkerKindSpec>(MARKER_KINDS.map((spec) => [spec.kind, spec]))
const BY_SPELLING = new Map<string, MarkerKind>(MARKER_KINDS.map((spec) => [spec.spelling, spec.kind]))

export function isMarkerKind(value: string): value is MarkerKind {
  return BY_KIND.has(value)
}

export function markerSpec(kind: MarkerKind): MarkerKindSpec {
  return BY_KIND.get(kind)!
}

/** The marker a paragraph's exact text spells, if any. */
export function markerOfSpelling(text: string): MarkerKind | undefined {
  return BY_SPELLING.get(text)
}
