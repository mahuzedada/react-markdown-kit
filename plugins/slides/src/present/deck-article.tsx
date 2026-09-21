/**
 * The `components.article` the present entry registers. The renderer passes
 * every <article> in the output through it with its hast `node` and its
 * attributes as props; the deck is the one carrying `data-rmk-deck`, any
 * other article renders as itself. Options are bound when `slides()` is
 * called, so the component type is stable for the life of the extension.
 */
import { createElement, type ComponentType, type HTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { Deck } from './deck.js'
import { resolvePresentOptions, type SlidesPresentOptions } from './options.js'

export interface DeckArticleProps {
  /** The hast node, passed by the renderer and not forwarded to the DOM */
  readonly node?: unknown
  readonly children?: ReactNode
  readonly [attribute: string]: unknown
}

function attributesOf(props: DeckArticleProps): HTMLAttributes<HTMLElement> {
  const attributes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) if (key !== 'node' && key !== 'children') attributes[key] = value
  return attributes as HTMLAttributes<HTMLElement>
}

export function createDeckArticle(options: SlidesPresentOptions): ComponentType<DeckArticleProps> {
  const resolved = resolvePresentOptions(options)
  return function DeckArticle(props: DeckArticleProps): ReactElement {
    const attributes = attributesOf(props)
    if (props['data-rmk-deck'] === undefined) return createElement('article', attributes, props.children)
    return createElement(Deck, { attributes, options: resolved }, props.children)
  }
}
