/**
 * Static SVG for a sequence diagram, as hast (docs/MERMAID_PLATFORM.md
 * section 8.4). Geometry comes from `layoutSequence`; this file only draws
 * it. Colours are attributes written through the section 7 theme tokens as
 * `var(--rmk-diagram-<token>, #rrggbb)`, so a host restyles the diagram
 * with custom properties and an unstyled document looks like Mermaid. No
 * script, no foreignObject, no URLs: the output is safe to serialise into a
 * page as-is.
 */
import type { Element, ElementContent } from 'hast'
import { FONT_SIZE, LINE_HEIGHT, SMALL_FONT_SIZE } from '../core/drawing-data.js'
import type { SequenceModel } from '../core/sequence/model.js'
import {
  frameTabWidth,
  layoutSequence,
  SEQUENCE_METRICS,
  type LayoutActivation,
  type LayoutBox,
  type LayoutColumn,
  type LayoutFrame,
  type LayoutMessage,
  type LayoutNote,
} from '../core/sequence/layout.js'
import { h, n, text } from './hast.js'
import { token } from './theme.js'

export interface RenderSequenceOptions {
  readonly fallbackTitle: string
}

const LINE_H = FONT_SIZE * LINE_HEIGHT
const HEAD = 10
const DOTTED = '6 4'
const M = SEQUENCE_METRICS

export function renderSequenceSvg(model: SequenceModel, options: RenderSequenceOptions): Element {
  const layout = layoutSequence(model)
  const title = model.title ?? options.fallbackTitle
  const children: ElementContent[] = [h('title', {}, [text(title)])]
  for (const box of layout.boxes) children.push(boxElement(box))
  for (const column of layout.columns) children.push(lifeline(column, layout.lifelineTop, layout.lifelineBottom))
  for (const frame of layout.frames) children.push(frameElement(frame))
  for (const activation of layout.activations) children.push(activationElement(activation))
  for (const column of layout.columns) {
    children.push(participantElement(column, column.top))
    children.push(participantElement(column, column.bottom))
  }
  for (const note of layout.notes) children.push(noteElement(note))
  for (const message of layout.messages) children.push(messageElement(message))

  return h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${n(layout.width)} ${n(layout.height)}`,
      width: n(layout.width),
      height: n(layout.height),
      role: 'img',
      ariaLabel: title,
    },
    children,
  )
}

/* ------------------------------------------------------------ participants */

function lifeline(column: LayoutColumn, top: number, bottom: number): Element {
  return h('line', {
    dataShape: 'lifeline',
    x1: n(column.x),
    y1: n(top),
    x2: n(column.x),
    y2: n(bottom),
    stroke: token('line'),
    strokeWidth: '1',
  })
}

function participantElement(column: LayoutColumn, top: number): Element {
  const { participant, x, width, height } = column
  const label = participant.label
  const lines = label.split('\n')
  if (participant.kind === 'actor') {
    const headR = 7
    const headY = top + headR + 2
    const bodyTop = headY + headR
    const bodyBottom = bodyTop + 14
    const stroke = { stroke: token('actor-stroke'), strokeWidth: '1.5', strokeLinecap: 'round' }
    const parts: ElementContent[] = [
      h('circle', { ...stroke, cx: n(x), cy: n(headY), r: n(headR), fill: token('actor-fill') }),
      h('path', {
        ...stroke,
        d: `M${n(x)},${n(bodyTop)}V${n(bodyBottom)}M${n(x - 10)},${n(bodyTop + 4)}H${n(x + 10)}M${n(x)},${n(bodyBottom)}L${n(x - 8)},${n(bodyBottom + 12)}M${n(x)},${n(bodyBottom)}L${n(x + 8)},${n(bodyBottom + 12)}`,
        fill: 'none',
      }),
    ]
    const textTop = bodyBottom + 14 + SMALL_FONT_SIZE
    lines.forEach((value, i) => {
      parts.push(
        h('text', { x: n(x), y: n(textTop + i * SMALL_FONT_SIZE * LINE_HEIGHT), fill: token('actor-text'), fontSize: n(SMALL_FONT_SIZE), textAnchor: 'middle' }, [
          text(value),
        ]),
      )
    })
    return h('g', { dataShape: 'actor' }, parts)
  }
  const boxHeight = M.participantHeight
  const y = top + height - boxHeight
  const parts: ElementContent[] = [
    h('rect', {
      x: n(x - width / 2),
      y: n(y),
      width: n(width),
      height: n(boxHeight),
      rx: '3',
      fill: token('actor-fill'),
      stroke: token('actor-stroke'),
      strokeWidth: '1',
    }),
  ]
  const start = y + boxHeight / 2 - ((lines.length - 1) * LINE_H) / 2 + FONT_SIZE * 0.35
  lines.forEach((value, i) => {
    parts.push(h('text', { x: n(x), y: n(start + i * LINE_H), fill: token('actor-text'), fontSize: n(FONT_SIZE), textAnchor: 'middle' }, [text(value)]))
  })
  return h('g', { dataShape: 'participant' }, parts)
}

function boxElement(box: LayoutBox): Element {
  const parts: ElementContent[] = [
    h('rect', {
      x: n(box.x),
      y: n(box.y),
      width: n(box.width),
      height: n(box.height),
      rx: '3',
      fill: token('label-fill'),
      fillOpacity: '0.35',
      stroke: token('label-stroke'),
      strokeWidth: '1',
    }),
  ]
  if (box.label !== undefined) {
    parts.push(
      h('text', { x: n(box.x + box.width / 2), y: n(box.y + M.boxLabelHeight - 7), fill: token('label-text'), fontSize: n(FONT_SIZE), textAnchor: 'middle' }, [
        text(box.label),
      ]),
    )
  }
  return h('g', { dataShape: 'box' }, parts)
}

/* ------------------------------------------------------------------ rows */

function activationElement(activation: LayoutActivation): Element {
  return h('rect', {
    dataShape: 'activation',
    x: n(activation.x),
    y: n(activation.y),
    width: n(activation.width),
    height: n(activation.height),
    fill: token('activation-fill'),
    stroke: token('activation-stroke'),
    strokeWidth: '1',
  })
}

function noteElement(note: LayoutNote): Element {
  const parts: ElementContent[] = [
    h('rect', {
      x: n(note.x),
      y: n(note.y),
      width: n(note.width),
      height: n(note.height),
      rx: '2',
      fill: token('note-fill'),
      stroke: token('note-stroke'),
      strokeWidth: '1',
    }),
  ]
  const cx = note.x + note.width / 2
  note.lines.forEach((value, i) => {
    parts.push(
      h('text', { x: n(cx), y: n(note.y + M.notePad + FONT_SIZE + i * LINE_H - 2), fill: token('note-text'), fontSize: n(FONT_SIZE), textAnchor: 'middle' }, [
        text(value),
      ]),
    )
  })
  return h('g', { dataShape: 'note' }, parts)
}

function frameElement(frame: LayoutFrame): Element {
  if (frame.frame.kind === 'rect') {
    return h('g', { dataShape: 'frame', dataKind: 'rect' }, [
      h('rect', {
        x: n(frame.x),
        y: n(frame.y),
        width: n(frame.width),
        height: n(frame.height),
        fill: token('label-fill'),
        fillOpacity: '0.35',
        stroke: token('label-stroke'),
        strokeWidth: '1',
      }),
    ])
  }
  const stroke = { stroke: token('label-stroke'), strokeWidth: '1' }
  const tabWidth = frameTabWidth(frame.frame.kind)
  const parts: ElementContent[] = [
    h('rect', { ...stroke, x: n(frame.x), y: n(frame.y), width: n(frame.width), height: n(frame.height), fill: 'none' }),
    h('path', {
      ...stroke,
      d: `M${n(frame.x)},${n(frame.y)}h${n(tabWidth)}v${n(M.frameLabelHeight - 6)}l-6,6h${n(-(tabWidth - 6))}z`,
      fill: token('label-fill'),
    }),
    h('text', { x: n(frame.x + tabWidth / 2), y: n(frame.y + M.frameLabelHeight / 2 + 4), fill: token('label-text'), fontSize: n(SMALL_FONT_SIZE), fontWeight: '600', textAnchor: 'middle' }, [
      text(frame.frame.kind),
    ]),
  ]
  frame.sections.forEach((section, i) => {
    if (i > 0) {
      parts.push(
        h('line', { ...stroke, x1: n(frame.x), y1: n(section.y), x2: n(frame.x + frame.width), y2: n(section.y), strokeDasharray: DOTTED }),
      )
    }
    if (section.label === '') return
    const x = i === 0 ? frame.x + tabWidth + 8 : frame.x + 8
    parts.push(
      h('text', { x: n(x), y: n(section.y + M.frameLabelHeight / 2 + 4), fill: token('label-text'), fontSize: n(SMALL_FONT_SIZE) }, [
        text(`[${section.label}]`),
      ]),
    )
  })
  return h('g', { dataShape: 'frame', dataKind: frame.frame.kind }, parts)
}

function messageElement(message: LayoutMessage): Element {
  const { message: m, fromX, toX, y, self, lines } = message
  const stroke = {
    stroke: token('signal'),
    strokeWidth: '1.5',
    ...(m.line === 'dotted' ? { strokeDasharray: DOTTED } : {}),
  }
  const heads = { stroke: token('signal'), strokeWidth: '1.5', strokeLinejoin: 'round' }
  const parts: ElementContent[] = []
  if (self) {
    const right = fromX + M.selfLoopWidth
    const bottom = y + M.selfLoopHeight
    parts.push(h('path', { ...stroke, d: `M${n(fromX)},${n(y)}H${n(right)}V${n(bottom)}H${n(fromX)}`, fill: 'none' }))
    parts.push(...arrowHead(m.head, fromX, bottom, -1, heads))
    if (m.bidirectional) parts.push(...arrowHead(m.head, fromX, y, -1, heads))
    const textX = right + M.textPad / 2
    const start = y + M.selfLoopHeight / 2 - ((lines.length - 1) * LINE_H) / 2 + FONT_SIZE * 0.35
    lines.forEach((value, i) => {
      parts.push(h('text', { x: n(textX), y: n(start + i * LINE_H), fill: token('signal-text'), fontSize: n(FONT_SIZE) }, [text(value)]))
    })
  } else {
    const direction: 1 | -1 = toX >= fromX ? 1 : -1
    parts.push(h('path', { ...stroke, d: `M${n(fromX)},${n(y)}H${n(toX)}`, fill: 'none' }))
    parts.push(...arrowHead(m.head, toX, y, direction, heads))
    if (m.bidirectional) parts.push(...arrowHead(m.head, fromX, y, direction === 1 ? -1 : 1, heads))
    const cx = (fromX + toX) / 2
    lines.forEach((value, i) => {
      const lineY = y - 6 - (lines.length - 1 - i) * LINE_H
      parts.push(h('text', { x: n(cx), y: n(lineY), fill: token('signal-text'), fontSize: n(FONT_SIZE), textAnchor: 'middle' }, [text(value)]))
    })
  }
  if (message.number !== undefined) {
    parts.push(h('circle', { cx: n(fromX), cy: n(y), r: n(M.numberRadius), fill: token('signal'), stroke: token('signal'), strokeWidth: '1' }))
    parts.push(
      h('text', { x: n(fromX), y: n(y + SMALL_FONT_SIZE * 0.35), fill: token('number-text'), fontSize: n(SMALL_FONT_SIZE), fontWeight: '600', textAnchor: 'middle' }, [
        text(n(message.number)),
      ]),
    )
  }
  return h('g', { dataShape: 'message' }, parts)
}

/** An arrowhead ending at (x, y), pointing along `direction` (1 right, -1 left). */
function arrowHead(head: LayoutMessage['message']['head'], x: number, y: number, direction: 1 | -1, stroke: Record<string, string>): Element[] {
  const back = x - HEAD * direction
  switch (head) {
    case 'arrow':
      return [h('path', { ...stroke, d: `M${n(x)},${n(y)}L${n(back)},${n(y - 5)}L${n(back)},${n(y + 5)}z`, fill: token('signal') })]
    case 'open':
      return [h('path', { ...stroke, d: `M${n(back)},${n(y - 5)}L${n(x)},${n(y)}L${n(back)},${n(y + 5)}`, fill: 'none' })]
    case 'cross': {
      const cx = x - 6 * direction
      return [h('path', { ...stroke, d: `M${n(cx - 4)},${n(y - 4)}L${n(cx + 4)},${n(y + 4)}M${n(cx - 4)},${n(y + 4)}L${n(cx + 4)},${n(y - 4)}`, fill: 'none' })]
    }
    case 'none':
      return []
  }
}
