import { describe, expect, it } from 'vitest'
import { compileMarkdown, gfm } from '@react-markdown-kit/renderer'
import { readDeck } from '../src/deck/read-deck.js'
import { slides, isSlideDirectiveNode, isSlideMarkerNode } from '../src/index.js'
import type { MarkdownNode } from '@internal/document-contracts/index.js'

const preset = { extensions: [slides()] }

function deck(source: string) {
  const document = compileMarkdown(source, preset)
  return { document, deck: readDeck(document.tree, source) }
}

function types(nodes: readonly MarkdownNode[]): string[] {
  return nodes.map((node) => node.type)
}

describe('readDeck: slide breaks', () => {
  it('splits on --- between blank lines', () => {
    const { deck: model } = deck('# One\n\n---\n\n# Two\n\n---\n\n# Three\n')
    expect(model.slides.map((slide) => slide.title)).toEqual(['One', 'Two', 'Three'])
    expect(model.slides.map((slide) => slide.index)).toEqual([0, 1, 2])
  })

  it('treats *** and ___ as rules inside the slide', () => {
    const { deck: model, document } = deck('# One\n\n***\n\nmore\n\n___\n\n---\n\n# Two\n')
    expect(model.slides).toHaveLength(2)
    expect(types(model.slides[0]!.groups[0]!)).toEqual(['heading', 'thematicBreak', 'paragraph', 'thematicBreak'])
    const rule = document.tree.children[1] as MarkdownNode & { data?: { rmkSlides?: { rule?: boolean } } }
    expect(rule.data?.rmkSlides?.rule).toBe(true)
  })

  it('honours the rule annotation when no source is given', () => {
    const { document } = deck('# One\n\n***\n\n---\n\n# Two\n')
    const model = readDeck(document.tree)
    expect(model.slides).toHaveLength(2)
    expect(types(model.slides[0]!.groups[0]!)).toEqual(['heading', 'thematicBreak'])
  })

  it('never splits on a --- inside a fence, a quote or a list', () => {
    const { deck: model } = deck('# One\n\n```\n---\n```\n\n> ---\n\n- item\n\n  ---\n')
    expect(model.slides).toHaveLength(1)
  })

  it('opens no slide for a document-leading break', () => {
    const { deck: model } = deck('---\n\n# One\n')
    expect(model.slides).toHaveLength(1)
    expect(model.slides[0]!.title).toBe('One')
  })

  it('keeps an empty slide between two breaks and a trailing one', () => {
    const { deck: model } = deck('# One\n\n---\n\n---\n\n# Three\n\n---\n')
    expect(model.slides.map((slide) => slide.empty)).toEqual([false, true, false, true])
    expect(model.slides[1]!.position).toBeDefined()
  })

  it('reads an empty document as a deck with no slides', () => {
    expect(deck('').deck.slides).toEqual([])
  })
})

describe('readDeck: front matter', () => {
  it('reads title, aspect, class and background as deck properties', () => {
    const { deck: model, document } = deck('---\ntitle: "Q3 review"\naspect: 4:3\nclass: inverse\nbackground: https://x/bg.png\n---\n\n# One\n\n---\n\n<!-- background: https://x/own.png -->\n\n# Two\n')
    expect(document.tree.children[0]!.type).toBe('yaml')
    expect(model.title).toBe('Q3 review')
    expect(model.aspect).toBe('4:3')
    expect(model.class).toEqual(['inverse'])
    expect(model.background).toBe('https://x/bg.png')
    expect(model.slides[0]!.classes).toEqual(['inverse'])
    expect(model.slides[0]!.background).toBe('https://x/bg.png')
    expect(model.slides[1]!.background).toBe('https://x/own.png')
    expect(model.slides).toHaveLength(2)
  })

  it('falls back to the first slide title when front matter has none', () => {
    expect(deck('# Hello\n\n---\n\n# Two\n').deck.title).toBe('Hello')
    expect(deck('text\n').deck.title).toBeUndefined()
  })

  it('parses a deck that opens with a break as plain CommonMark, positions untouched', () => {
    const source = '---\n\n# One\n\n- a\n- b\n\n---\n\n# Two\n'
    const { document, deck: model } = deck(source)
    expect(types(document.tree.children)).toEqual(['thematicBreak', 'heading', 'list', 'thematicBreak', 'heading'])
    const spellings = document.tree.children.map((node) => source.slice(node.position!.start.offset, node.position!.end.offset))
    expect(spellings).toEqual(['---', '# One', '- a\n- b', '---', '# Two'])
    expect(document.tree.children[1]!.position!.start.line).toBe(3)
    const item = document.tree.children[2]!.children![1]!
    expect(source.slice(item.position!.start.offset, item.position!.end.offset)).toBe('- b')
    expect(model.slides.map((slide) => slide.title)).toEqual(['One', 'Two'])
    expect(document.diagnostics).toEqual([])
  })

  it('keeps lists and quotes after a leading break that no later break follows', () => {
    const { document, deck: model } = deck('---\n\n# Title\n\n- point one\n- point two\n\n> a quote\n')
    expect(types(document.tree.children)).toEqual(['thematicBreak', 'heading', 'list', 'blockquote'])
    expect(model.slides).toHaveLength(1)
    expect(types(model.slides[0]!.groups[0]!)).toEqual(['heading', 'list', 'blockquote'])
    expect(document.diagnostics).toEqual([])
  })

  it('never splits on a --- inside a fence, an html block or a setext underline after a leading break', () => {
    const fenced = deck('---\n\n```\n---\n```\n\n# Two\n')
    expect(types(fenced.document.tree.children)).toEqual(['thematicBreak', 'code', 'heading'])
    expect(fenced.document.tree.children[1]!.value).toBe('---')
    expect(fenced.deck.slides).toHaveLength(1)

    const html = deck('---\n\n<div>\n---\n</div>\n\n# Two\n')
    expect(types(html.document.tree.children)).toEqual(['thematicBreak', 'html', 'heading'])
    expect(html.deck.slides).toHaveLength(1)

    const setext = deck('---\n\nText\n---\n\n# Two\n')
    expect(types(setext.document.tree.children)).toEqual(['thematicBreak', 'heading', 'heading'])
    expect(setext.document.tree.children[1]!.depth).toBe(2)
    expect(setext.deck.slides).toHaveLength(1)
    expect(setext.document.diagnostics.map((d) => d.code)).toEqual(['SLIDES_SETEXT_HEADING'])
  })

  it('reads a deck that opens with a break, with the sibling extensions in play', () => {
    const source = '---\n# One\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n---\n\n# Two\n'
    const document = compileMarkdown(source, { extensions: [gfm(), slides()] })
    expect(types(document.tree.children)).toEqual(['thematicBreak', 'heading', 'table', 'thematicBreak', 'heading'])
  })

  it('lifts the front matter into one yaml node spanning both fences', () => {
    const source = '---\ntitle: x\n\naspect: 4:3\n---  \n\n# One\n'
    const { document, deck: model } = deck(source)
    expect(types(document.tree.children)).toEqual(['yaml', 'heading'])
    const yaml = document.tree.children[0]!
    expect(yaml.value).toBe('title: x\n\naspect: 4:3')
    expect(yaml.position).toEqual({ start: { line: 1, column: 1, offset: 0 }, end: { line: 5, column: 6, offset: 31 } })
    expect(model.title).toBe('x')
    expect(model.aspect).toBe('4:3')
    expect(model.slides[0]!.title).toBe('One')
  })

  it('reads CRLF front matter and a deck with nothing after the closing fence', () => {
    expect(deck('---\r\ntitle: x\r\n---\r\n\r\n# One\r\n').deck.title).toBe('x')
    const { document, deck: model } = deck('---\ntitle: x\n---')
    expect(types(document.tree.children)).toEqual(['yaml'])
    expect(model.title).toBe('x')
    expect(model.slides).toHaveLength(0)
  })

  it('reads an unclosed or interrupted front matter as content', () => {
    const unclosed = deck('---\ntitle: x\n\n- a\n- b\n')
    expect(types(unclosed.document.tree.children)).toEqual(['thematicBreak', 'paragraph', 'list'])
    expect(unclosed.deck.title).toBeUndefined()
    const prose = deck('---\ntitle: x\nnot a key line\n---\n\n# One\n')
    expect(types(prose.document.tree.children)).toEqual(['thematicBreak', 'heading', 'heading'])
    expect(prose.deck.slides[0]!.title).toBe('title: x\nnot a key line')
  })

  it('reads an empty front matter block as no properties', () => {
    const { deck: model, document } = deck('---\n---\n\n# One\n')
    expect(document.tree.children[0]!.type).toBe('yaml')
    expect(model.title).toBe('One')
    expect(model.slides).toHaveLength(1)
  })
})

describe('readDeck: directives', () => {
  it('re-types valid directives and applies them, adjacent lines included', () => {
    const source = '<!-- name: intro -->\n<!-- class: center, middle -->\n<!-- class: inverse -->\n<!-- background: https://x/bg.png -->\n\n# One\n'
    const { document, deck: model } = deck(source)
    expect(document.tree.children.filter(isSlideDirectiveNode)).toHaveLength(4)
    const slide = model.slides[0]!
    expect(slide.name).toBe('intro')
    expect(slide.classes).toEqual(['center', 'middle', 'inverse'])
    expect(slide.background).toBe('https://x/bg.png')
    expect(types(slide.groups[0]!)).toEqual(['heading'])
  })

  it('leaves an unknown or invalid directive as html content', () => {
    const { document, deck: model } = deck('<!-- foo: bar -->\n\n<!-- name: not ok -->\n\n# One\n')
    expect(types(document.tree.children)).toEqual(['html', 'html', 'heading'])
    expect(types(model.slides[0]!.groups[0]!)).toEqual(['html', 'html', 'heading'])
    expect(model.slides[0]!.name).toBeUndefined()
  })

  it('recognises a directive with trailing whitespace or up to three spaces of indentation', () => {
    const { document, deck: model } = deck('<!-- class: center -->  \n<!-- name: a -->\t\n   <!-- background: https://x/bg.png -->\n\n# One\n')
    expect(types(document.tree.children)).toEqual(['slideDirective', 'slideDirective', 'slideDirective', 'heading'])
    expect(model.slides[0]!.classes).toEqual(['center'])
    expect(model.slides[0]!.name).toBe('a')
    expect(model.slides[0]!.background).toBe('https://x/bg.png')
    expect(document.diagnostics).toEqual([])
  })

  it('is not a directive when text follows the comment', () => {
    const { document } = deck('<!-- class: center --> text\n')
    expect(document.tree.children[0]!.type).toBe('html')
    expect(document.diagnostics).toEqual([])
  })

  it('reads the raw html shape too, for a document compiled without the extension', () => {
    const document = compileMarkdown('<!-- name: intro -->\n\n# One\n\n---\n\n--\n\n# Two\n')
    const model = readDeck(document.tree, document.source)
    expect(model.slides[0]!.name).toBe('intro')
    expect(model.slides[1]!.groups).toHaveLength(2)
  })

  it('drops the id of a later slide with a duplicate name', () => {
    const { deck: model } = deck('<!-- name: a -->\n\n# One\n\n---\n\n<!-- name: a -->\n\n# Two\n')
    expect(model.slides.map((slide) => slide.name)).toEqual(['a', undefined])
  })
})

describe('readDeck: markers', () => {
  it('groups fragments after each -- and notes after ???', () => {
    const source = '# One\n\nintro\n\n--\n\nfirst\n\n--\n\nsecond\n\n???\n\nsay this\n\nand this\n'
    const { document, deck: model } = deck(source)
    expect(document.tree.children.filter(isSlideMarkerNode).map((node) => node.kind)).toEqual(['pause', 'pause', 'notes'])
    const slide = model.slides[0]!
    expect(slide.groups.map(types)).toEqual([['heading', 'paragraph'], ['paragraph'], ['paragraph']])
    expect(types(slide.notes)).toEqual(['paragraph', 'paragraph'])
    expect(slide.empty).toBe(false)
  })

  it('ignores a -- after ??? and a second ???', () => {
    const { deck: model } = deck('# One\n\n???\n\nnotes\n\n--\n\nmore notes\n\n???\n\nstill notes\n')
    const slide = model.slides[0]!
    expect(slide.groups).toHaveLength(1)
    expect(types(slide.notes)).toEqual(['paragraph', 'paragraph', 'paragraph'])
  })
})

describe('readDeck: titles', () => {
  it('uses the first heading, with inline code, and no title when there is none', () => {
    const { deck: model } = deck('text first\n\n## The `API` **plan**\n\n---\n\njust text\n')
    expect(model.slides[0]!.title).toBe('The API plan')
    expect(model.slides[1]!.title).toBeUndefined()
  })
})
