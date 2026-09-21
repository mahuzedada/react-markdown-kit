/**
 * Bridge behaviour: the audit gaps that are properties of the document model
 * rather than of the DOM (G1, G2, G3, G5, G6, G11) plus the preservation
 * contract under a real edit (spec 7.9).
 */
import { describe, expect, it } from 'vitest'
import {
  $getRoot,
  $createTextNode,
  $isElementNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical'
import { createMarkdownBridge, serializeDocument } from '@react-markdown-kit/editor'
import {
  compileMarkdown,
  defineMarkdownPreset,
  documentToMarkdown,
  gfm,
} from '@react-markdown-kit/renderer'
import type { MarkdownNode } from '@internal/document-contracts/index.js'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

function open(source: string) {
  const bridge = createMarkdownBridge({ preset, headless: true })
  bridge.load(source)
  return bridge
}

/**
 * The documented escape hatch. Lexical is typed `unknown` on the public
 * surface, so reaching the engine is an explicit cast even here.
 */
function native(bridge: { getNativeEditor(): unknown }): LexicalEditor {
  return bridge.getNativeEditor() as LexicalEditor
}

function findNode(node: MarkdownNode, type: string): MarkdownNode | undefined {
  if (node.type === type) return node
  for (const child of node.children ?? []) {
    const found = findNode(child, type)
    if (found !== undefined) return found
  }
  return undefined
}

/** Appends text to the first block, the way a user typing at its end would. */
function appendToFirstBlock(bridge: ReturnType<typeof open>, text: string): void {
  native(bridge).update(
    () => {
      const first = $getRoot().getFirstChild()
      if (first !== null && $isElementNode(first)) first.append($createTextNode(text))
    },
    { discrete: true },
  )
}

describe('images (audit G1)', () => {
  it('parses an inline image into an image node, not a literal "!" plus a link', () => {
    const document = open('![alt](https://example.com/a.png)\n').getDocument()
    const image = findNode(document.tree, 'image')
    expect(image).toBeDefined()
    expect(image?.['url']).toBe('https://example.com/a.png')
    expect(image?.['alt']).toBe('alt')
    expect(findNode(document.tree, 'link')).toBeUndefined()
  })

  it('keeps an image title', () => {
    const document = open('![alt](https://example.com/a.png "Title")\n').getDocument()
    expect(findNode(document.tree, 'image')?.['title']).toBe('Title')
  })

  it('is in the default preset, with no configuration at all', () => {
    const bridge = createMarkdownBridge({ headless: true })
    bridge.load('![a](b.png)\n')
    expect(findNode(bridge.getDocument().tree, 'image')).toBeDefined()
    expect(bridge.getMarkdown()).toBe('![a](b.png)\n')
  })

  it('survives an edit to the paragraph holding it', () => {
    const bridge = open('Look: ![a](b.png)\n')
    appendToFirstBlock(bridge, ' done')
    expect(bridge.getMarkdown()).toBe('Look: ![a](b.png) done\n')
  })
})

describe('reference links and definitions (audit G2)', () => {
  it('parses a full reference link', () => {
    const document = open('See [text][ref].\n\n[ref]: https://example.com\n').getDocument()
    const reference = findNode(document.tree, 'linkReference')
    expect(reference).toBeDefined()
    expect(reference?.['identifier']).toBe('ref')
    expect(reference?.['referenceType']).toBe('full')
  })

  it('parses a reference image', () => {
    const document = open('![alt][img]\n\n[img]: https://example.com/a.png\n').getDocument()
    expect(findNode(document.tree, 'imageReference')?.['identifier']).toBe('img')
  })

  it('keeps the definition when the paragraph above it is edited', () => {
    const bridge = open('See [text][ref].\n\n[ref]: https://example.com\n')
    appendToFirstBlock(bridge, ' Now.')
    expect(bridge.getMarkdown()).toBe('See [text][ref]. Now.\n\n[ref]: https://example.com\n')
  })
})

describe('opaque nodes (audit G3)', () => {
  const source = 'Before.\n\n<div class="note">\n  <p>hi</p>\n</div>\n\nAfter.\n'

  it('preserves an HTML block byte-identically through an adjacent edit', () => {
    const bridge = open(source)
    appendToFirstBlock(bridge, ' Edited.')
    expect(bridge.getMarkdown()).toBe(
      'Before. Edited.\n\n<div class="note">\n  <p>hi</p>\n</div>\n\nAfter.\n',
    )
  })

  it('keeps the unsupported construct out of prose', () => {
    const document = open(source).getDocument()
    const paragraphs = (document.tree.children ?? []).filter((node) => node.type === 'paragraph')
    expect(paragraphs).toHaveLength(2)
    expect(JSON.stringify(paragraphs)).not.toContain('<div')
    expect(findNode(document.tree, 'html')).toBeDefined()
  })

  it('preserves a footnote definition and an inline footnote reference', () => {
    const bridge = open('Text[^1]\n\n[^1]: Note.\n')
    appendToFirstBlock(bridge, ' more')
    expect(bridge.getMarkdown()).toBe('Text[^1] more\n\n[^1]: Note.\n')
  })

  it('does not re-serialize an opaque block even when it is moved', () => {
    const bridge = open(source)
    native(bridge).update(
      () => {
        const root = $getRoot()
        const children: LexicalNode[] = root.getChildren()
        const html = children[1]
        const last = children[2]
        if (html !== undefined && last !== undefined) last.insertAfter(html)
      },
      { discrete: true },
    )
    expect(bridge.getMarkdown()).toContain('<div class="note">\n  <p>hi</p>\n</div>')
  })
})

describe('line endings (audit G5)', () => {
  it('keeps a soft line ending inside the text node, not as a break', () => {
    const document = open('a\nb\n').getDocument()
    expect(findNode(document.tree, 'break')).toBeUndefined()
    expect(findNode(document.tree, 'text')?.['value']).toBe('a\nb')
  })

  it('keeps a backslash hard break as a break node', () => {
    const document = open('a\\\nb\n').getDocument()
    expect(findNode(document.tree, 'break')).toBeDefined()
  })

  it('keeps a two-space hard break as a break node', () => {
    const document = open('a  \nb\n').getDocument()
    expect(findNode(document.tree, 'break')).toBeDefined()
  })
})

describe('typed node data, never a style attribute (audit G6, G11)', () => {
  it('preserves explicit ordered-list numbering', () => {
    const list = findNode(open('3. three\n4. four\n').getDocument().tree, 'list')
    expect(list?.['ordered']).toBe(true)
    expect(list?.['start']).toBe(3)
  })

  it('preserves list looseness', () => {
    const list = findNode(open('- a\n\n  second para\n\n- b\n').getDocument().tree, 'list')
    expect(list?.['spread']).toBe(true)
  })

  it('preserves code fence language and meta on typed fields', () => {
    const code = findNode(open('```js title="x"\nconst a = 1\n```\n').getDocument().tree, 'code')
    expect(code?.['lang']).toBe('js')
    expect(code?.['meta']).toBe('title="x"')
    expect(JSON.stringify(code)).not.toContain('style')
  })

  it('preserves table alignment on a typed field', () => {
    const table = findNode(open('| a | b |\n| - | -: |\n| 1 | 2 |\n').getDocument().tree, 'table')
    expect(table?.['align']).toEqual([null, 'right'])
    expect(JSON.stringify(table)).not.toContain('style')
  })

  it('keeps task-list checked state', () => {
    const document = open('- [ ] todo\n- [x] done\n').getDocument()
    const items = findNode(document.tree, 'list')?.children ?? []
    expect(items.map((item) => item['checked'])).toEqual([false, true])
  })
})

describe('edited regions', () => {
  it('re-serializes only the block that changed', () => {
    const bridge = open('Title\n=====\n\nBody.\n\n~~~js\nx\n~~~\n')
    native(bridge).update(
      () => {
        const second = $getRoot().getChildren()[1]
        if (second !== undefined && $isElementNode(second)) second.append($createTextNode(' More.'))
      },
      { discrete: true },
    )
    const out = bridge.getMarkdown()
    // The setext heading and the tilde fence are untouched, so they keep their
    // original spelling even though the serializer would normalise both.
    expect(out).toContain('Title\n=====')
    expect(out).toContain('~~~js\nx\n~~~')
    expect(out).toContain('Body. More.')
  })

  it('serializes a wholly new document from mdast', () => {
    const bridge = createMarkdownBridge({ preset, headless: true })
    bridge.load('')
    native(bridge).update(
      () => {
        const root = $getRoot()
        root.clear()
        const paragraph = root.getFirstChild()
        expect(paragraph).toBeNull()
      },
      { discrete: true },
    )
    expect(bridge.getMarkdown()).toBe('')
  })

  it('reports diagnostics from the parser', () => {
    const bridge = createMarkdownBridge({ preset, headless: true })
    expect(bridge.load('# Fine\n')).toEqual([])
  })
})

describe('serializer parity with the renderer', () => {
  it('matches documentToMarkdown for the same tree', async () => {
    const source = '# Title\n\n- a\n- b\n\n> quote\n'
    const document = compileMarkdown(source, { preset })
    const toMarkdownExtensions = preset.extensions.flatMap(
      (extension) => extension.capabilities?.syntax?.toMarkdownExtensions ?? [],
    )
    expect(serializeDocument(document, toMarkdownExtensions)).toBe(
      await documentToMarkdown(document, { preset }),
    )
  })
})

describe('document contract', () => {
  it('returns a JSON-serializable MarkdownDocument', () => {
    const document = open('# Title\n\nBody.\n').getDocument()
    expect(document.contractVersion).toBe(1)
    expect(document.profile).toBe('gfm')
    expect(document.source).toBe('# Title\n\nBody.\n')
    expect(() => JSON.stringify(document)).not.toThrow()
  })
})
