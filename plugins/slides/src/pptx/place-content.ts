/**
 * Lays a column's content items out top to bottom in its frame. Runs of
 * text share one text box that PowerPoint shrinks to fit; tables take the
 * height their rows need; pictures share what is left. When the estimate
 * overflows the frame every height scales down with it.
 */
import type PptxGenJS from 'pptxgenjs'
import type { ContentItem } from './blocks/content-item.js'
import type { Frame } from './geometry.js'
import type { PptxTheme } from './theme.js'

export interface PlaceOptions {
  readonly theme: PptxTheme
  readonly centered: boolean
  readonly color: string
}

type Placed = ContentItem & { readonly height: number }

const ROW_HEIGHT = 0.4
const MIN_IMAGE_HEIGHT = 1

export function placeContent(slide: PptxGenJS.Slide, items: readonly ContentItem[], frame: Frame, options: PlaceOptions): void {
  const merged = mergeText(items)
  const images = merged.filter((item) => item.kind === 'image').length
  const fixed = merged.reduce((sum, item) => sum + (item.kind === 'image' ? 0 : estimate(item, options.theme)), 0)
  const imageHeight = images === 0 ? 0 : Math.max(MIN_IMAGE_HEIGHT, (frame.h - fixed) / images)
  const placed: Placed[] = merged.map((item) => ({ ...item, height: item.kind === 'image' ? imageHeight : estimate(item, options.theme) }))
  const total = placed.reduce((sum, item) => sum + item.height, 0)
  const scale = total > frame.h ? frame.h / total : 1

  // A lone text box in a centred layout takes the whole frame so it can sit in the middle.
  const lone = placed.length === 1 && placed[0]!.kind === 'text'
  let y = frame.y
  for (const item of placed) {
    const h = lone ? frame.h : item.height * scale
    const box = { x: frame.x, y, w: frame.w, h }
    if (item.kind === 'text') {
      slide.addText(item.runs, {
        ...box,
        fontFace: options.theme.font,
        fontSize: options.theme.fontSize,
        color: options.color,
        valign: options.centered ? 'middle' : 'top',
        align: options.centered ? 'center' : 'left',
        fit: 'shrink',
        margin: 0,
      })
    } else if (item.kind === 'image') {
      slide.addImage({ data: item.data, altText: item.alt, ...box, sizing: { type: 'contain', w: box.w, h: box.h } })
    } else {
      slide.addTable(item.rows, { ...box, fontFace: options.theme.font, fontSize: Math.round(options.theme.fontSize * 0.75), color: options.color, border: { type: 'solid', pt: 0.5, color: options.theme.muted } })
    }
    y += h
  }
}

function mergeText(items: readonly ContentItem[]): ContentItem[] {
  const merged: ContentItem[] = []
  for (const item of items) {
    const last = merged[merged.length - 1]
    if (item.kind === 'text' && last?.kind === 'text') merged[merged.length - 1] = { kind: 'text', runs: [...last.runs, ...item.runs] }
    else merged.push(item)
  }
  return merged
}

function estimate(item: ContentItem, theme: PptxTheme): number {
  if (item.kind === 'table') return item.rows.length * ROW_HEIGHT
  if (item.kind !== 'text') return 0
  const lines = Math.max(1, item.runs.filter((run) => run.options?.breakLine === true).length)
  return (lines * theme.fontSize * 1.5) / 72
}
