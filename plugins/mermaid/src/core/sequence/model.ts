/**
 * The `sequenceDiagram` model (docs/MERMAID_PLATFORM.md section 8.1).
 *
 * A plain JSON object the parser produces and the layout reads: no class
 * instances, no cycles, nothing derived. Items keep their nesting so frames
 * render as frames; activations point into the depth-first flattening of
 * `items` because that is the order rows take on the page, whatever the
 * nesting. Text is already decoded (`<br/>` is a newline, `#59;` is `;`).
 */

export interface Participant {
  id: string
  label: string
  kind: 'participant' | 'actor'
}

export interface Box {
  /** The rest of the `box` line, colour included, as Mermaid keeps it. */
  label?: string
  participantIds: string[]
}

export interface Message {
  type: 'message'
  from: string
  to: string
  line: 'solid' | 'dotted'
  head: 'none' | 'arrow' | 'open' | 'cross'
  bidirectional: boolean
  text: string
  /** `+` activates `to` at this message, `-` deactivates `from`. */
  activate?: '+' | '-'
}

export interface Note {
  type: 'note'
  placement: 'left' | 'right' | 'over'
  participantIds: string[]
  text: string
}

export interface Frame {
  type: 'frame'
  kind: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'rect'
  /** One section per opener or divider (`alt`/`else`, `par`/`and`, `critical`/`option`); `rect`'s label is its colour. */
  sections: { label: string; items: SequenceItem[] }[]
}

export type SequenceItem = Message | Note | Frame

export interface Activation {
  participantId: string
  /** Index into the depth-first flattening of `items` where the bar starts. */
  start: number
  /** Index of the last item the bar covers. */
  end: number
}

export interface SequenceModel {
  title?: string
  participants: Participant[]
  boxes: Box[]
  items: SequenceItem[]
  /** Indices into the depth-first flattening of `items`. */
  activations: Activation[]
  numbering?: { start: number; step: number }
}

/** Every item in the order rows take on the page: a frame, then its sections' items. */
export function flattenItems(items: readonly SequenceItem[]): SequenceItem[] {
  const out: SequenceItem[] = []
  const walk = (list: readonly SequenceItem[]): void => {
    for (const item of list) {
      out.push(item)
      if (item.type === 'frame') for (const section of item.sections) walk(section.items)
    }
  }
  walk(items)
  return out
}
