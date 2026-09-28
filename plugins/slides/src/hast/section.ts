/**
 * One slide as a `<section>`. Its children, in order: the background
 * `<img>`, the layout's side `<img>`, the body, the footer and the hidden
 * notes, each present only when the slide has it. Pictures are `<img>`s so
 * the URL policy sanitises `src` like any other image.
 */
import type { ElementContent } from 'hast'
import type { SlideModel } from '../deck/model.js'
import { renderBody } from './body.js'
import { h } from './h.js'
import type { RenderBlock } from './render-block.js'
import { sectionAttributes } from './section-attributes.js'

export interface SectionOptions {
  readonly notes: boolean
  readonly slideLabel: string
}

export function renderSection(slide: SlideModel, render: RenderBlock, options: SectionOptions): ElementContent {
  const body = renderBody(slide, render)
  const label = slide.title ?? `${options.slideLabel} ${slide.index + 1}`
  return h('section', sectionAttributes({ slide, label, fragments: body.fragments }), [
    ...picture('dataRmkSlideBackground', slide.background),
    ...picture('dataRmkSlideImage', slide.image),
    body.element,
    ...footer(slide),
    ...(options.notes && slide.notes.length > 0 ? [h('aside', { dataRmkSlideNotes: '', hidden: true }, slide.notes.flatMap(render))] : []),
  ])
}

function picture(attribute: string, src: string | undefined): ElementContent[] {
  return src === undefined ? [] : [h('img', { [attribute]: '', src, alt: '' })]
}

/** The footer text and, with `paginate`, the slide number. */
function footer(slide: SlideModel): ElementContent[] {
  const parts = [
    ...(slide.footer === undefined ? [] : [h('span', { dataRmkSlideFooterText: '' }, [{ type: 'text', value: slide.footer }])]),
    ...(slide.paginate === true ? [h('span', { dataRmkSlideNumber: '' }, [{ type: 'text', value: String(slide.index + 1) }])] : []),
  ]
  return parts.length === 0 ? [] : [h('footer', { dataRmkSlideFooter: '' }, parts)]
}
