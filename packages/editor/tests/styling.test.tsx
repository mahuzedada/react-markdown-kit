/**
 * The styling contract (docs/STYLING.md), asserted rather than asserted-to.
 *
 * The important one is the first: with `styles.css` absent the editor is
 * unstyled and **fully functional**. Nothing in this package's behaviour may
 * depend on its own stylesheet being loaded.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MarkdownEditor,
  useMarkdownEditorContext,
  type MarkdownEditorInstance,
} from '@react-markdown-kit/editor'
import { button, click, mount, run } from './helpers/mount.js'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative: string): string => readFileSync(join(packageRoot, relative), 'utf8')

function Capture({ onReady }: { onReady: (editor: MarkdownEditorInstance) => void }): null {
  onReady(useMarkdownEditorContext())
  return null
}

describe('the editor works with no CSS imported', () => {
  it('edits, switches mode and serializes with no stylesheet in the document', () => {
    // Nothing in this test file imports styles.css, and jsdom starts with an
    // empty stylesheet list.
    expect(document.querySelectorAll('link[rel="stylesheet"], style')).toHaveLength(0)

    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor defaultValue="one">
        <Capture onReady={(instance) => (editor = instance)} />
      </MarkdownEditor>,
    )

    run(() => {
      editor.commands.setBlockType('heading2')
    })
    expect(editor.getMarkdown()).toBe('## one\n')
    expect(view.container.querySelector('h2')?.textContent).toBe('one')

    click(button(view.container, 'source'))
    expect(view.container.querySelector('textarea')?.value).toBe('## one\n')

    click(button(view.container, 'preview'))
    expect(view.container.querySelector('[data-rmk-surface="preview"] h2')).not.toBeNull()

    click(button(view.container, 'rich'))
    expect(editor.getMarkdown()).toBe('## one\n')

    expect(document.querySelectorAll('link[rel="stylesheet"], style')).toHaveLength(0)
    view.unmount()
  })

  it('carries no inline appearance styles, only the ones editing requires', () => {
    const view = mount(<MarkdownEditor defaultValue="# H" />)
    // The live region that announces mode changes is deliberately positioned
    // off-screen; that is accessibility function, not appearance.
    const styled = [...view.container.querySelectorAll<HTMLElement>('[style]')].filter(
      (element) => !element.hasAttribute('data-rmk-live-region'),
    )
    for (const element of styled) {
      // `white-space`/`word-break` on the editable surface are function, not
      // appearance (docs/STYLING.md rule 2).
      const declarations = element.getAttribute('style') ?? ''
      expect(
        declarations
          .replace(/white-space:[^;]*;?|word-break:[^;]*;?|user-select:[^;]*;?/g, '')
          .trim(),
      ).toBe('')
    }
    view.unmount()
  })
})

describe('class hooks', () => {
  it('scopes the root on .rmk-editor so the optional stylesheet has one anchor', () => {
    const view = mount(<MarkdownEditor defaultValue="# H" />)
    expect(view.container.firstElementChild?.className).toBe('rmk-editor')
    view.unmount()
  })

  it('leaves document content as plain semantic HTML', () => {
    const view = mount(<MarkdownEditor defaultValue={'# H\n\n- a\n\n> q\n'} toolbar={false} />)
    for (const selector of ['h1', 'ul', 'li', 'blockquote']) {
      const element = view.container.querySelector(selector)
      expect(element, selector).not.toBeNull()
      expect(element?.getAttribute('class'), selector).toBeNull()
    }
    view.unmount()
  })

  it('replaces rather than merges a consumer class', () => {
    const view = mount(
      <MarkdownEditor
        defaultValue="# H"
        classNames={{
          root: 'rounded-lg border',
          toolbar: 'flex gap-1',
          toolbarButton: 'p-1',
          content: 'min-h-64 p-4',
        }}
      />,
    )
    expect(view.container.firstElementChild?.className).toBe('rounded-lg border')
    expect(view.container.querySelector('[role="toolbar"]')?.className).toBe('flex gap-1')
    expect(button(view.container, 'bold').className).toBe('p-1')
    expect(view.container.querySelector('.rmk-toolbar')).toBeNull()
    expect(view.container.querySelector('.rmk-toolbar-button')).toBeNull()
    expect(view.container.querySelector('.rmk-content')).toBeNull()
    view.unmount()
  })

  it('names the opaque block, which has no semantic element of its own', () => {
    const view = mount(<MarkdownEditor defaultValue={'<div>x</div>\n'} toolbar={false} />)
    expect(view.container.querySelector('.rmk-opaque')).not.toBeNull()
    expect(view.container.querySelector('.rmk-opaque-source')?.textContent).toBe('<div>x</div>')
    view.unmount()
  })
})

describe('packaging', () => {
  const manifest = JSON.parse(read('package.json')) as {
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }

  it('declares no styling dependency', () => {
    const names = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]
    const banned = ['@zuilib/', 'tailwindcss', 'styled-components', '@emotion/', 'emotion']
    for (const name of names) {
      for (const pattern of banned) expect(name).not.toContain(pattern)
    }
    expect(Object.keys(manifest.peerDependencies ?? {}).sort()).toEqual([
      '@react-markdown-kit/renderer',
      'react',
      'react-dom',
    ])
  })

  it('ships no icon package', () => {
    const names = Object.keys(manifest.dependencies ?? {})
    expect(names.some((name) => /icon|lucide|heroicons|feather/i.test(name))).toBe(false)
  })

  it('does not route Markdown through @lexical/markdown transformers (audit root cause)', () => {
    const names = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]
    expect(names).not.toContain('@lexical/markdown')
  })

  it('keeps Lexical off the public type path', () => {
    for (const file of ['src/index.ts', 'src/types.ts']) {
      expect(read(file), file).not.toMatch(/from '(lexical|@lexical\/)/)
    }
  })

  it('keeps every stylesheet rule scoped to .rmk-editor', () => {
    const css = read('src/styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toContain('!important')
    for (const block of css.matchAll(/(^|\})([^{}@]+)\{/g)) {
      for (const selector of (block[2] ?? '').split(',')) {
        const trimmed = selector.trim()
        if (trimmed === '') continue
        expect(trimmed.startsWith('.rmk-editor'), trimmed).toBe(true)
      }
    }
  })
})
