/**
 * The deck through the editor's headless bridge: every break, marker and
 * directive opens as the plugin's own node, an untouched deck writes back
 * byte for byte (front matter, directives, markers, rules, fences), the
 * insert commands and the Enter shortcut serialize to the dialect, a fresh
 * break next to an original of the other kind is written with its own
 * spelling, an insert from inside a list or a quote leaves no hollow clone
 * behind, a break nested in a quote is a rule, and an edited chip is
 * rewritten without touching its neighbours.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical'
import { Markdown, compileMarkdown, documentToMarkdown } from '@react-markdown-kit/renderer'
import { createMarkdownBridge, type MarkdownBridge } from '@react-markdown-kit/editor'
import {
  $isSlideBreakNode,
  $isSlideDirectiveNode,
  $isSlideMarkerNode,
  INSERT_SLIDE_COMMAND,
  INSERT_SLIDE_DIRECTIVE_COMMAND,
  INSERT_SLIDE_MARKER_COMMAND,
  slides,
} from '../src/editor.js'
import { slideBreakAdapter } from '../src/editor/adapters.js'

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

function open(source: string): { editor: LexicalEditor; bridge: MarkdownBridge; off: () => void } {
  const bridge = createMarkdownBridge({ extensions: [slides()], headless: true })
  const off = bridge.registerPlugins()
  bridge.load(source)
  return { editor: bridge.getNativeEditor() as LexicalEditor, bridge, off }
}

function rootTypes(editor: LexicalEditor): string[] {
  return editor.getEditorState().read(() => $getRoot().getChildren().map((node) => node.getType()))
}

/** Node methods need an active editor state, like any `$` helper. */
function read<T>(editor: LexicalEditor, callback: () => T): T {
  return editor.getEditorState().read(callback)
}

function write(editor: LexicalEditor, callback: () => void): void {
  editor.update(callback, { discrete: true })
}

describe('slides() on the editor bridge', () => {
  it('round-trips a deck byte for byte', () => {
    const { bridge } = open(DECK)
    expect(bridge.getMarkdown()).toBe(DECK)
  })

  it('opens every break, marker and directive as the plugin node', () => {
    const { editor } = open(DECK)
    expect(rootTypes(editor)).toEqual([
      'rmk-opaque-block',
      'rmk-slide-directive',
      'rmk-slide-directive',
      'rmk-heading',
      'paragraph',
      'rmk-slide-break',
      'rmk-list',
      'rmk-slide-marker',
      'paragraph',
      'rmk-slide-marker',
      'paragraph',
      'rmk-slide-break',
      'rmk-slide-directive',
      'rmk-heading',
      'rmk-code-block',
      'rmk-slide-break',
      'rmk-heading',
    ])
    const children = read(editor, () => $getRoot().getChildren())
    expect(read(editor, () => children.filter($isSlideBreakNode).map((node) => node.getKind()))).toEqual(['rule', 'slide', 'slide'])
    expect(read(editor, () => children.filter($isSlideBreakNode).map((node) => node.getSource()))).toEqual(['***', '---', '---'])
    expect(read(editor, () => children.filter($isSlideMarkerNode).map((node) => node.getKind()))).toEqual(['pause', 'notes'])
    expect(
      read(editor, () => children.filter($isSlideDirectiveNode).map((node) => [node.getDirectiveKey(), node.getArgument()])),
    ).toEqual([
      ['name', 'intro'],
      ['class', 'center, middle'],
      ['background', 'https://example.com/bg.jpg'],
    ])
  })

  it('keeps an unusual break spelling and reads its kind from it', () => {
    const source = '# One\n\n- - -\n\n# Two\n\n_____\n\nEnd.\n'
    const { editor, bridge } = open(source)
    expect(bridge.getMarkdown()).toBe(source)
    const [first, second] = read(editor, () => $getRoot().getChildren().filter($isSlideBreakNode))
    expect(read(editor, () => [first?.getKind(), second?.getKind()])).toEqual(['slide', 'rule'])
    expect(read(editor, () => [first?.getSource(), second?.getSource()])).toEqual(['- - -', '_____'])
  })

  it('a break with no source bytes reads its kind from the transform annotation', () => {
    const { editor } = open('# One\n')
    write(editor, () => {
      const rule = slideBreakAdapter.$import({ type: 'thematicBreak', data: { rmkSlides: { rule: true } } }, '')
      const plain = slideBreakAdapter.$import({ type: 'thematicBreak' }, '')
      expect($isSlideBreakNode(rule) && rule.getKind()).toBe('rule')
      expect($isSlideBreakNode(plain) && plain.getKind()).toBe('slide')
      // No bytes to write back: exported like a fresh break, never aligned.
      expect(slideBreakAdapter.$export(rule)).toEqual({ node: { type: 'slideBreak', kind: 'rule' }, raw: '***' })
      expect(slideBreakAdapter.$export(plain)).toEqual({ node: { type: 'slideBreak', kind: 'slide' }, raw: '---' })
    })
  })

  it('an imported break exports as the thematicBreak it came from, with its bytes', () => {
    const { editor } = open('# One\n\n- - -\n\n***\n')
    const [slide, rule] = read(editor, () => $getRoot().getChildren().filter($isSlideBreakNode))
    write(editor, () => {
      expect(slideBreakAdapter.$export(slide as LexicalNode)).toEqual({ node: { type: 'thematicBreak' }, raw: '- - -' })
      expect(slideBreakAdapter.$export(rule as LexicalNode)).toEqual({
        node: { type: 'thematicBreak', data: { rmkSlides: { rule: true } } },
        raw: '***',
      })
    })
  })

  describe('a fresh break next to an original break of the other kind', () => {
    it('New slide directly before a *** rule writes --- then ***', () => {
      const { editor, bridge } = open('# A\n\nIntro\n\n***\n\nMore\n')
      write(editor, () => {
        $getRoot().getChildAtIndex(1)?.selectEnd()
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      const out = bridge.getMarkdown()
      expect(out).toBe('# A\n\nIntro\n\n---\n\n***\n\nMore\n')
      expect(compileMarkdown(out, { extensions: [slides()] }).tree.children.filter((node) => node.type === 'thematicBreak')).toHaveLength(2)
    })

    it('a *** rule typed before a --- slide break writes *** then ---', () => {
      const { editor, bridge } = open('# A\n\nIntro\n\n---\n\n# B\n')
      write(editor, () => {
        const line = $createParagraphNode().append($createTextNode('***'))
        $getRoot().getChildAtIndex(1)?.insertAfter(line)
        line.selectEnd()
        editor.dispatchCommand(KEY_ENTER_COMMAND, null)
      })
      expect(bridge.getMarkdown()).toBe('# A\n\nIntro\n\n***\n\n---\n\n# B\n')
    })

    it('deleting a rule and inserting a slide break elsewhere changes the file', () => {
      const source = '# A\n\n***\n\nMore\n\n# B\n'
      const { editor, bridge } = open(source)
      write(editor, () => {
        $getRoot().getChildAtIndex(1)?.remove()
      })
      write(editor, () => {
        $getRoot().getChildAtIndex(0)?.selectEnd()
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      expect(bridge.getMarkdown()).toBe('# A\n\n---\n\nMore\n\n# B\n')
    })

    it('a fresh slide break in the place of a deleted one is written as ---, the untouched ones from their bytes', () => {
      const { editor, bridge } = open('# A\n\n- - -\n\n# B\n\n- - -\n\n# C\n')
      write(editor, () => {
        $getRoot().getChildAtIndex(1)?.remove()
      })
      write(editor, () => {
        $getRoot().getChildAtIndex(0)?.selectEnd()
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      expect(bridge.getMarkdown()).toBe('# A\n\n---\n\n# B\n\n- - -\n\n# C\n')
    })

    it('getDocument() carries the fresh break as slideBreak, and it still serializes and renders as a deck', async () => {
      const { editor, bridge } = open('# A\n\nIntro\n\n***\n\nMore\n')
      write(editor, () => {
        $getRoot().getChildAtIndex(1)?.selectEnd()
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      const document = bridge.getDocument()
      expect(document.tree.children.map((node) => node.type)).toEqual(['heading', 'paragraph', 'slideBreak', 'thematicBreak', 'paragraph'])
      expect(await documentToMarkdown(document, { extensions: [slides()] })).toBe('# A\n\nIntro\n\n---\n\n***\n\nMore\n')
      const html = renderToStaticMarkup(createElement(Markdown, { document, extensions: [slides()] } as never))
      expect(html).toContain('data-rmk-deck-slides="2"')
      expect(html.match(/<hr/g)).toHaveLength(1)
    })
  })

  describe('inserting from inside a nested block', () => {
    function selectEndOf(node: LexicalNode | null | undefined): void {
      if ($isElementNode(node)) node.getLastChild()?.selectEnd()
    }

    it('at the end of a list leaves no empty item behind the break', () => {
      const { editor, bridge } = open('# A\n\n- a\n- b\n')
      write(editor, () => {
        selectEndOf($getRoot().getChildAtIndex(1))
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      expect(rootTypes(editor)).toEqual(['rmk-heading', 'rmk-list', 'rmk-slide-break', 'paragraph'])
      expect(bridge.getMarkdown()).toBe('# A\n\n- a\n- b\n\n---\n')
    })

    it('in the middle of a list splits it cleanly', () => {
      const { editor, bridge } = open('# A\n\n- a\n- b\n- c\n')
      write(editor, () => {
        const list = $getRoot().getChildAtIndex(1)
        if ($isElementNode(list)) list.getChildAtIndex(1)?.selectEnd()
        editor.dispatchCommand(INSERT_SLIDE_MARKER_COMMAND, { kind: 'pause' })
      })
      expect(bridge.getMarkdown()).toBe('# A\n\n- a\n- b\n\n--\n\n- c\n')
    })

    it('at the start of a list leaves no empty list before the break', () => {
      const { editor, bridge } = open('# A\n\n- a\n- b\n')
      write(editor, () => {
        const list = $getRoot().getChildAtIndex(1)
        if ($isElementNode(list)) list.getFirstChild()?.selectStart()
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      expect(rootTypes(editor)).toEqual(['rmk-heading', 'rmk-slide-break', 'rmk-list'])
      expect(bridge.getMarkdown()).toBe('# A\n\n---\n\n- a\n- b\n')
    })

    it('at the end of a nested list item', () => {
      const { editor, bridge } = open('# A\n\n- a\n  - b\n')
      write(editor, () => {
        const list = $getRoot().getChildAtIndex(1)
        const item = $isElementNode(list) ? list.getLastChild() : null
        const sublist = $isElementNode(item) ? item.getLastChild() : null
        selectEndOf(sublist)
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      expect(rootTypes(editor)).toEqual(['rmk-heading', 'rmk-list', 'rmk-slide-break', 'paragraph'])
      expect(bridge.getMarkdown()).toBe('# A\n\n- a\n  - b\n\n---\n')
    })

    it('at the end of a blockquote', () => {
      const { editor, bridge } = open('# A\n\n> quote\n')
      write(editor, () => {
        selectEndOf($getRoot().getChildAtIndex(1))
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      expect(rootTypes(editor)).toEqual(['rmk-heading', 'rmk-blockquote', 'rmk-slide-break', 'paragraph'])
      expect(bridge.getMarkdown()).toBe('# A\n\n> quote\n\n---\n')
    })
  })

  it('a break nested in a blockquote opens as a rule, and the deck still writes back byte for byte', () => {
    const source = '# One\n\n> quote\n>\n> ---\n>\n> more\n\n---\n\n# Two\n'
    const { editor, bridge } = open(source)
    const kinds = read(editor, () =>
      $getRoot()
        .getChildren()
        .flatMap((node) => ($isElementNode(node) ? node.getChildren() : [node]))
        .filter($isSlideBreakNode)
        .map((node) => [node.getKind(), node.getSource()]),
    )
    expect(kinds).toEqual([
      ['rule', '---'],
      ['slide', '---'],
    ])
    expect(bridge.getMarkdown()).toBe(source)
  })

  it('removing a slide break merges two slides and leaves the rest byte for byte', () => {
    const { editor, bridge } = open(DECK)
    const breaks = read(editor, () => $getRoot().getChildren().filter($isSlideBreakNode))
    write(editor, () => {
      breaks[2]?.remove()
    })
    const out = bridge.getMarkdown()
    expect(out).toBe(DECK.replace('```\n\n---\n\n## Close', '```\n\n## Close'))
    expect(compileMarkdown(out, { extensions: [slides()] }).diagnostics).toEqual([])
  })

  it('rewrites an edited chip and nothing else', () => {
    const { editor, bridge } = open(DECK)
    const [, classDirective] = read(editor, () => $getRoot().getChildren().filter($isSlideDirectiveNode))
    write(editor, () => {
      classDirective?.setArgument('inverse')
    })
    const out = bridge.getMarkdown()
    expect(out).toContain('<!-- name: intro -->')
    expect(out).toContain('<!-- class: inverse -->')
    expect(out).not.toContain('center, middle')
    expect(out).toContain('---\ntitle: Q3 review\naspect: 4:3\n---\n')
    expect(out).toContain('\n\n# Welcome\n\nHello _there_, **friend**.\n\n***\n\n- a\n- b\n\n--\n\nAfter the pause.\n\n???\n\nSay this.\n\n---\n\n')
    expect(out).toContain('```js\nconst x = 1\n```\n\n---\n\n## Close\n')
    expect(compileMarkdown(out, { extensions: [slides()] }).diagnostics).toEqual([])
  })

  describe('insert commands', () => {
    it('INSERT_SLIDE_COMMAND appends a --- break', () => {
      const { editor, bridge } = open('# One\n\nHello.\n')
      write(editor, () => {
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      expect(rootTypes(editor)).toEqual(['rmk-heading', 'paragraph', 'rmk-slide-break', 'paragraph'])
      expect(bridge.getMarkdown()).toBe('# One\n\nHello.\n\n---\n')
    })

    it('INSERT_SLIDE_MARKER_COMMAND writes ??? and --, never \\--', () => {
      const { editor, bridge } = open('# One\n\nHello.\n')
      write(editor, () => {
        editor.dispatchCommand(INSERT_SLIDE_MARKER_COMMAND, { kind: 'pause' })
      })
      write(editor, () => {
        $getRoot().selectEnd()
        editor.dispatchCommand(INSERT_SLIDE_MARKER_COMMAND, { kind: 'notes' })
      })
      expect(bridge.getMarkdown()).toBe('# One\n\nHello.\n\n--\n\n???\n')
      expect(compileMarkdown(bridge.getMarkdown(), { extensions: [slides()] }).diagnostics).toEqual([])
    })

    it('INSERT_SLIDE_DIRECTIVE_COMMAND writes the comment', () => {
      const { editor, bridge } = open('# One\n')
      write(editor, () => {
        editor.dispatchCommand(INSERT_SLIDE_DIRECTIVE_COMMAND, { key: 'class', argument: 'center' })
      })
      expect(bridge.getMarkdown()).toBe('# One\n\n<!-- class: center -->\n')
    })

    it('inserts at the selection, in the middle of a document', () => {
      const { editor, bridge } = open('# One\n\nFirst.\n\nSecond.\n')
      write(editor, () => {
        const first = $getRoot().getChildAtIndex(1)
        first?.selectEnd()
        editor.dispatchCommand(INSERT_SLIDE_COMMAND, undefined)
      })
      expect(bridge.getMarkdown()).toBe('# One\n\nFirst.\n\n---\n\nSecond.\n')
    })
  })

  describe('the Enter shortcut', () => {
    function pressEnterAfter(line: string): { editor: LexicalEditor; bridge: MarkdownBridge } {
      const { editor, bridge } = open('# One\n')
      write(editor, () => {
        const paragraph = $createParagraphNode().append($createTextNode(line))
        $getRoot().append(paragraph)
        paragraph.selectEnd()
      })
      write(editor, () => {
        editor.dispatchCommand(KEY_ENTER_COMMAND, null)
      })
      return { editor, bridge }
    }

    it('turns a --- line into a slide break', () => {
      const { editor, bridge } = pressEnterAfter('---')
      expect(rootTypes(editor)).toEqual(['rmk-heading', 'rmk-slide-break', 'paragraph'])
      expect(bridge.getMarkdown()).toBe('# One\n\n---\n')
    })

    it('turns *** into a rule that stays a rule', () => {
      const { editor, bridge } = pressEnterAfter('***')
      const [rule] = read(editor, () => $getRoot().getChildren().filter($isSlideBreakNode))
      expect(read(editor, () => rule?.getKind())).toBe('rule')
      expect(bridge.getMarkdown()).toBe('# One\n\n***\n')
    })

    it('turns -- and ??? into markers', () => {
      expect(pressEnterAfter('--').bridge.getMarkdown()).toBe('# One\n\n--\n')
      expect(pressEnterAfter('???').bridge.getMarkdown()).toBe('# One\n\n???\n')
    })

    it('leaves any other line alone', () => {
      const { editor } = pressEnterAfter('plain text')
      expect(rootTypes(editor)).toEqual(['rmk-heading', 'paragraph'])
    })
  })

  it('exposes the editor capability under the same extension name and version', () => {
    const extension = slides({ aspect: '4:3', editorLabels: { notes: 'Notizen' } })
    expect(extension.name).toBe('slides')
    expect(extension.version).toBe('1')
    expect(extension.contractVersion).toBe(1)
    expect(extension.capabilities?.editor?.nodes).toHaveLength(3)
    expect(extension.capabilities?.editor?.blocks).toHaveLength(3)
    expect(extension.capabilities?.editor?.plugins).toHaveLength(1)
    expect(extension.capabilities?.editor?.commands).toHaveLength(4)
    expect(extension.capabilities?.renderer?.components).toHaveProperty('article')
    expect(extension.capabilities?.syntax?.nodeTypes).toEqual(['slideMarker', 'slideDirective', 'slideBreak'])
  })
})
