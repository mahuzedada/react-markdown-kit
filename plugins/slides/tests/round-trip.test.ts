import { describe, expect, it } from 'vitest'
import { compileMarkdown, documentToMarkdown } from '@react-markdown-kit/renderer'
import { createMarkdownBridge } from '@react-markdown-kit/editor'
import { slides } from '../src/index.js'

const preset = { extensions: [slides()] }

const DECK = `---
title: Q3 review
aspect: 4:3
---

<!-- name: intro -->
<!-- class: center, middle -->

# Welcome

Hello _there_, **friend**.

***

- a
- b

--

After the pause.

???

Say this.

---

<!-- background: https://example.com/bg.jpg -->

## Numbers

\`\`\`js
const x = 1
\`\`\`

---

## Close
`

describe('slides(): round trip', () => {
  it('documentToMarkdown writes a deck back byte for byte', async () => {
    const document = compileMarkdown(DECK, preset)
    expect(document.diagnostics).toEqual([])
    expect(await documentToMarkdown(document, preset)).toBe(DECK)
  })

  it('writes a deck that opens with a break back byte for byte', async () => {
    const source = '---\n\n# One\n\n- a\n- b\n\n---\n\n# Two\n'
    const document = compileMarkdown(source, preset)
    expect(document.tree.children[0]!.type).toBe('thematicBreak')
    expect(await documentToMarkdown(document, preset)).toBe(source)
  })

  it('writes a leading break followed by a fenced --- back as one slide, byte for byte', async () => {
    const source = '---\n\n```\n---\n```\n\n# Two\n'
    const document = compileMarkdown(source, preset)
    expect(document.tree.children.map((node) => node.type)).toEqual(['thematicBreak', 'code', 'heading'])
    expect(await documentToMarkdown(document, preset)).toBe(source)
    const bridge = createMarkdownBridge({ extensions: [slides()], headless: true })
    expect(bridge.load(source)).toEqual([])
    expect(bridge.getMarkdown()).toBe(source)
  })

  it('writes front matter with blank lines and a trailing-space fence back through the yaml node', async () => {
    const source = '---\ntitle: x\n\naspect: 4:3\n---\n\n# One\n'
    const document = compileMarkdown(source, preset)
    expect(document.tree.children[0]!.type).toBe('yaml')
    expect(await documentToMarkdown(document, preset)).toBe(source)
    const bridge = createMarkdownBridge({ extensions: [slides()], headless: true })
    expect(bridge.load(source)).toEqual([])
    expect(bridge.getMarkdown()).toBe(source)
  })

  it('the editor bridge writes a deck that opens with a break back byte for byte, without adapters', () => {
    const source = '---\n\n# One\n\n- a\n- b\n\n---\n\n<!-- class: center -->\n\n# Two\n\n--\n\ntext\n'
    const bridge = createMarkdownBridge({ extensions: [slides()], headless: true })
    expect(bridge.load(source)).toEqual([])
    expect(bridge.getMarkdown()).toBe(source)
    expect(bridge.getDocument().tree.children[0]!.type).toBe('thematicBreak')
  })

  it('writes a fresh slideMarker as -- and ???, never \\--', async () => {
    const document = compileMarkdown('# One\n', preset)
    const tree = {
      ...document.tree,
      children: [
        ...document.tree.children,
        { type: 'slideMarker', kind: 'pause' },
        { type: 'paragraph', children: [{ type: 'text', value: 'two' }] },
        { type: 'slideMarker', kind: 'notes' },
        { type: 'slideDirective', key: 'class', argument: 'center' },
      ],
    }
    expect(await documentToMarkdown({ ...document, tree }, preset)).toBe('# One\n\n--\n\ntwo\n\n???\n\n<!-- class: center -->\n')
  })

  it('a paragraph holding -- (the un-lifted shape) still escapes, which is why the marker is a node', async () => {
    const document = compileMarkdown('# One\n\n--\n')
    expect(await documentToMarkdown(document)).toBe('# One\n\n\\--\n')
  })

  it('a rule written as *** stays a rule after serialization', async () => {
    const document = compileMarkdown('# One\n\n***\n\n---\n\n# Two\n', preset)
    const out = await documentToMarkdown(document, preset)
    expect(out).toBe('# One\n\n***\n\n---\n\n# Two\n')
    expect(compileMarkdown(out, preset).diagnostics).toEqual([])
  })
})
