/** A root-level node, looked at once by the transform: returned as is, re-typed, annotated, or reported on. */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import type { SyntaxTransformContext } from '@internal/extension-contracts/index.js'

export type Retyper = (node: MarkdownNode, context: SyntaxTransformContext) => MarkdownNode

export function positionOf(node: MarkdownNode): { position?: NonNullable<MarkdownNode['position']> } {
  return node.position === undefined ? {} : { position: node.position }
}
