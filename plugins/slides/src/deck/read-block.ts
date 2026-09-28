/**
 * One root block of a slide, read into its draft: a directive sets a
 * property, a marker moves the draft on, anything else is content. The
 * lookups go through the directive and marker registries, so this file
 * does not change when the dialect grows.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { directiveSpec, isDirectiveKey } from './directive-keys/registry.js'
import type { ReportProblem } from './diagnostics.js'
import { readDirective } from './directives.js'
import { markerSpec } from './marker-kinds/registry.js'
import { markerKind, paragraphText } from './markers.js'
import { addBlock, type SlideDraft } from './slide-draft.js'

export function readBlock(draft: SlideDraft, node: MarkdownNode, report: ReportProblem): void {
  draft.first ??= node.position
  draft.last = node.position ?? draft.last

  const directive = readDirective(node)
  if (directive !== undefined) {
    const spec = directiveSpec(directive.key)
    spec.apply(draft.properties, directive.argument)
    draft.ranges.set(directive.key, node.position)
    if (spec.notice !== undefined) report(spec.notice, node.position)
    return
  }

  const marker = markerKind(node)
  if (marker !== undefined) {
    if (markerSpec(marker).apply(draft) === 'misplaced') report('SLIDES_MARKER_MISPLACED', node.position)
    return
  }

  if (draft.contentSeen === 0 && !draft.inNotes && isBareProperties(node)) report('SLIDES_PROPERTY_BARE', node.position)
  addBlock(draft, node)
}

/** remark's `class: center, middle` lines: every line of the paragraph is `known-key: value`. */
function isBareProperties(node: MarkdownNode): boolean {
  const text = paragraphText(node)
  if (text === undefined) return false
  return text.split('\n').every((line) => {
    const match = /^([a-z][\w-]*)\s*:\s*\S/i.exec(line)
    return match !== null && isDirectiveKey(match[1]!.toLowerCase())
  })
}
