/**
 * The syntax transform: the one place the tree changes.
 *
 * Runs once per compilation, at the root level only. In order: lift the
 * front matter found at byte 0 of the source into a `yaml` node, re-type
 * directives and markers, annotate rules so the renderer can tell them from
 * slide breaks without the source, report what the author should know, then
 * read the deck once more for the structural diagnostics. The tree stays
 * flat: the editor keeps every block, and `documentToMarkdown` writes the
 * same bytes.
 */
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import type { SyntaxTransformContext } from '@internal/extension-contracts/index.js'
import { BREAK_DATA_KEY, breakSpelling, sliceSource } from './deck/breaks.js'
import { SLIDE_DIRECTIVE_NODE, directiveProblem, isDirectiveKey, matchDirective, type SlideDirectiveNode } from './deck/directives.js'
import { findFrontMatter, liftFrontMatter, opensLikeFrontMatter } from './deck/front-matter.js'
import { SLIDE_MARKER_NODE, attachedMarker, markerKind, type SlideMarkerNode } from './deck/markers.js'
import { readDeck } from './deck/read-deck.js'
import { slidesDiagnostic } from './deck/diagnostics.js'

export interface TransformOptions {
  readonly frontMatter: boolean
}

const SETEXT_UNDERLINE = /(?:^|\n) {0,3}-{2,}[ \t]*$/

export function transformDeck(tree: MarkdownRoot, context: SyntaxTransformContext, options: TransformOptions): MarkdownRoot {
  let root = tree
  if (options.frontMatter && context.source !== undefined) {
    const block = findFrontMatter(context.source)
    const lifted = block === undefined ? undefined : liftFrontMatter(root, block)
    if (lifted !== undefined) root = lifted
    else if (opensLikeFrontMatter(context.source)) context.report(slidesDiagnostic('SLIDES_FRONT_MATTER_INVALID', root.children[0]?.position))
  }

  const children = root.children.map((node) => retype(node, context))
  const deck = readDeck({ ...root, children }, context.source)
  for (const problem of deck.diagnostics) context.report(problem)
  return { ...root, children }
}

function retype(node: MarkdownNode, context: SyntaxTransformContext): MarkdownNode {
  const position = node.position === undefined ? {} : { position: node.position }

  if (node.type === 'thematicBreak') {
    if (breakSpelling(node, context.source) !== 'rule') return node
    const data = typeof node['data'] === 'object' && node['data'] !== null ? (node['data'] as Record<string, unknown>) : {}
    return { ...node, data: { ...data, [BREAK_DATA_KEY]: { rule: true } } }
  }

  if (node.type === 'heading' && node['depth'] === 2) {
    const spelling = sliceSource(node, context.source)
    if (spelling !== undefined && SETEXT_UNDERLINE.test(spelling)) context.report(slidesDiagnostic('SLIDES_SETEXT_HEADING', node.position))
    return node
  }

  if (node.type === 'html' && typeof node.value === 'string') {
    const match = matchDirective(node.value)
    if (match === undefined) return node
    if (!isDirectiveKey(match.key)) {
      context.report(slidesDiagnostic('SLIDES_DIRECTIVE_UNKNOWN', node.position))
      return node
    }
    const problem = directiveProblem(match.key, match.argument)
    if (problem !== undefined) {
      context.report(slidesDiagnostic('SLIDES_DIRECTIVE_INVALID', node.position, problem))
      return node
    }
    const directive: SlideDirectiveNode = { type: SLIDE_DIRECTIVE_NODE, key: match.key, argument: match.argument, ...position }
    return directive
  }

  if (node.type === 'paragraph') {
    const kind = markerKind(node)
    if (kind !== undefined) {
      const marker: SlideMarkerNode = { type: SLIDE_MARKER_NODE, kind, ...position }
      return marker
    }
    if (attachedMarker(node) !== undefined) context.report(slidesDiagnostic('SLIDES_MARKER_ATTACHED', node.position))
  }

  if (node.type === 'list' || node.type === 'blockquote') {
    // Lazy continuation glues a marker to the last paragraph of a container too.
    const last = lastParagraph(node)
    if (last !== undefined && attachedMarker(last) !== undefined) context.report(slidesDiagnostic('SLIDES_MARKER_ATTACHED', last.position))
  }
  return node
}

/** The paragraph that closes a container: the last child, followed down. */
function lastParagraph(node: MarkdownNode): MarkdownNode | undefined {
  if (node.type === 'paragraph') return node
  const last = node.children?.[node.children.length - 1]
  return last === undefined ? undefined : lastParagraph(last)
}
