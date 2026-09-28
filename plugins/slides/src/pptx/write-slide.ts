/**
 * One deck slide as one PowerPoint slide: background, the first heading as
 * the title, the body per column (or beside the layout's picture), the
 * footer and slide number, and the notes. Every step of every fragment is
 * shown: a file has no clicks. What a layout means (centred, inverse, a
 * picture side) comes from its spec in `directive-keys/layout.ts`.
 */
import type PptxGenJS from 'pptxgenjs'
import { layoutSpec } from '../deck/directive-keys/layout.js'
import type { SlideAspect, SlideModel } from '../deck/model.js'
import { blockItems } from './blocks/registry.js'
import { pictureOf, type ExportContext } from './export-context.js'
import { slideFrames } from './geometry.js'
import { plainText } from './inline-runs.js'
import { notesText } from './notes-text.js'
import { placeContent } from './place-content.js'

export function writeSlide(presentation: PptxGenJS, model: SlideModel, aspect: SlideAspect, context: ExportContext): void {
  const { theme } = context
  const slide = presentation.addSlide()
  const layout = layoutSpec(model.layout)
  const inverse = model.classes.includes('inverse') || layout.inverse
  const color = inverse ? theme.inverseText : theme.text
  const background = pictureOf(context, model.background)
  slide.background = background === undefined ? { color: inverse ? theme.inverseSurface : theme.surface } : { data: background }

  // The class hooks `center` and `middle` together centre a slide the way a centred layout does.
  const centered = layout.centered || (model.classes.includes('center') && model.classes.includes('middle'))
  const first = model.blocks[0]
  const titled = !centered && first !== undefined && first.node.type === 'heading'
  const frames = slideFrames(model, aspect, titled)
  if (titled) {
    slide.addText(plainText(first.node.children), { ...frames.title, fontFace: theme.font, fontSize: Math.round(theme.fontSize * 1.6), bold: true, color, valign: 'bottom', margin: 0, fit: 'shrink' })
  }

  const blocks = titled ? model.blocks.slice(1) : model.blocks
  frames.body.forEach((frame, column) => {
    const items = blockItems(blocks.filter((block) => block.column === column).map((block) => block.node), context)
    placeContent(slide, items, frame, { theme, centered, color })
  })
  const image = pictureOf(context, model.image)
  if (frames.image !== undefined && image !== undefined) {
    slide.addImage({ data: image, ...frames.image, sizing: { type: 'cover', w: frames.image.w, h: frames.image.h } })
  }

  const footer = [model.footer, model.paginate === true ? String(model.index + 1) : undefined].filter((part) => part !== undefined)
  if (footer.length > 0) {
    slide.addText(footer.join('    '), { ...frames.footer, fontFace: theme.font, fontSize: Math.round(theme.fontSize * 0.6), color: theme.muted, margin: 0 })
  }
  if (model.notes.length > 0) slide.addNotes(notesText(model.notes))
}
