/**
 * Source edits the canvas makes. Writing a slot (a slide's body or notes)
 * splices only that span, so everything around it keeps its bytes.
 * Structural edits (add, duplicate, move, delete) rebuild the slide list
 * from the slides' trimmed text joined by `---`, which normalises the
 * blank lines between slides and nothing inside them.
 */
import type { SlideLayout } from '../deck/directive-keys/layout.js'
import type { DeckOutline, SlideSlot, SourceSpan } from './outline.js'

export interface SlotWrite {
  readonly value: string
  /** The slot after the write, so the next keystroke splices the same span. */
  readonly slot: SlideSlot
}

export function writeSlot(source: string, slot: SlideSlot, text: string): SlotWrite {
  const written = text.replace(/\s+$/, '')
  if (slot.span !== undefined) {
    const span: SourceSpan = { start: slot.span.start, end: slot.span.start + written.length }
    return { value: source.slice(0, slot.span.start) + written + source.slice(slot.span.end), slot: { span, insertAt: span.start, prefix: '' } }
  }
  if (written === '') return { value: source, slot }
  const start = slot.insertAt + slot.prefix.length
  return {
    value: source.slice(0, slot.insertAt) + slot.prefix + written + source.slice(slot.insertAt),
    slot: { span: { start, end: start + written.length }, insertAt: start, prefix: '' },
  }
}

/** The text a slot holds, '' when it has none. */
export function readSlot(source: string, slot: SlideSlot): string {
  return slot.span === undefined ? '' : source.slice(slot.span.start, slot.span.end)
}

function slideTexts(source: string, outline: DeckOutline): string[] {
  return outline.slides.map((slide) => source.slice(slide.start, slide.end).trim())
}

function rebuild(source: string, outline: DeckOutline, texts: readonly string[]): string {
  const head = source.slice(0, outline.head).trimEnd()
  if (texts.length === 0) return head === '' ? '' : `${head}\n`
  const body = texts.join('\n\n---\n\n')
  return `${head === '' ? '' : `${head}\n\n`}${body}\n`
}

/** A new slide after `index` (-1 puts it first). */
export function insertSlide(source: string, outline: DeckOutline, index: number, text: string): string {
  const texts = slideTexts(source, outline)
  texts.splice(index + 1, 0, text.trim())
  return rebuild(source, outline, texts)
}

export function duplicateSlide(source: string, outline: DeckOutline, index: number): string {
  const texts = slideTexts(source, outline)
  const text = texts[index]
  if (text === undefined) return source
  texts.splice(index + 1, 0, text)
  return rebuild(source, outline, texts)
}

export function removeSlide(source: string, outline: DeckOutline, index: number): string {
  const texts = slideTexts(source, outline)
  if (index < 0 || index >= texts.length) return source
  texts.splice(index, 1)
  return rebuild(source, outline, texts)
}

export function moveSlide(source: string, outline: DeckOutline, from: number, to: number): string {
  const texts = slideTexts(source, outline)
  if (from === to || texts[from] === undefined || to < 0 || to >= texts.length) return source
  const [moved] = texts.splice(from, 1)
  texts.splice(to, 0, moved!)
  return rebuild(source, outline, texts)
}

/** Patch only actual layout directives; code samples and notes keep their bytes. */
export function setSlideLayout(source: string, outline: DeckOutline, index: number, layout: SlideLayout): string {
  const slide = outline.slides[index]
  if (slide === undefined) return source
  // A column layout needs a real Markdown column boundary, not just a style.
  // Insert it before applying the earlier directive patches so offsets stay valid.
  if (layout === 'two-cols' && slide.columns === undefined) {
    const at = slide.body.span?.end ?? slide.body.insertAt
    const newline = source.includes('\r\n') ? '\r\n' : '\n'
    source = source.slice(0, at) + `${newline}${newline}::right::${newline}${newline}` + source.slice(at)
  }
  const directive = `<!-- layout: ${layout} -->`
  if (slide.layouts.length === 0) {
    const newline = source.includes('\r\n') ? '\r\n' : '\n'
    return source.slice(0, slide.start) + `${newline}${newline}${directive}${newline}${newline}` + source.slice(slide.start)
  }
  // Last directive wins in the reader. Update all occurrences so later body edits
  // cannot accidentally reveal a different, older layout.
  return [...slide.layouts].reverse().reduce((text, span) => text.slice(0, span.start) + directive + text.slice(span.end), source)
}

/** Move one block in document order. Structural markers stay in place, so
 * crossing a column boundary changes only the moved block's column.
 * Consume trailing blank lines, never indentation belonging to the next node.
 */
export function moveBlock(source: string, outline: DeckOutline, index: number, from: number, to: number): string {
  const blocks = outline.slides[index]?.blocks
  const origin = blocks?.[from]?.span
  const target = blocks?.[to]?.span
  if (from === to || origin === undefined || target === undefined) return source
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const text = source.slice(origin.start, origin.end)
  const gap = /^(?:[ \t]*\r?\n)*/.exec(source.slice(origin.end))![0]
  const end = origin.end + gap.length
  if (from < to) {
    const inserted = source.slice(0, target.end) + newline + newline + text + source.slice(target.end)
    return inserted.slice(0, origin.start) + inserted.slice(end)
  }
  const removed = source.slice(0, origin.start) + source.slice(end)
  return removed.slice(0, target.start) + text + newline + newline + removed.slice(target.start)
}
