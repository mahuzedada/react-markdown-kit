/**
 * The three `EditorBlockAdapter`s: how a break, a marker and a directive
 * become the plugin's Lexical nodes and how they go back to mdast.
 *
 * The break adapter claims `thematicBreak`, which the editor package would
 * otherwise map to its own unlabelled rule node; a block adapter is consulted
 * before the built-in mapping, so every break in a deck opens as a
 * `SlideBreakNode`. An imported break exports as the `thematicBreak` it came
 * from with its bytes: the writer's canonical key for a thematic break
 * ignores those bytes, so an untouched break aligns with its original and is
 * written from the source. A fresh break has no bytes and exports as the
 * plugin's `slideBreak` node instead, whose key is its own spelling, so it
 * can never align with an original break of the other kind and take its
 * bytes (see slide-break-mdast.ts). Markers and directives hand back their
 * mdast node and bytes while untouched, and `raw: null` once edited, so the
 * plugin's toMarkdown handlers write them.
 */
import type { LexicalNode } from 'lexical'
import type { EditorBlockAdapter } from '@react-markdown-kit/editor/lexical'
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { breakSpelling, type BreakKind } from '../deck/breaks.js'
import { SLIDE_DIRECTIVE_NODE, type SlideDirectiveNode as SlideDirectiveMdastNode } from '../deck/directives.js'
import { SLIDE_MARKER_NODE, type SlideMarkerNode as SlideMarkerMdastNode } from '../deck/markers.js'
import { $createImportedSlideBreakNode, $isSlideBreakNode, type SlideBreakNode } from './slide-break-node.js'
import { breakSpellingOf, freshBreak, thematicBreak } from './slide-break-mdast.js'
import { $createImportedSlideMarkerNode, $isSlideMarkerNode, type SlideMarkerNode } from './slide-marker-node.js'
import { $createImportedSlideDirectiveNode, $isSlideDirectiveNode, type SlideDirectiveNode } from './slide-directive-node.js'

/** Only dashes split slides; `***` and `___` are rules inside one. */
function kindOfSpelling(spelling: string): BreakKind {
  return /^[-\s]+$/.test(spelling) ? 'slide' : 'rule'
}

export const slideBreakAdapter: EditorBlockAdapter = {
  type: 'thematicBreak',

  $import(node: MarkdownNode, source: string): LexicalNode {
    // With the block's bytes the spelling decides; without them the
    // transform's `data.rmkSlides` annotation does, and failing that a break
    // is a slide break.
    const kind = source === '' ? breakSpelling(node) : kindOfSpelling(source)
    return $createImportedSlideBreakNode(kind, source === '' ? null : source)
  },

  matches: $isSlideBreakNode,

  $export(node: LexicalNode) {
    const breakNode = node as SlideBreakNode
    const kind = breakNode.getKind()
    const source = breakNode.getSource()
    if (source === null) return { node: freshBreak(kind), raw: breakSpellingOf(kind) }
    return { node: thematicBreak(kind), raw: source }
  },
}

export const slideMarkerAdapter: EditorBlockAdapter = {
  type: SLIDE_MARKER_NODE,

  $import(node: MarkdownNode, source: string): LexicalNode {
    return $createImportedSlideMarkerNode(node as SlideMarkerMdastNode, source === '' ? null : source)
  },

  matches: $isSlideMarkerNode,

  $export(node: LexicalNode) {
    const marker = node as SlideMarkerNode
    const origin = marker.getOrigin()
    if (origin !== null) return { node: origin, raw: marker.getSource() }
    const fresh: SlideMarkerMdastNode = { type: SLIDE_MARKER_NODE, kind: marker.getKind() }
    return { node: fresh, raw: null }
  },
}

export const slideDirectiveAdapter: EditorBlockAdapter = {
  type: SLIDE_DIRECTIVE_NODE,

  $import(node: MarkdownNode, source: string): LexicalNode {
    return $createImportedSlideDirectiveNode(node as SlideDirectiveMdastNode, source === '' ? null : source)
  },

  matches: $isSlideDirectiveNode,

  $export(node: LexicalNode) {
    const directive = node as SlideDirectiveNode
    const origin = directive.getOrigin()
    if (origin !== null) return { node: origin, raw: directive.getSource() }
    const edited: SlideDirectiveMdastNode = {
      type: SLIDE_DIRECTIVE_NODE,
      key: directive.getDirectiveKey(),
      argument: directive.getArgument(),
    }
    return { node: edited, raw: null }
  },
}
