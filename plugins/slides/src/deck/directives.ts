/**
 * `<!-- key: value -->` directives.
 *
 * A directive is an HTML comment alone on its lines at the root of a slide.
 * CommonMark parses it as an `html` node, which the renderer would otherwise
 * show as escaped text; recognised ones are re-typed by the transform and
 * consumed by the reader. The keys and what they accept live in
 * `directive-keys/`, so a bad value stays an ordinary comment (visible, and
 * reported) rather than a silently broken slide.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { directiveSpec, isDirectiveKey, type DirectiveKey } from './directive-keys/registry.js'

export const SLIDE_DIRECTIVE_NODE = 'slideDirective'

export interface SlideDirectiveNode extends MarkdownNode {
  readonly type: typeof SLIDE_DIRECTIVE_NODE
  readonly key: DirectiveKey
  readonly argument: string
}

export function isSlideDirectiveNode(node: MarkdownNode): node is SlideDirectiveNode {
  return node.type === SLIDE_DIRECTIVE_NODE
}

/**
 * One comment, one directive: `<!-- key: value -->` and nothing else.
 * Whitespace around the comment is allowed: an html node keeps up to three
 * spaces of indentation and any trailing spaces, but never its line ending.
 */
const DIRECTIVE = /^\s*<!--\s*([a-z][\w-]*)\s*:\s*([^]*?)\s*-->\s*$/i

export interface DirectiveMatch {
  readonly key: string
  readonly argument: string
}

/** Comment shape only; the key may be unknown and the argument invalid. */
export function matchDirective(value: string): DirectiveMatch | undefined {
  const match = DIRECTIVE.exec(value)
  if (match === null) return undefined
  return { key: match[1]!.toLowerCase(), argument: match[2]! }
}

/** Why the argument is rejected, or undefined when it is accepted. */
export function directiveProblem(key: DirectiveKey, argument: string): string | undefined {
  return directiveSpec(key).problem(argument)
}

/** Recognises both a re-typed node and a raw `html` comment that would be re-typed. */
export function readDirective(node: MarkdownNode): { key: DirectiveKey; argument: string } | undefined {
  if (isSlideDirectiveNode(node)) return { key: node.key, argument: node.argument }
  if (node.type !== 'html' || typeof node.value !== 'string') return undefined
  const match = matchDirective(node.value)
  if (match === undefined || !isDirectiveKey(match.key)) return undefined
  if (directiveProblem(match.key, match.argument) !== undefined) return undefined
  return { key: match.key, argument: match.argument }
}
