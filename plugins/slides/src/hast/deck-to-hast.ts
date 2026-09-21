/**
 * The root handler: the whole document becomes one <article>.
 *
 * It reads the deck again from the (already transformed) mdast and renders
 * each content block through `state.one`, so headings, lists, code and every
 * other extension's nodes render exactly as they would outside a deck. The
 * result is a hast *root* rather than an element: `mdast-util-to-hast`
 * appends the GFM footnote footer to whatever root comes back, and the
 * renderer's policy and class hooks run over it afterwards. A background is
 * an <img> so the URL policy sanitises `src` like any other image.
 *
 * Static, no classes, no inline styles, no ids beyond `slide-<name>`.
 */
import type { ElementContent, Root } from 'hast'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import { h } from './h.js'
import { readDeck } from '../deck/read-deck.js'
import type { SlideAspect, SlideModel } from '../deck/model.js'

/** The slice of mdast-util-to-hast's state this handler uses. */
export interface HastState {
  one(node: MarkdownNode, parent: MarkdownNode | undefined): unknown
}

export interface DeckRenderOptions {
  readonly aspect: SlideAspect
  readonly notes: boolean
  readonly slideLabel: string
}

export function deckRoot(state: HastState, node: MarkdownRoot, options: DeckRenderOptions): Root {
  const deck = readDeck(node)
  const aspect = deck.aspect ?? options.aspect
  const article = h(
    'article',
    {
      dataRmkDeck: '',
      dataRmkDeckSlides: String(deck.slides.length),
      dataRmkDeckAspect: aspect,
      ...(deck.title === undefined ? {} : { dataRmkDeckTitle: deck.title }),
    },
    deck.slides.map((slide) => section(state, node, slide, options)),
  )
  return { type: 'root', children: [article] }
}

function section(state: HastState, root: MarkdownRoot, slide: SlideModel, options: DeckRenderOptions): ElementContent {
  const label = slide.title ?? `${options.slideLabel} ${slide.index + 1}`
  const fragments = slide.groups.length - 1
  const body = slide.groups.flatMap((group, index) => {
    const blocks = group.flatMap((block) => render(state, root, block))
    return index === 0 ? blocks : [h('div', { dataRmkFragment: String(index) }, blocks)]
  })
  return h(
    'section',
    {
      dataRmkSlide: String(slide.index + 1),
      ...(slide.title === undefined ? {} : { dataRmkSlideTitle: slide.title }),
      ariaRoledescription: 'slide',
      ariaLabel: label,
      ...(slide.name === undefined ? {} : { id: `slide-${slide.name}`, dataRmkSlideName: slide.name }),
      ...(slide.classes.length === 0 ? {} : { dataRmkSlideClass: slide.classes.join(' ') }),
      ...(fragments === 0 ? {} : { dataRmkSlideFragments: String(fragments) }),
    },
    [
      ...(slide.background === undefined ? [] : [h('img', { dataRmkSlideBackground: '', src: slide.background, alt: '' })]),
      h('div', { dataRmkSlideBody: '' }, body),
      ...(options.notes && slide.notes.length > 0
        ? [h('aside', { dataRmkSlideNotes: '', hidden: true }, slide.notes.flatMap((block) => render(state, root, block)))]
        : []),
    ],
  )
}

/** `state.one` returns a node, a list or nothing; a `raw` node is fine here, the policy handles it. */
function render(state: HastState, root: MarkdownRoot, block: MarkdownNode): ElementContent[] {
  const result = state.one(block, root)
  if (result === undefined || result === null) return []
  return (Array.isArray(result) ? result : [result]) as ElementContent[]
}
