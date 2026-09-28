/**
 * `readDeck`: a flat mdast root, read as slides.
 *
 * One pass over the root's children. It accepts both what the transform
 * produces (`slideMarker`, `slideDirective`, annotated breaks) and the
 * untouched CommonMark shapes (paragraph `--`, `html` comments), so a
 * document compiled with another extension list still renders as a deck.
 * Structure problems (an empty slide, a duplicate name, a misplaced
 * marker) are collected on the model; the transform reports them.
 */
import type { MarkdownRoot } from '@internal/document-contracts/index.js'
import type { MarkdownDiagnostic } from '@internal/diagnostics/index.js'
import { breakSpelling } from './breaks.js'
import { slidesDiagnostic, type ReportProblem } from './diagnostics.js'
import { finishSlides } from './finish-slides.js'
import type { DeckModel } from './model.js'
import { readBlock } from './read-block.js'
import { NO_DECK_SETTINGS, readFrontMatterNode, type DeckSettings } from './read-front-matter-node.js'
import { isPending } from './pending.js'
import { newDraft, type SlideDraft } from './slide-draft.js'

export function readDeck(root: MarkdownRoot, source?: string): DeckModel {
  const diagnostics: MarkdownDiagnostic[] = []
  const report: ReportProblem = (code, range, detail) => diagnostics.push(slidesDiagnostic(code, range, detail))
  const drafts: SlideDraft[] = []
  let deck: DeckSettings = NO_DECK_SETTINGS
  let current: SlideDraft | undefined

  root.children.forEach((node, index) => {
    // Front matter still being written is neither a slide nor content yet.
    if (isPending(node)) return
    if (index === 0 && node.type === 'yaml') {
      deck = readFrontMatterNode(node, report)
      return
    }
    if (node.type === 'thematicBreak' && breakSpelling(node, source) === 'slide') {
      // A document-leading break opens nothing; every other break closes a
      // slide and opens the next, even when that next one stays empty.
      if (current === undefined) return
      drafts.push(current)
      current = newDraft(node.position, deck.defaults)
      return
    }
    current ??= newDraft(undefined, deck.defaults)
    readBlock(current, node, report)
  })
  if (current !== undefined) drafts.push(current)

  const slides = finishSlides(drafts, report)
  const title = deck.title ?? slides[0]?.title
  return {
    ...(title === undefined ? {} : { title }),
    ...(deck.aspect === undefined ? {} : { aspect: deck.aspect }),
    class: deck.defaults.classes,
    ...(deck.defaults.background === undefined ? {} : { background: deck.defaults.background }),
    slides,
    diagnostics,
  }
}
