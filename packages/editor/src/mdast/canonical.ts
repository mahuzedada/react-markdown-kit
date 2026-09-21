/**
 * Canonical block keys — how the writer decides a block is unchanged.
 *
 * A block imported into Lexical and read straight back out produces mdast that
 * is *semantically* identical but not structurally identical (text runs split
 * differently, marks nest in the bridge's order, optional fields appear as
 * `null` rather than absent). Comparing canonical keys instead of raw trees is
 * what lets `composeMarkdown` hand back the original bytes for every block the
 * user did not touch, which is the whole of docs/AUDIT.md G4.
 *
 * `position` is deliberately excluded: offsets shift when a neighbour changes,
 * and a block's identity is its content.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import { mdastToAtoms, type InlineAtom, type RawResolver } from './atoms.js'

export interface BlockWithSource {
  readonly node: MarkdownNode
  /** Verbatim source for a block the bridge does not model. */
  readonly raw?: string | null
}

export function canonicalBlock(block: BlockWithSource, raw: RawResolver): string {
  return JSON.stringify(canonicalOf(block.node, block.raw ?? null, raw))
}

function canonicalOf(node: MarkdownNode, explicitRaw: string | null, raw: RawResolver): unknown {
  const inline = (): readonly unknown[] => canonicalAtoms(mdastToAtoms(node.children, raw))
  const blocks = (): readonly unknown[] =>
    (node.children ?? []).map((child) => canonicalOf(child, null, raw))

  switch (node.type) {
    case 'paragraph':
      return ['paragraph', inline()]
    case 'heading':
      return ['heading', node['depth'] ?? 1, inline()]
    case 'blockquote':
      return ['blockquote', blocks()]
    case 'list':
      return [
        'list',
        node['ordered'] === true,
        node['ordered'] === true ? (node['start'] ?? 1) : null,
        node['spread'] === true,
        blocks(),
      ]
    case 'listItem':
      return ['listItem', node['checked'] ?? null, node['spread'] === true, blocks()]
    case 'code':
      return ['code', node['lang'] ?? null, node['meta'] ?? null, node['value'] ?? '']
    case 'thematicBreak':
      return ['thematicBreak']
    case 'table':
      return ['table', node['align'] ?? [], blocks()]
    case 'tableRow':
      return ['tableRow', blocks()]
    case 'tableCell':
      return ['tableCell', inline()]
    default:
      // Opaque: identity is the exact source, never the parsed shape.
      return ['opaque', node.type, explicitRaw ?? raw(node)]
  }
}

function canonicalAtoms(atoms: readonly InlineAtom[]): readonly unknown[] {
  return atoms.map((atom) => {
    switch (atom.kind) {
      case 'text':
        return ['t', atom.value, atom.marks]
      case 'break':
        return ['br']
      case 'link':
        return ['a', atom.url, atom.title, canonicalAtoms(atom.children)]
      case 'linkReference':
        return ['aref', atom.identifier, atom.label, atom.referenceType, canonicalAtoms(atom.children)]
      case 'image':
        return ['img', atom.url, atom.alt, atom.title]
      case 'imageReference':
        return ['imgref', atom.identifier, atom.label, atom.referenceType, atom.alt]
      case 'opaque':
        return ['opaque', atom.nodeType, atom.source]
    }
  })
}
