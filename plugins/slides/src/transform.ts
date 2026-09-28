/**
 * The syntax transform: the one place the tree changes.
 *
 * Runs once per compilation, at the root level only. In order: lift the
 * front matter found at byte 0 of the source into a `yaml` node (or mark
 * it pending when the source ends inside it, mid-stream), run each
 * root node through the retyper for its type (`retype/`: directives and
 * markers are re-typed, rules annotated, and what the author should know
 * reported), then read the deck once more for the structural diagnostics.
 * The tree stays flat: the editor keeps every block, and
 * `documentToMarkdown` writes the same bytes.
 */
import type { MarkdownRoot } from '@internal/document-contracts/index.js'
import type { SyntaxTransformContext } from '@internal/extension-contracts/index.js'
import { endsInsideFrontMatter, findFrontMatter, liftFrontMatter, opensLikeFrontMatter } from './deck/front-matter.js'
import { markPending } from './deck/pending.js'
import { readDeck } from './deck/read-deck.js'
import { slidesDiagnostic } from './deck/diagnostics.js'
import { RETYPERS } from './retype/registry.js'

export interface TransformOptions {
  readonly frontMatter: boolean
}

export function transformDeck(tree: MarkdownRoot, context: SyntaxTransformContext, options: TransformOptions): MarkdownRoot {
  let root = tree
  if (options.frontMatter && context.source !== undefined) {
    const block = findFrontMatter(context.source)
    const lifted = block === undefined ? undefined : liftFrontMatter(root, block)
    if (lifted !== undefined) root = lifted
    else {
      // Mid-stream and forgotten fences look alike, so the pending blocks are still reported.
      if (endsInsideFrontMatter(context.source)) root = { ...root, children: root.children.map(markPending) }
      if (opensLikeFrontMatter(context.source)) context.report(slidesDiagnostic('SLIDES_FRONT_MATTER_INVALID', root.children[0]?.position))
    }
  }

  const children = root.children.map((node) => RETYPERS.get(node.type)?.(node, context) ?? node)
  const deck = readDeck({ ...root, children }, context.source)
  for (const problem of deck.diagnostics) context.report(problem)
  return { ...root, children }
}
