import { describe, expect, it } from 'vitest'
import { compileMarkdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { readDeck } from '../src/deck/read-deck.js'
import { slides } from '../src/index.js'
import { duplicateSlide, insertSlide, moveSlide, moveBlock, readSlot, removeSlide, setSlideLayout, writeSlot } from '../src/canvas/edits.js'
import { outlineDeck } from '../src/canvas/outline.js'

const preset = defineMarkdownPreset({ extensions: [slides()] })

const DECK = `---
title: Review
---

<!-- layout: cover -->

# Welcome

Hello.

???

Say hi.

---

## Plan

- one
- two

---

---

## Last
`

function outline(source: string) {
  return outlineDeck(compileMarkdown(source, { preset }).tree, source)
}

describe('outlineDeck', () => {
  it('finds each slide after the front matter, with its body and notes', () => {
    const deck = outline(DECK)
    expect(deck.slides).toHaveLength(4)
    expect(readSlot(DECK, deck.slides[0]!.body)).toBe('# Welcome\n\nHello.')
    expect(readSlot(DECK, deck.slides[0]!.notes)).toBe('Say hi.')
    expect(readSlot(DECK, deck.slides[1]!.body)).toBe('## Plan\n\n- one\n- two')
    expect(readSlot(DECK, deck.slides[2]!.body)).toBe('')
    expect(DECK.slice(0, deck.head)).toBe('---\ntitle: Review\n---')
  })

  it('skips a document-leading break', () => {
    const source = '---\n\n# Only\n'
    const deck = outline(source)
    expect(deck.slides).toHaveLength(1)
    expect(readSlot(source, deck.slides[0]!.body)).toBe('# Only')
  })
})

describe('writeSlot', () => {
  it('splices the body and keeps the directive and the notes byte for byte', () => {
    const deck = outline(DECK)
    const { value } = writeSlot(DECK, deck.slides[0]!.body, '# Welcome back\n\nHello.\n')
    expect(value).toBe(DECK.replace('# Welcome\n', '# Welcome back\n'))
  })

  it('reuses the span it returns, so consecutive writes land in the same place', () => {
    const deck = outline(DECK)
    const first = writeSlot(DECK, deck.slides[1]!.body, '## Plan A')
    const second = writeSlot(first.value, first.slot, '## Plan AB')
    expect(second.value).toContain('---\n\n## Plan AB\n\n---')
  })

  it('writes the body of an empty slide after a blank line', () => {
    const deck = outline(DECK)
    const { value } = writeSlot(DECK, deck.slides[2]!.body, '## Middle')
    expect(value).toContain('---\n\n## Middle\n\n---\n\n## Last')
  })

  it('adds the notes marker to a slide without notes', () => {
    const deck = outline(DECK)
    const { value } = writeSlot(DECK, deck.slides[1]!.notes, 'Two points.')
    expect(value).toContain('- two\n\n???\n\nTwo points.\n\n---')
    expect(outline(value).slides).toHaveLength(4)
  })
})

describe('structural edits', () => {
  it('inserts, duplicates, moves and removes slides and keeps the front matter', () => {
    const deck = outline(DECK)
    const inserted = insertSlide(DECK, deck, 0, '## New')
    expect(outline(inserted).slides.map((slide) => readSlot(inserted, slide.body).split('\n')[0])).toEqual(['# Welcome', '## New', '## Plan', '', '## Last'])
    expect(inserted.startsWith('---\ntitle: Review\n---\n\n<!-- layout: cover -->')).toBe(true)

    const duplicated = duplicateSlide(DECK, deck, 1)
    expect(duplicated.match(/## Plan/g)).toHaveLength(2)

    const moved = moveSlide(DECK, deck, 3, 0)
    expect(readSlot(moved, outline(moved).slides[0]!.body)).toBe('## Last')

    const removed = removeSlide(DECK, deck, 0)
    expect(removed).not.toContain('Welcome')
    expect(outline(removed).slides).toHaveLength(3)
  })

  it('removes the last slide down to the front matter', () => {
    const source = '---\ntitle: X\n---\n\n# One\n'
    expect(removeSlide(source, outline(source), 0)).toBe('---\ntitle: X\n---\n')
  })
})


describe('canvas and renderer agreement', () => {
  it.each(['', '---\n', '---\n\n---\n', '---\n\n---\n\n# One', '# One\n\n---\n', '---\ntitle: Deck\n---\n\n---\n\n# One'])('uses the renderer slide count for %j', (source) => {
    const document = compileMarkdown(source, { preset })
    expect(outline(source).slides).toHaveLength(readDeck(document.tree, source).slides.length)
  })

  it('patches a layout without rewriting code examples, notes, or another slide', () => {
    const source = '<!-- layout: cover -->\n\n# Intro\n\n```md\n<!-- layout: cover -->\n```\n\n???\n\n<!-- layout: cover -->\n\n---\n\n<!-- layout: cover -->\n\n# End\n'
    const edited = setSlideLayout(source, outline(source), 0, 'center')
    expect(edited).toBe(source.replace('layout: cover', 'layout: center'))
  })

  it('inserts a local layout over a deck default and keeps the original content', () => {
    const source = '---\nlayout: cover\n---\n\n# Intro\n'
    const edited = setSlideLayout(source, outline(source), 0, 'default')
    const deck = readDeck(compileMarkdown(edited, { preset }).tree, edited)
    expect(deck.slides[0]?.layout).toBe('default')
    expect(edited).toContain('# Intro\n')
    expect(edited).toContain('layout: cover')
  })
})


describe('column source ranges', () => {
  it('edits either column without changing the marker, notes, or the other column', () => {
    const source = '<!-- layout: two-cols -->\n\n# Left\n\nKeep **this**.\n\n::right::\n\n# Right\n\nChange me.\n\n???\n\nNotes stay.\n'
    const columns = outline(source).slides[0]!.columns!
    expect(readSlot(source, columns[0])).toBe('# Left\n\nKeep **this**.')
    expect(readSlot(source, columns[1])).toBe('# Right\n\nChange me.')
    expect(writeSlot(source, columns[1], '# Right\n\nChanged.').value).toBe(source.replace('Change me.', 'Changed.'))
  })

  it('does not split at a column marker inside a fenced example or notes', () => {
    const source = '# One\n\n```md\n::right::\n```\n\n???\n\n::right::\n'
    expect(outline(source).slides[0]!.columns).toBeUndefined()
  })
})


it('creates a real second column when choosing the two-column layout', () => {
  const source = '# Intro\n\nLeft content.\n\n???\n\nNotes.\n'
  const edited = setSlideLayout(source, outline(source), 0, 'two-cols')
  const deck = readDeck(compileMarkdown(edited, { preset }).tree, edited)
  expect(deck.slides[0]?.columns).toBe(2)
  expect(readSlot(edited, outline(edited).slides[0]!.notes)).toBe('Notes.')
  expect(readSlot(edited, outline(edited).slides[0]!.columns![0])).toBe('# Intro\n\nLeft content.')
  expect(setSlideLayout(edited, outline(edited), 0, 'two-cols')).toBe(edited)
})


describe('moveBlock', () => {
  it('moves content across column and fragment slots without rewriting syntax or notes', () => {
    const source = '<!-- layout: two-cols -->\r\n\r\n# Heading\r\n\r\nLeft.\r\n\r\n::right::\r\n\r\n```js\r\nconst x = 1\r\n```\r\n\r\n--\r\n\r\nRight.\r\n\r\n???\r\n\r\nPrivate notes.\r\n'
    const moved = moveBlock(source, outline(source), 0, 1, 3)
    expect(moved).toBe(source.replace('Left.\r\n\r\n', '').replace('Right.', 'Right.\r\n\r\nLeft.'))
    const model = readDeck(compileMarkdown(moved, { preset }).tree, moved)
    expect(model.slides[0]!.blocks.map((block) => block.column)).toEqual([0, 1, 1, 1])
  })

  it('ignores invalid moves and preserves unrelated slides and front matter', () => {
    const deck = outline(DECK)
    expect(moveBlock(DECK, deck, 0, 0, -1)).toBe(DECK)
    expect(moveBlock(DECK, deck, 0, 0, 99)).toBe(DECK)
    expect(moveBlock(DECK, deck, 99, 0, 1)).toBe(DECK)
    expect(moveBlock(DECK, deck, 0, 0, 1)).toBe(DECK.replace('# Welcome\n\nHello.', 'Hello.\n\n# Welcome'))
  })
})
