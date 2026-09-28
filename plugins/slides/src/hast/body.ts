/**
 * A slide's `<div data-rmk-slide-body>`. Blocks before the first `--` are
 * its direct children; each later group is a `<div data-rmk-fragment="n">`.
 * With a `::right::` marker the body holds two `<div data-rmk-slide-column>`
 * instead, each with its own share of the groups; a group that spans the
 * marker keeps one number on both sides. Every block also passes through
 * the enhancers, which may take reveal steps of their own.
 */
import type { ElementContent } from 'hast'
import type { SlideModel } from '../deck/model.js'
import { BLOCK_ENHANCERS } from './enhancers/registry.js'
import { FragmentCounter } from './fragment-counter.js'
import { h } from './h.js'
import type { RenderBlock } from './render-block.js'

export interface RenderedBody {
  readonly element: ElementContent
  /** Reveal steps on the slide: `data-rmk-slide-fragments`. */
  readonly fragments: number
}

interface Segment {
  readonly column: number
  readonly group: number
  readonly fragment: number
  readonly children: ElementContent[]
}

export function renderBody(slide: SlideModel, render: RenderBlock): RenderedBody {
  const counter = new FragmentCounter()
  const segments: Segment[] = []
  let column = 0

  slide.groups.forEach((_, group) => {
    const fragment = group === 0 ? 0 : counter.next()
    const blocks = slide.blocks.filter((block) => block.group === group)
    // A pause with nothing after it still shows as an (empty) step.
    if (blocks.length === 0 && group > 0) segments.push({ column, group, fragment, children: [] })
    for (const block of blocks) {
      column = block.column
      const rendered = render(block.node)
      for (const element of rendered) for (const enhance of BLOCK_ENHANCERS) enhance(element, { slide, counter })
      const last = segments[segments.length - 1]
      if (last !== undefined && last.column === column && last.group === group) last.children.push(...rendered)
      else segments.push({ column, group, fragment, children: rendered })
    }
  })

  const content = (inColumn: number): ElementContent[] =>
    segments
      .filter((segment) => segment.column === inColumn)
      .flatMap((segment) => (segment.group === 0 ? segment.children : [h('div', { dataRmkFragment: String(segment.fragment) }, segment.children)]))

  const element =
    slide.columns === 1
      ? h('div', { dataRmkSlideBody: '' }, content(0))
      : h(
          'div',
          { dataRmkSlideBody: '', dataRmkSlideColumns: String(slide.columns) },
          Array.from({ length: slide.columns }, (_, index) => h('div', { dataRmkSlideColumn: String(index + 1) }, content(index))),
        )
  return { element, fragments: counter.current }
}
