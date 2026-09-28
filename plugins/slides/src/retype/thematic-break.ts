/** A `***` or `___` rule is annotated, so the renderer and the serializer can tell it from a slide break without the source. */
import { BREAK_DATA_KEY, breakSpelling } from '../deck/breaks.js'
import type { Retyper } from './retyper.js'

export const retypeThematicBreak: Retyper = (node, context) => {
  if (breakSpelling(node, context.source) !== 'rule') return node
  const data = typeof node['data'] === 'object' && node['data'] !== null ? (node['data'] as Record<string, unknown>) : {}
  return { ...node, data: { ...data, [BREAK_DATA_KEY]: { rule: true } } }
}
