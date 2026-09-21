/** Minimal hast builders, so the static renderer needs no hastscript. */
import type { Element, ElementContent, Properties, Text } from 'hast'

export function h(tagName: string, properties: Properties = {}, children: readonly ElementContent[] = []): Element {
  return { type: 'element', tagName, properties, children: [...children] }
}

export function text(value: string): Text {
  return { type: 'text', value }
}
