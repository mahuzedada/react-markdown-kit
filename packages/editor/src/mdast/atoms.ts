/**
 * The inline atom model — the editor's canonical form for phrasing content.
 *
 * mdast nests marks (`strong > emphasis > text`) while Lexical flattens them
 * onto a text run (`bold | italic`). Converting both sides to the same flat
 * "atom" list is what makes an unedited block compare **equal** after a full
 * import/export cycle, which is what lets the writer hand back the original
 * source bytes (docs/AUDIT.md G4).
 *
 * Marks are carried as a sorted set so `_**a**_` and `**_a_**` canonicalise
 * identically; nesting order only matters when a block is actually re-written.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'

export type InlineMark = 'delete' | 'strong' | 'emphasis' | 'code'

/** Outermost first. `code` is not here: it lives on the text leaf itself. */
export const MARK_NESTING: readonly InlineMark[] = ['delete', 'strong', 'emphasis']

const MARK_BY_NODE_TYPE: Readonly<Record<string, InlineMark>> = {
  strong: 'strong',
  emphasis: 'emphasis',
  delete: 'delete',
}

export type ReferenceType = 'shortcut' | 'collapsed' | 'full'

export type InlineAtom =
  | { readonly kind: 'text'; readonly value: string; readonly marks: readonly InlineMark[] }
  | { readonly kind: 'break'; readonly marks: readonly InlineMark[] }
  | {
      readonly kind: 'link'
      readonly url: string
      readonly title: string | null
      readonly children: readonly InlineAtom[]
    }
  | {
      readonly kind: 'linkReference'
      readonly identifier: string
      readonly label: string | null
      readonly referenceType: ReferenceType
      readonly children: readonly InlineAtom[]
    }
  | {
      readonly kind: 'image'
      readonly url: string
      readonly alt: string | null
      readonly title: string | null
    }
  | {
      readonly kind: 'imageReference'
      readonly identifier: string
      readonly label: string | null
      readonly referenceType: ReferenceType
      readonly alt: string | null
    }
  /** Anything with no inline mapping: inline HTML, a footnote reference, a
   * third-party extension's node. Keeps its mdast subtree and source slice. */
  | {
      readonly kind: 'opaque'
      readonly nodeType: string
      readonly source: string
      readonly mdast: MarkdownNode
    }

export type RawResolver = (node: MarkdownNode) => string

/** Recovers the exact source for a node the bridge does not model. */
export function rawResolverFor(source: string | undefined): RawResolver {
  return (node) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (source !== undefined && typeof start === 'number' && typeof end === 'number') {
      return source.slice(start, end)
    }
    return typeof node['value'] === 'string' ? (node['value'] as string) : ''
  }
}

function sortMarks(marks: readonly InlineMark[]): readonly InlineMark[] {
  const order: InlineMark[] = ['delete', 'strong', 'emphasis', 'code']
  return [...new Set(marks)].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

function withMark(marks: readonly InlineMark[], mark: InlineMark): readonly InlineMark[] {
  return marks.includes(mark) ? marks : sortMarks([...marks, mark])
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function referenceTypeOf(value: unknown): ReferenceType {
  return value === 'collapsed' || value === 'full' || value === 'shortcut' ? value : 'shortcut'
}

/**
 * mdast phrasing content -> atoms.
 *
 * Marks on a container push **down** onto its descendants rather than staying
 * on a wrapper atom, so `**[a](u)**` and `[**a**](u)` produce the same atoms.
 */
export function mdastToAtoms(
  children: readonly MarkdownNode[] | undefined,
  raw: RawResolver,
): InlineAtom[] {
  const atoms: InlineAtom[] = []
  walk(children ?? [], [], atoms, raw)
  return mergeTextAtoms(atoms)
}

function walk(
  children: readonly MarkdownNode[],
  marks: readonly InlineMark[],
  out: InlineAtom[],
  raw: RawResolver,
): void {
  for (const node of children) {
    const mark = MARK_BY_NODE_TYPE[node.type]
    if (mark !== undefined) {
      walk(node.children ?? [], withMark(marks, mark), out, raw)
      continue
    }
    switch (node.type) {
      case 'text':
        out.push({ kind: 'text', value: String(node['value'] ?? ''), marks })
        break
      case 'inlineCode':
        out.push({ kind: 'text', value: String(node['value'] ?? ''), marks: withMark(marks, 'code') })
        break
      case 'break':
        out.push({ kind: 'break', marks })
        break
      case 'link': {
        const children_: InlineAtom[] = []
        walk(node.children ?? [], marks, children_, raw)
        out.push({
          kind: 'link',
          url: String(node['url'] ?? ''),
          title: stringOrNull(node['title']),
          children: mergeTextAtoms(children_),
        })
        break
      }
      case 'linkReference': {
        const children_: InlineAtom[] = []
        walk(node.children ?? [], marks, children_, raw)
        out.push({
          kind: 'linkReference',
          identifier: String(node['identifier'] ?? ''),
          label: stringOrNull(node['label']),
          referenceType: referenceTypeOf(node['referenceType']),
          children: mergeTextAtoms(children_),
        })
        break
      }
      case 'image':
        out.push({
          kind: 'image',
          url: String(node['url'] ?? ''),
          alt: stringOrNull(node['alt']),
          title: stringOrNull(node['title']),
        })
        break
      case 'imageReference':
        out.push({
          kind: 'imageReference',
          identifier: String(node['identifier'] ?? ''),
          label: stringOrNull(node['label']),
          referenceType: referenceTypeOf(node['referenceType']),
          alt: stringOrNull(node['alt']),
        })
        break
      default:
        out.push({ kind: 'opaque', nodeType: node.type, source: raw(node), mdast: node })
        break
    }
  }
}

/** Adjacent text with identical marks is one run, so splits never matter. */
export function mergeTextAtoms(atoms: readonly InlineAtom[]): InlineAtom[] {
  const out: InlineAtom[] = []
  for (const atom of atoms) {
    const previous = out[out.length - 1]
    if (
      atom.kind === 'text' &&
      previous !== undefined &&
      previous.kind === 'text' &&
      sameMarks(previous.marks, atom.marks)
    ) {
      out[out.length - 1] = { kind: 'text', value: previous.value + atom.value, marks: previous.marks }
      continue
    }
    if (atom.kind === 'text' && atom.value === '') continue
    out.push(atom)
  }
  return out
}

export function sameMarks(a: readonly InlineMark[], b: readonly InlineMark[]): boolean {
  return a.length === b.length && a.every((mark, index) => mark === b[index])
}

function marksOf(atom: InlineAtom): readonly InlineMark[] {
  return atom.kind === 'text' || atom.kind === 'break' ? atom.marks : []
}

/**
 * Atoms -> mdast phrasing content.
 *
 * Only runs for a block the user actually changed; an untouched block is
 * written back from its original bytes instead.
 */
export function atomsToMdast(atoms: readonly InlineAtom[]): MarkdownNode[] {
  return buildRun(shiftWhitespaceOutOfMarks(mergeTextAtoms(atoms)), [])
}

function buildRun(atoms: readonly InlineAtom[], applied: readonly InlineMark[]): MarkdownNode[] {
  const out: MarkdownNode[] = []
  let index = 0
  while (index < atoms.length) {
    const atom = atoms[index]
    if (atom === undefined) break
    const pending = MARK_NESTING.find(
      (mark) => marksOf(atom).includes(mark) && !applied.includes(mark),
    )
    if (pending === undefined) {
      out.push(leafOf(atom, applied))
      index += 1
      continue
    }
    let end = index
    while (end < atoms.length) {
      const candidate = atoms[end]
      if (candidate === undefined || !marksOf(candidate).includes(pending)) break
      end += 1
    }
    out.push({
      type: pending,
      children: buildRun(atoms.slice(index, end), [...applied, pending]),
    })
    index = end
  }
  return out
}

function leafOf(atom: InlineAtom, applied: readonly InlineMark[]): MarkdownNode {
  switch (atom.kind) {
    case 'text':
      return atom.marks.includes('code')
        ? { type: 'inlineCode', value: atom.value }
        : { type: 'text', value: atom.value }
    case 'break':
      return { type: 'break' }
    case 'link':
      return definedOnly({
        type: 'link',
        url: atom.url,
        title: atom.title,
        children: buildRun(shiftWhitespaceOutOfMarks(atom.children), applied),
      })
    case 'linkReference':
      return definedOnly({
        type: 'linkReference',
        identifier: atom.identifier,
        label: atom.label,
        referenceType: atom.referenceType,
        children: buildRun(shiftWhitespaceOutOfMarks(atom.children), applied),
      })
    case 'image':
      return definedOnly({ type: 'image', url: atom.url, title: atom.title, alt: atom.alt })
    case 'imageReference':
      return definedOnly({
        type: 'imageReference',
        identifier: atom.identifier,
        label: atom.label,
        referenceType: atom.referenceType,
        alt: atom.alt,
      })
    case 'opaque':
      return atom.mdast
  }
}

function definedOnly(value: Record<string, unknown>): MarkdownNode {
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== null && entry !== undefined) out[key] = entry
  }
  return out as unknown as MarkdownNode
}

/**
 * `strong[text "a "]` serialises to `**a **`, which CommonMark does not read
 * back as strong. Whitespace at a mark boundary moves outside the mark so a
 * re-written block stays stable on the next parse.
 */
function shiftWhitespaceOutOfMarks(atoms: readonly InlineAtom[]): InlineAtom[] {
  const out: InlineAtom[] = []
  for (const atom of atoms) {
    if (atom.kind !== 'text' || atom.marks.length === 0 || atom.marks.includes('code')) {
      out.push(atom)
      continue
    }
    const leading = /^\s*/.exec(atom.value)?.[0] ?? ''
    const trailing = atom.value.length > leading.length ? (/\s*$/.exec(atom.value)?.[0] ?? '') : ''
    const core = atom.value.slice(leading.length, atom.value.length - trailing.length)
    if (leading !== '') out.push({ kind: 'text', value: leading, marks: [] })
    if (core !== '') out.push({ kind: 'text', value: core, marks: atom.marks })
    if (trailing !== '') out.push({ kind: 'text', value: trailing, marks: [] })
  }
  return out
}
