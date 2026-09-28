/**
 * Markdown typing shortcuts on the rich surface.
 *
 * jsdom has no `beforeinput`, so a keystroke is modelled the way Lexical's
 * own input handling ends up applying it: one discrete update inserting one
 * character at the caret, and Enter as `INSERT_PARAGRAPH_COMMAND`. The
 * shortcut listeners then see exactly what they see in a browser.
 */
import { describe, expect, it } from 'vitest'
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
  type ElementNode,
  type LexicalEditor,
} from 'lexical'
import {
  MarkdownEditor,
  useMarkdownEditorContext,
  type MarkdownEditorInstance,
} from '@react-markdown-kit/editor'
import { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { mount, run } from './helpers/mount.js'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

// Lexical scrolls the caret into view after each update; jsdom has no layout.
Range.prototype.getBoundingClientRect ??= () => new DOMRect()

function Capture({ onReady }: { onReady: (editor: MarkdownEditorInstance) => void }): null {
  onReady(useMarkdownEditorContext())
  return null
}

interface Typist {
  readonly instance: MarkdownEditorInstance
  type(text: string): void
  enter(): void
  backspace(): void
  markdown(): string
  html(): string
  unmount(): void
}

function editorWith(defaultValue: string, options: { commonmark?: boolean } = {}): Typist {
  let instance!: MarkdownEditorInstance
  const view = mount(
    <MarkdownEditor
      defaultValue={defaultValue}
      {...(options.commonmark === true ? {} : { preset })}
      toolbar={false}
    >
      <Capture onReady={(value) => (instance = value)} />
    </MarkdownEditor>,
  )
  const lexical = instance.getNativeEditor() as LexicalEditor
  run(() => {
    lexical.update(() => $getRoot().selectEnd(), { discrete: true })
  })
  return {
    instance,
    type(text) {
      for (const character of text) {
        run(() => {
          lexical.update(
            () => {
              const selection = $getSelection()
              if ($isRangeSelection(selection)) selection.insertText(character)
            },
            { discrete: true },
          )
          // The shortcut listeners answer with an update of their own.
          lexical.update(() => undefined, { discrete: true })
        })
      }
    },
    enter() {
      run(() => {
        lexical.update(
          () => {
            lexical.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined)
          },
          { discrete: true },
        )
      })
    },
    backspace() {
      run(() => {
        lexical.update(
          () => {
            lexical.dispatchCommand(KEY_BACKSPACE_COMMAND, new KeyboardEvent('keydown', { key: 'Backspace' }))
          },
          { discrete: true },
        )
      })
    },
    markdown: () => instance.getMarkdown().trimEnd(),
    html: () => view.container.querySelector('[contenteditable]')?.innerHTML ?? '',
    unmount: () => view.unmount(),
  }
}

describe('block shortcuts on a space', () => {
  it.each([
    ['- ', 'item', '- item'],
    ['* ', 'item', '- item'],
    ['+ ', 'item', '- item'],
    ['1. ', 'first', '1. first'],
    ['3. ', 'third', '3. third'],
    ['# ', 'Title', '# Title'],
    ['### ', 'Section', '### Section'],
    ['> ', 'quoted', '> quoted'],
    ['[ ] ', 'todo', '- [ ] todo'],
    ['[x] ', 'done', '- [x] done'],
  ])('%j then text writes the block', (trigger, text, expected) => {
    const editor = editorWith('')
    editor.type(trigger)
    editor.type(text)
    expect(editor.markdown()).toBe(expected)
    editor.unmount()
  })

  it('saves a typed list exactly like the toolbar command does', () => {
    const typed = editorWith('')
    typed.type('- one')
    const clicked = editorWith('one')
    run(() => clicked.instance.commands.toggleBulletList())
    expect(typed.markdown()).toBe(clicked.markdown())
    typed.unmount()
    clicked.unmount()
  })

  it('turns `[ ] ` at the start of a bullet item into a task item', () => {
    const editor = editorWith('')
    editor.type('- [ ] buy milk')
    expect(editor.markdown()).toBe('- [ ] buy milk')
    expect(editor.html()).toContain('data-rmk-task="unchecked"')
    editor.unmount()
  })

  it('opens a code block with its language on ``` and a space', () => {
    const editor = editorWith('')
    editor.type('```ts ')
    editor.type('const a = 1')
    expect(editor.markdown()).toBe('```ts\nconst a = 1\n```')
    editor.unmount()
  })

  it('adds the next item to the list above instead of starting a second list', () => {
    const editor = editorWith('- one')
    editor.enter()
    editor.type('two')
    expect(editor.markdown()).toBe('- one\n- two')
    editor.unmount()
  })

  it('undoes a shortcut back to the text that was typed', () => {
    const editor = editorWith('')
    editor.type('# ')
    expect(editor.html()).toContain('<h1')
    run(() => editor.instance.undo())
    expect(editor.html()).not.toContain('<h1')
    expect(editor.html()).toContain('# ')
    editor.unmount()
  })
})

describe('inline shortcuts', () => {
  it.each([
    ['**bold**', '**bold**'],
    ['*em*', '_em_'],
    ['`code`', '`code`'],
    ['~~gone~~', '~~gone~~'],
    ['[site](https://example.com)', '[site](https://example.com)'],
  ])('%j formats the text', (typed, expected) => {
    const editor = editorWith('')
    editor.type(`a ${typed}`)
    expect(editor.markdown()).toBe(`a ${expected}`)
    expect(editor.html()).not.toContain(typed)
    editor.unmount()
  })
})

describe('inline shortcuts left alone', () => {
  it('keeps underscores inside a word', () => {
    const editor = editorWith('')
    editor.type('snake_case_name')
    expect(editor.html()).toContain('snake_case_name')
    editor.unmount()
  })

  it('keeps `~~` literal in a CommonMark document', () => {
    const editor = editorWith('', { commonmark: true })
    editor.type('~~gone~~')
    expect(editor.html()).toContain('~~gone~~')
    editor.unmount()
  })
})

describe('block shortcuts on Enter', () => {
  it.each(['---', '***', '___'])('%j becomes a thematic break', (rule) => {
    const editor = editorWith('Above')
    editor.enter()
    editor.type(rule)
    editor.enter()
    editor.type('Below')
    expect(editor.html()).toContain('<hr')
    expect(editor.markdown()).toMatch(/^Above\n\n(\*\*\*|---|___)\n\nBelow$/)
    editor.unmount()
  })

  it('opens a code block from a fence line', () => {
    const editor = editorWith('')
    editor.type('```js')
    editor.enter()
    editor.type('let x')
    expect(editor.markdown()).toBe('```js\nlet x\n```')
    editor.unmount()
  })

  it('builds a table row by row, with alignment from the delimiter line', () => {
    const editor = editorWith('')
    editor.type('| Name | Qty |')
    editor.enter()
    editor.type('| :-- | --: |')
    editor.enter()
    editor.type('| **Apples** | 3 |')
    editor.enter()
    editor.type('| Pears | 12 |')
    editor.enter()
    expect(editor.html()).toContain('<th')
    expect(editor.html()).toContain('<strong')
    expect(editor.markdown()).toBe(
      ['| Name       | Qty |', '| :--------- | --: |', '| **Apples** |   3 |', '| Pears      |  12 |'].join('\n'),
    )
    editor.unmount()
  })

  it('widens the table when a row has more cells than the header', () => {
    const editor = editorWith('')
    editor.type('| a |')
    editor.enter()
    editor.type('| 1 | 2 |')
    editor.enter()
    expect(editor.markdown()).toBe(['| a |   |', '| - | - |', '| 1 | 2 |'].join('\n'))
    editor.unmount()
  })

  it('leaves a pipe line alone in a CommonMark document', () => {
    const editor = editorWith('', { commonmark: true })
    editor.type('| a | b |')
    editor.enter()
    expect(editor.html()).not.toContain('<table')
    editor.unmount()
  })

  it('does nothing when the caret is not at the end of the line', () => {
    const editor = editorWith('')
    editor.type('---')
    const lexical = editor.instance.getNativeEditor() as LexicalEditor
    run(() => {
      lexical.update(() => $getRoot().selectStart(), { discrete: true })
    })
    editor.enter()
    expect(editor.html()).not.toContain('<hr')
    editor.unmount()
  })
})

describe('Enter and Backspace in a blockquote', () => {
  it('leaves the quote on Enter in an empty last line', () => {
    const editor = editorWith('')
    editor.type('> quoted')
    editor.enter()
    editor.enter()
    editor.type('after')
    expect(editor.markdown()).toBe('> quoted\n\nafter')
    editor.unmount()
  })

  it('lifts the first line out of the quote on Backspace at its start', () => {
    const editor = editorWith('')
    editor.type('> quoted')
    const lexical = editor.instance.getNativeEditor() as LexicalEditor
    run(() => {
      lexical.update(() => $getRoot().selectStart(), { discrete: true })
    })
    editor.backspace()
    expect(editor.html()).not.toContain('<blockquote')
    expect(editor.markdown()).toBe('quoted')
    editor.unmount()
  })
})

describe('Enter and Backspace in a list', () => {
  it('starts an unchecked task after a task item', () => {
    const editor = editorWith('- [x] done')
    editor.enter()
    editor.type('next')
    expect(editor.markdown()).toBe('- [x] done\n- [ ] next')
    editor.unmount()
  })

  it('leaves the list on Enter in an empty item', () => {
    const editor = editorWith('- one')
    editor.enter()
    editor.enter()
    editor.type('after')
    expect(editor.markdown()).toBe('- one\n\nafter')
    editor.unmount()
  })

  it('keeps numbering when an item in the middle of a list is lifted out', () => {
    const editor = editorWith('1. one\n2. two\n3. three')
    const lexical = editor.instance.getNativeEditor() as LexicalEditor
    run(() => {
      lexical.update(() => {
        const two = $getRoot().getFirstChildOrThrow<ElementNode>().getChildAtIndex<ElementNode>(1)
        two?.selectStart()
      }, { discrete: true })
    })
    editor.backspace()
    expect(editor.markdown()).toBe('1. one\n\ntwo\n\n3. three')
    editor.unmount()
  })

  it('drops the checkbox first, then the bullet, on Backspace at the start', () => {
    const editor = editorWith('')
    editor.type('- [ ] ')
    editor.backspace()
    expect(editor.html()).not.toContain('data-rmk-task')
    expect(editor.html()).toContain('<li')
    editor.backspace()
    expect(editor.html()).not.toContain('<li')
    editor.unmount()
  })
})

describe('edge cases', () => {
  it('does not convert when a deletion leaves shortcut-like text before the caret', () => {
    const editor = editorWith('\\- item')
    const lexical = editor.instance.getNativeEditor() as LexicalEditor
    run(() => {
      lexical.update(() => {
        const text = $getRoot().getFirstDescendant()
        if ($isTextNode(text)) text.select(2, 3)
      }, { discrete: true })
    })
    run(() => {
      lexical.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) selection.removeText()
      }, { discrete: true })
      lexical.update(() => undefined, { discrete: true })
    })
    expect(editor.html()).not.toContain('<li')
    editor.unmount()
  })

  it('keeps the rest of the line when `--- ` is typed at its start', () => {
    const editor = editorWith('kept')
    const lexical = editor.instance.getNativeEditor() as LexicalEditor
    run(() => {
      lexical.update(() => $getRoot().selectStart(), { discrete: true })
    })
    editor.type('--- ')
    expect(editor.html()).toContain('<hr')
    expect(editor.markdown()).toContain('kept')
    editor.unmount()
  })

  it('turns `![alt](src)` into an image, not a link after a stray `!`', () => {
    const editor = editorWith('')
    editor.type('![logo](/logo.png)')
    expect(editor.markdown()).toBe('![logo](/logo.png)')
    editor.unmount()
  })

  it('leaves a delimiter line alone when there is no header row above', () => {
    const editor = editorWith('')
    editor.type('| --- | --- |')
    editor.enter()
    expect(editor.html()).not.toContain('<table')
    editor.unmount()
  })

  it('keeps an escaped pipe inside a typed cell as one pipe', () => {
    const editor = editorWith('')
    editor.type('| a \\| b | c |')
    editor.enter()
    expect(editor.markdown()).toBe(['| a \\| b | c |', '| ------ | - |'].join('\n'))
    editor.unmount()
  })

  it('types plain text after a format shortcut', () => {
    const editor = editorWith('')
    editor.type('**b** plain')
    expect(editor.markdown()).toBe('**b** plain')
    editor.unmount()
  })
})

describe('what a shortcut never touches', () => {
  it('leaves Markdown syntax typed inside a code block as code', () => {
    const editor = editorWith('```\n```')
    editor.type('# **not bold** ')
    expect(editor.markdown()).toBe('```\n# **not bold** \n```')
    editor.unmount()
  })

  it('does not rewrite a loaded document that only looks like shortcuts', () => {
    const source = '- \\[ ] literal\n\n\\# not a heading\n\n\\*\\*x\\*\\*'
    const editor = editorWith(source)
    expect(editor.markdown()).toBe(source)
    editor.unmount()
  })
})
