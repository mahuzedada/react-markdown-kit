/**
 * Where things go on a PowerPoint slide, in inches. PowerPoint's own 16:9
 * and 4:3 layouts are 10in wide; the title sits at the top and the body
 * frame fills what is left, split in two for columns or an image layout.
 */
import { layoutSpec } from '../deck/directive-keys/layout.js'
import type { SlideAspect, SlideModel } from '../deck/model.js'

export interface Frame {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export const PPTX_LAYOUTS: Readonly<Record<SlideAspect, { readonly name: string; readonly width: number; readonly height: number }>> = {
  '16:9': { name: 'LAYOUT_16x9', width: 10, height: 5.625 },
  '4:3': { name: 'LAYOUT_4x3', width: 10, height: 7.5 },
}

const MARGIN = 0.5
const TITLE_HEIGHT = 0.9
const FOOTER_HEIGHT = 0.35

export interface SlideFrames {
  readonly title: Frame
  /** One frame per body column */
  readonly body: readonly Frame[]
  /** The half an image layout gives its picture */
  readonly image?: Frame
  readonly footer: Frame
}

export function slideFrames(slide: SlideModel, aspect: SlideAspect, hasTitle: boolean): SlideFrames {
  const { width, height } = PPTX_LAYOUTS[aspect]
  const half = width / 2
  const imageSide = layoutSpec(slide.layout).imageSide
  const left = imageSide === 'left' ? half + MARGIN / 2 : MARGIN
  const right = imageSide === 'right' ? half - MARGIN / 2 : width - MARGIN
  const top = hasTitle ? MARGIN + TITLE_HEIGHT : MARGIN
  const bottom = height - MARGIN - (slide.footer !== undefined || slide.paginate === true ? FOOTER_HEIGHT : 0)
  const body: Frame = { x: left, y: top, w: right - left, h: bottom - top }
  const columns = slide.columns === 2 ? splitColumns(body) : [body]
  return {
    title: { x: left, y: MARGIN, w: right - left, h: TITLE_HEIGHT },
    body: columns,
    ...(imageSide === undefined ? {} : { image: { x: imageSide === 'left' ? 0 : half, y: 0, w: half, h: height } }),
    footer: { x: MARGIN, y: height - MARGIN / 2 - FOOTER_HEIGHT, w: width - 2 * MARGIN, h: FOOTER_HEIGHT },
  }
}

function splitColumns(frame: Frame): Frame[] {
  const gap = 0.4
  const w = (frame.w - gap) / 2
  return [
    { ...frame, w },
    { ...frame, x: frame.x + w + gap, w },
  ]
}
