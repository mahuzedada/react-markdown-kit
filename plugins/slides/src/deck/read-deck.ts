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
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import type { MarkdownDiagnostic, SourceRange } from '@internal/diagnostics/index.js'
import { breakSpelling } from './breaks.js'
import { classTokens, isDirectiveKey, readDirective, type DirectiveKey } from './directives.js'
import { isFrontMatter, parseFrontMatter } from './front-matter.js'
import { markerKind, paragraphText } from './markers.js'
import { headingText, isHeading } from './title.js'
import type { DeckModel, SlideModel } from './model.js'
import { slidesDiagnostic } from './diagnostics.js'

/** Deck-level properties, all from the front matter. */
interface DeckProperties {
  readonly title?: string
  readonly aspect?: DeckModel['aspect']
  readonly class: readonly string[]
  readonly background?: string
}

interface SlideDraft {
  name: string | undefined
  /** The `name` directive's range, where a duplicate is reported. */
  nameRange: SourceRange | undefined
  background: string | undefined
  classes: string[]
  groups: MarkdownNode[][]
  notes: MarkdownNode[]
  inNotes: boolean
  first: SourceRange | undefined
  last: SourceRange | undefined
  opener: SourceRange | undefined
  contentSeen: number
}

export function readDeck(root: MarkdownRoot, source?: string): DeckModel {
  const diagnostics: MarkdownDiagnostic[] = []
  const drafts: SlideDraft[] = []
  let current: SlideDraft | undefined
  let frontMatter: DeckProperties = { class: [] }

  const children = root.children
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index]!

    if (index === 0 && node.type === 'yaml') {
      const value = typeof node.value === 'string' ? node.value : ''
      if (isFrontMatter(value)) {
        const matter = parseFrontMatter(value)
        frontMatter = {
          ...(matter.title === undefined ? {} : { title: matter.title }),
          ...(matter.aspect === undefined ? {} : { aspect: matter.aspect }),
          class: matter.class === undefined ? [] : (classTokens(matter.class) ?? []),
          ...(matter.background === undefined ? {} : { background: matter.background }),
        }
        if (matter.class !== undefined && classTokens(matter.class) === undefined) {
          diagnostics.push(slidesDiagnostic('SLIDES_DIRECTIVE_INVALID', node.position, 'Front matter `class` must be class names separated by spaces or commas.'))
        }
        for (const problem of matter.problems) diagnostics.push(slidesDiagnostic('SLIDES_DIRECTIVE_INVALID', node.position, problem))
      }
      // The transform only lifts `key: value` lines; any other yaml came from
      // another parser and has nothing to render.
      continue
    }

    if (node.type === 'thematicBreak' && breakSpelling(node, source) === 'slide') {
      // A document-leading break opens nothing; every other break closes a
      // slide and opens the next, even when that next one stays empty.
      if (current === undefined) continue
      drafts.push(current)
      current = newDraft(node.position)
      continue
    }

    current ??= newDraft(undefined)
    current.first ??= node.position
    current.last = node.position ?? current.last

    const directive = readDirective(node)
    if (directive !== undefined) {
      applyDirective(current, directive, node.position)
      continue
    }

    const marker = markerKind(node)
    if (marker === 'notes') {
      if (current.inNotes) diagnostics.push(slidesDiagnostic('SLIDES_MARKER_MISPLACED', node.position))
      current.inNotes = true
      continue
    }
    if (marker === 'pause') {
      if (current.inNotes) diagnostics.push(slidesDiagnostic('SLIDES_MARKER_MISPLACED', node.position))
      else current.groups.push([])
      continue
    }

    if (current.contentSeen === 0 && !current.inNotes && isBareProperties(node)) {
      diagnostics.push(slidesDiagnostic('SLIDES_PROPERTY_BARE', node.position))
    }
    current.contentSeen += 1
    if (current.inNotes) current.notes.push(node)
    else current.groups[current.groups.length - 1]!.push(node)
  }
  if (current !== undefined) drafts.push(current)

  const names = new Set<string>()
  const slides: SlideModel[] = drafts.map((draft, index) => {
    let name = draft.name
    if (name !== undefined) {
      if (names.has(name)) {
        diagnostics.push(slidesDiagnostic('SLIDES_NAME_DUPLICATE', draft.nameRange ?? draft.first ?? draft.opener))
        name = undefined
      } else {
        names.add(name)
      }
    }
    const heading = draft.groups.flat().find(isHeading)
    const title = heading === undefined ? undefined : headingText(heading)
    const empty = draft.contentSeen === 0
    if (empty) diagnostics.push(slidesDiagnostic('SLIDES_SLIDE_EMPTY', draft.opener ?? draft.first))
    const position = span(draft.first, draft.last) ?? draft.opener
    const background = draft.background ?? frontMatter.background
    return {
      index,
      ...(name === undefined ? {} : { name }),
      ...(title === undefined || title === '' ? {} : { title }),
      classes: [...frontMatter.class, ...draft.classes],
      ...(background === undefined ? {} : { background }),
      groups: draft.groups,
      notes: draft.notes,
      empty,
      ...(position === undefined ? {} : { position }),
    }
  })

  const title = frontMatter.title ?? slides[0]?.title
  return {
    ...(title === undefined ? {} : { title }),
    ...(frontMatter.aspect === undefined ? {} : { aspect: frontMatter.aspect }),
    class: frontMatter.class,
    ...(frontMatter.background === undefined ? {} : { background: frontMatter.background }),
    slides,
    diagnostics,
  }
}

function newDraft(opener: SourceRange | undefined): SlideDraft {
  return { name: undefined, nameRange: undefined, background: undefined, classes: [], groups: [[]], notes: [], inNotes: false, first: undefined, last: undefined, opener, contentSeen: 0 }
}

function applyDirective(draft: SlideDraft, directive: { key: DirectiveKey; argument: string }, range: SourceRange | undefined): void {
  switch (directive.key) {
    case 'class':
      draft.classes.push(...(classTokens(directive.argument) ?? []))
      return
    case 'background':
      draft.background = directive.argument
      return
    case 'name':
      draft.name = directive.argument
      draft.nameRange = range
      return
  }
}

/** remark's `class: center, middle` lines: every line of the paragraph is `known-key: value`. */
function isBareProperties(node: MarkdownNode): boolean {
  const text = paragraphText(node)
  if (text === undefined) return false
  const lines = text.split('\n')
  return lines.every((line) => {
    const match = /^([a-z][\w-]*)\s*:\s*\S/i.exec(line)
    return match !== null && isDirectiveKey(match[1]!.toLowerCase())
  })
}

function span(first: SourceRange | undefined, last: SourceRange | undefined): SourceRange | undefined {
  if (first === undefined) return undefined
  return { start: first.start, end: (last ?? first).end }
}
