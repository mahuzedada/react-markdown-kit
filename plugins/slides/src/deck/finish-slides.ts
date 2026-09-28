/**
 * Drafts to `SlideModel`s, once the walk is over: names are made unique
 * (a later duplicate loses its name), the title comes from the first
 * heading, blocks are grouped by fragment, and empty slides are reported.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import type { SourceRange } from '@internal/diagnostics/index.js'
import type { ReportProblem } from './diagnostics.js'
import type { SlideModel } from './model.js'
import type { SlideDraft } from './slide-draft.js'
import { headingText, isHeading } from './title.js'

export function finishSlides(drafts: readonly SlideDraft[], report: ReportProblem): SlideModel[] {
  const names = new Set<string>()
  return drafts.map((draft, index) => {
    const { name, ...properties } = draft.properties
    const unique = name !== undefined && !names.has(name)
    if (name !== undefined) {
      if (unique) names.add(name)
      else report('SLIDES_NAME_DUPLICATE', draft.ranges.get('name') ?? draft.first ?? draft.opener)
    }
    const groups = groupBlocks(draft)
    const heading = groups.flat().find(isHeading)
    const title = heading === undefined ? undefined : headingText(heading)
    const empty = draft.contentSeen === 0
    if (empty) report('SLIDES_SLIDE_EMPTY', draft.opener ?? draft.first)
    const position = span(draft.first, draft.last) ?? draft.opener
    return {
      ...properties,
      index,
      ...(unique ? { name } : {}),
      ...(title === undefined || title === '' ? {} : { title }),
      groups,
      blocks: draft.blocks,
      columns: draft.column + 1,
      notes: draft.notes,
      empty,
      ...(position === undefined ? {} : { position }),
    }
  })
}

/** Blocks by fragment group; a `--` with nothing after it still opens its (empty) group. */
function groupBlocks(draft: SlideDraft): MarkdownNode[][] {
  const groups: MarkdownNode[][] = Array.from({ length: draft.group + 1 }, () => [])
  for (const block of draft.blocks) groups[block.group]!.push(block.node)
  return groups
}

function span(first: SourceRange | undefined, last: SourceRange | undefined): SourceRange | undefined {
  if (first === undefined) return undefined
  return { start: first.start, end: (last ?? first).end }
}
