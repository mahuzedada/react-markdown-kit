/**
 * The root handler: the whole document becomes one <article>.
 *
 * It reads the deck again from the (already transformed) mdast and renders
 * each slide as a <section> (`section.ts`). The result is a hast *root*
 * rather than an element: `mdast-util-to-hast` appends the GFM footnote
 * footer to whatever root comes back, and the renderer's policy and class
 * hooks run over it afterwards.
 *
 * Static, no classes, no inline styles, no ids beyond `slide-<name>`.
 */
import type { Root } from 'hast'
import type { MarkdownRoot } from '@internal/document-contracts/index.js'
import { h } from './h.js'
import { readDeck } from '../deck/read-deck.js'
import type { SlideAspect } from '../deck/model.js'
import { blockRenderer, type HastState } from './render-block.js'
import { renderSection } from './section.js'

export type { HastState }

export interface DeckRenderOptions {
  readonly aspect: SlideAspect
  readonly notes: boolean
  readonly slideLabel: string
}

export function deckRoot(state: HastState, node: MarkdownRoot, options: DeckRenderOptions): Root {
  const deck = readDeck(node)
  const aspect = deck.aspect ?? options.aspect
  const render = blockRenderer(state, node)
  const article = h(
    'article',
    {
      dataRmkDeck: '',
      dataRmkDeckSlides: String(deck.slides.length),
      dataRmkDeckAspect: aspect,
      ...(deck.title === undefined ? {} : { dataRmkDeckTitle: deck.title }),
    },
    deck.slides.map((slide) => renderSection(slide, render, options)),
  )
  return { type: 'root', children: [article] }
}
