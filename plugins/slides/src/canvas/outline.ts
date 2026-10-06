/**
 * Where each slide sits in the deck's source, read from the compiled tree
 * with the same rules as `readDeck`: front matter first, a `---` break
 * closes a slide and opens the next, a document-leading break opens
 * nothing. The canvas edits the source through these ranges, so a slide's
 * directives and notes stay byte for byte when its body is rewritten.
 */
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import { breakSpelling } from '../deck/breaks.js'
import { readDirective } from '../deck/directives.js'
import { markerKind } from '../deck/markers.js'
import { readDeck } from '../deck/read-deck.js'
import { isPending } from '../deck/pending.js'

export interface SourceSpan {
  readonly start: number
  readonly end: number
}

/**
 * A part of a slide the canvas writes: its current span when it has text,
 * and otherwise where its text goes and what has to come first.
 */
export interface SlideSlot {
  readonly span?: SourceSpan
  readonly insertAt: number
  readonly prefix: string
}

export interface BlockOutline {
  readonly span: SourceSpan
  readonly kind: string
  readonly line: number
}

export interface SlideOutline {
  readonly blocks: readonly BlockOutline[]
  /** After the break that opened the slide, or after the front matter. */
  readonly start: number
  /** Where the next break starts, or the end of the source. */
  readonly end: number
  readonly body: SlideSlot
  /** Independent column ranges allow editing one side without rewriting the other. */
  readonly columns?: readonly [SlideSlot, SlideSlot]
  readonly notes: SlideSlot
  /** Valid layout directives before the notes, excluding fenced examples. */
  readonly layouts: readonly SourceSpan[]
}

export interface DeckOutline {
  readonly slides: readonly SlideOutline[]
  /** Everything before the first slide: front matter or a leading break. */
  readonly head: number
}

interface Draft {
  readonly end?: number
  readonly start: number
  readonly nodes: MarkdownNode[]
}

export function outlineDeck(root: MarkdownRoot, source: string): DeckOutline {
  const drafts: Draft[] = []
  let current: Draft | undefined
  let head = 0

  root.children.forEach((node, index) => {
    if (isPending(node)) return
    const span = spanOf(node)
    if (index === 0 && node.type === 'yaml') {
      head = span?.end ?? 0
      return
    }
    if (node.type === 'thematicBreak' && breakSpelling(node, source) === 'slide') {
      if (current === undefined) {
        head = span?.end ?? head
        return
      }
      drafts.push({ ...current, ...(span === undefined ? {} : { end: span.start }) })
      current = { start: span?.end ?? head, nodes: [] }
      return
    }
    current ??= { start: head, nodes: [] }
    current.nodes.push(node)
  })
  if (current !== undefined) drafts.push(current)

  const model = readDeck(root, source)
  const slides = drafts.map((draft, index) => ({ ...outlineSlide(draft, source.length), blocks: (model.slides[index]?.blocks ?? []).flatMap(({ node }) => {
    const span = spanOf(node)
    return span === undefined ? [] : [{ span, kind: node.type === 'code' && node.lang === 'mermaid' ? 'diagram' : node.type, line: node.position?.start.line ?? 1 }]
  }) }))
  return { slides, head }
}

function outlineSlide(draft: Draft, length: number): Omit<SlideOutline, 'blocks'> {
  const end = draft.end ?? length
  const nodes = draft.nodes
  let first = 0
  while (first < nodes.length && readDirective(nodes[first]!) !== undefined) first += 1
  const markerAt = nodes.findIndex((node) => markerKind(node) === 'notes')
  const bodyNodes = nodes.slice(first, markerAt === -1 ? nodes.length : markerAt)
  const noteNodes = markerAt === -1 ? [] : nodes.slice(markerAt + 1)
  const afterHead = first === 0 ? draft.start : (spanOf(nodes[first - 1]!)?.end ?? draft.start)
  const bodySpan = joinSpans(bodyNodes)
  const columnAt = bodyNodes.findIndex((node) => markerKind(node) === 'column')
  const columnMarker = columnAt === -1 ? undefined : spanOf(bodyNodes[columnAt])
  const columnSlot = (nodes: readonly MarkdownNode[], insertAt: number): SlideSlot => {
    const span = joinSpans(nodes)
    return span === undefined ? { insertAt, prefix: '\n\n' } : { span, insertAt: span.start, prefix: '' }
  }
  const marker = markerAt === -1 ? undefined : spanOf(nodes[markerAt]!)
  const noteSpan = joinSpans(noteNodes)

  return {
    start: draft.start,
    end,
    layouts: nodes.slice(0, markerAt === -1 ? nodes.length : markerAt)
      .filter((node) => readDirective(node)?.key === 'layout')
      .flatMap((node) => { const span = spanOf(node); return span === undefined ? [] : [span] }),
    ...(columnMarker === undefined ? {} : { columns: [columnSlot(bodyNodes.slice(0, columnAt), afterHead), columnSlot(bodyNodes.slice(columnAt + 1), columnMarker.end)] as const }),
    body: bodySpan === undefined ? { insertAt: afterHead, prefix: '\n\n' } : { span: bodySpan, insertAt: bodySpan.start, prefix: '' },
    notes:
      noteSpan !== undefined
        ? { span: noteSpan, insertAt: noteSpan.start, prefix: '' }
        : marker !== undefined
          ? { insertAt: marker.end, prefix: '\n\n' }
          : { insertAt: bodySpan?.end ?? afterHead, prefix: '\n\n???\n\n' },
  }
}

function spanOf(node: MarkdownNode | undefined): SourceSpan | undefined {
  const start = node?.position?.start.offset
  const end = node?.position?.end.offset
  return start === undefined || end === undefined ? undefined : { start, end }
}

function joinSpans(nodes: readonly MarkdownNode[]): SourceSpan | undefined {
  const first = spanOf(nodes[0])
  const last = spanOf(nodes[nodes.length - 1])
  return first === undefined || last === undefined ? undefined : { start: first.start, end: last.end }
}

/** Each slide's span in the source, from its first byte after the break to the next break. */
export function slideSpans(root: MarkdownRoot, source: string): SourceSpan[] {
  return outlineDeck(root, source).slides.map(({ start, end }) => ({ start, end }))
}
