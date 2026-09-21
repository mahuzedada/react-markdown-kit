/**
 * The React surface (spec 7.1-7.6, 7.10, 7.13).
 *
 * Interaction is driven through the public command API rather than synthetic
 * keystrokes: jsdom has no `beforeinput`/composition implementation, so typing
 * simulation there tests jsdom, not the editor. Every gate below is still the
 * real component tree with a real Lexical editor attached to a real
 * contenteditable element.
 */
import { useState, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  MarkdownEditor,
  MarkdownEditorContent,
  MarkdownEditorProvider,
  useMarkdownEditor,
  useMarkdownEditorContext,
  type MarkdownEditorInstance,
  type MarkdownEditorMode,
} from '@react-markdown-kit/editor'
import { Markdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { button, click, mount, run, runAsync } from './helpers/mount.js'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

/** Captures the instance so a test can drive commands the way a user would. */
function Capture({ onReady }: { onReady: (editor: MarkdownEditorInstance) => void }): null {
  onReady(useMarkdownEditorContext())
  return null
}

describe('controlled and uncontrolled use (spec 7.2)', () => {
  it('starts empty with neither value nor defaultValue', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor>
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    expect(editor.getMarkdown()).toBe('')
    view.unmount()
  })

  it('renders an uncontrolled defaultValue and reports edits', () => {
    const onChange = vi.fn()
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor defaultValue="# Hello" onChange={onChange}>
        <Capture onReady={(value) => (editor = value)} />
      </MarkdownEditor>,
    )
    expect(editor.getMarkdown()).toBe('# Hello')
    expect(view.container.querySelector('h1')?.textContent).toBe('Hello')

    run(() => {
      editor.commands.insertMarkdown('\n\nAdded.')
    })
    expect(onChange).toHaveBeenCalled()
    expect(editor.getMarkdown()).toContain('Added.')
    view.unmount()
  })

  it('honours a controlled value', () => {
    function Controlled(): ReactElement {
      const [value, setValue] = useState('# One')
      return (
        <>
          <MarkdownEditor value={value} onChange={setValue} />
          <button type="button" data-testid="replace" onClick={() => setValue('# Two')}>
            replace
          </button>
        </>
      )
    }
    const view = mount(<Controlled />)
    expect(view.container.querySelector('h1')?.textContent).toBe('One')
    click(view.container.querySelector('[data-testid="replace"]'))
    expect(view.container.querySelector('h1')?.textContent).toBe('Two')
    view.unmount()
  })

  it('warns in development when switching between controlled and uncontrolled', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const view = mount(<MarkdownEditor value="a" onChange={() => undefined} />)
    view.rerender(<MarkdownEditor onChange={() => undefined} />)
    expect(error.mock.calls.flat().join(' ')).toContain('controlled and uncontrolled')
    error.mockRestore()
    view.unmount()
  })
})

describe('controlled echo and document identity (spec 7.10)', () => {
  it('does not reset undo history when the parent echoes the value back', () => {
    let editor!: MarkdownEditorInstance
    function Echoed(): ReactElement {
      const [value, setValue] = useState('Start.')
      return (
        <MarkdownEditor value={value} onChange={setValue}>
          <Capture onReady={(instance) => (editor = instance)} />
        </MarkdownEditor>
      )
    }
    const view = mount(<Echoed />)

    run(() => {
      editor.commands.insertMarkdown('\n\nSecond.')
    })
    expect(editor.getMarkdown()).toContain('Second.')

    // The value the parent echoed is the one the editor emitted, so the
    // document was never reloaded and the edit is still undoable.
    run(() => {
      editor.undo()
    })
    expect(editor.getMarkdown()).not.toContain('Second.')
    view.unmount()
  })

  it('replaces the document and clears history when documentKey changes', () => {
    let editor!: MarkdownEditorInstance
    function Keyed({ id, value }: { id: string; value: string }): ReactElement {
      return (
        <MarkdownEditor documentKey={id} value={value} onChange={() => undefined}>
          <Capture onReady={(instance) => (editor = instance)} />
        </MarkdownEditor>
      )
    }
    const view = mount(<Keyed id="a" value="# Note A" />)
    run(() => {
      editor.commands.insertMarkdown('\n\nEdited.')
    })
    expect(editor.getMarkdown()).toContain('Edited.')

    view.rerender(<Keyed id="b" value="# Note B" />)
    expect(editor.getMarkdown()).toBe('# Note B')
    run(() => {
      editor.undo()
    })
    expect(editor.getMarkdown()).toBe('# Note B')
    view.unmount()
  })
})

describe('modes (spec 7.3, 7.4, 7.9)', () => {
  const source =
    '# Title\n\nBody with `code` and ![img](a.png).\n\n<div class="x">raw</div>\n\n> quote\n>\n> more\n\n3. three\n4. four\n'

  it('round-trips rich -> source -> preview -> rich with the source unchanged', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor preset={preset} defaultValue={source}>
        <Capture onReady={(instance) => (editor = instance)} />
      </MarkdownEditor>,
    )
    expect(editor.getMarkdown()).toBe(source)
    for (const mode of ['source', 'preview', 'rich'] as const) {
      run(() => {
        editor.setMode(mode)
      })
      expect(editor.mode).toBe(mode)
      expect(editor.getMarkdown()).toBe(source)
    }
    view.unmount()
  })

  it('edits made in source mode reach the rich surface', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor preset={preset} defaultMode="source" defaultValue="# One">
        <Capture onReady={(instance) => (editor = instance)} />
      </MarkdownEditor>,
    )
    const textarea = view.container.querySelector('textarea')
    expect(textarea?.value).toBe('# One')
    run(() => {
      const setter = Object.getOwnPropertyDescriptor(
        globalThis.HTMLTextAreaElement.prototype,
        'value',
      )?.set
      setter?.call(textarea, '## Two')
      textarea?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    run(() => {
      editor.setMode('rich')
    })
    expect(editor.getMarkdown()).toBe('## Two')
    expect(view.container.querySelector('h2')?.textContent).toBe('Two')
    view.unmount()
  })

  it('preview output equals standalone <Markdown> for the same source and preset', () => {
    const view = mount(
      <MarkdownEditor preset={preset} defaultMode="preview" defaultValue={source} toolbar={false} />,
    )
    // Both sides render through the DOM so the comparison is of markup, not of
    // React's server-renderer escaping and preload hints.
    const standalone = mount(<Markdown preset={preset}>{source}</Markdown>)
    const preview = view.container.querySelector('[data-rmk-surface="preview"]')
    expect(preview?.innerHTML).toBe(standalone.container.innerHTML)
    expect(preview?.innerHTML).toContain('<h1>Title</h1>')
    standalone.unmount()
    view.unmount()
  })

  it('reports mode changes through onModeChange when controlled', () => {
    const onModeChange = vi.fn()
    function Controlled(): ReactElement {
      const [mode, setMode] = useState<MarkdownEditorMode>('rich')
      return (
        <MarkdownEditor
          defaultValue="# H"
          mode={mode}
          onModeChange={(next) => {
            onModeChange(next)
            setMode(next)
          }}
        />
      )
    }
    const view = mount(<Controlled />)
    click(button(view.container, 'source'))
    expect(onModeChange).toHaveBeenCalledWith('source')
    expect(view.container.querySelector('textarea')).not.toBeNull()
    view.unmount()
  })
})

describe('commands and the default toolbar', () => {
  it('renders semantic buttons with accessible names and pressed state', () => {
    const view = mount(<MarkdownEditor defaultValue="# H" />)
    const bold = button(view.container, 'bold')
    expect(bold.tagName).toBe('BUTTON')
    expect(bold.getAttribute('type')).toBe('button')
    expect(bold.getAttribute('aria-label')).toBe('Bold')
    expect(bold.getAttribute('aria-pressed')).toBe('false')
    expect(view.container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(
      'Formatting',
    )
    expect(view.container.querySelectorAll('svg').length).toBeGreaterThan(5)
    view.unmount()
  })

  it('localizes chrome strings independently of the document', () => {
    const view = mount(
      <MarkdownEditor defaultValue="# H" labels={{ bold: 'Gras', toolbar: 'Mise en forme' }} />,
    )
    expect(button(view.container, 'bold').getAttribute('aria-label')).toBe('Gras')
    expect(view.container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(
      'Mise en forme',
    )
    view.unmount()
  })

  it('removes the toolbar with toolbar={false}', () => {
    const view = mount(<MarkdownEditor defaultValue="# H" toolbar={false} />)
    expect(view.container.querySelector('[role="toolbar"]')).toBeNull()
    view.unmount()
  })

  it('replaces the toolbar with a render prop that receives the items', () => {
    const view = mount(
      <MarkdownEditor
        defaultValue="# H"
        toolbar={(items) => (
          <div data-testid="custom">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={item.run}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      />,
    )
    expect(view.container.querySelector('[data-testid="custom"]')).not.toBeNull()
    expect(view.container.querySelector('[data-rmk-toolbar-item]')).toBeNull()
    view.unmount()
  })

  it('applies block and list commands to the document', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor defaultValue="one">
        <Capture onReady={(instance) => (editor = instance)} />
      </MarkdownEditor>,
    )
    run(() => {
      editor.focus()
      editor.commands.setBlockType('heading2')
    })
    expect(editor.getMarkdown()).toBe('## one\n')
    run(() => {
      editor.commands.setBlockType('paragraph')
      editor.commands.toggleBulletList()
    })
    expect(editor.getMarkdown()).toBe('- one\n')
    run(() => {
      editor.commands.toggleOrderedList()
    })
    expect(editor.getMarkdown()).toBe('1. one\n')
    view.unmount()
  })

  it('inserts images through the application-controlled upload hook (spec 7.8)', async () => {
    let editor!: MarkdownEditorInstance
    const onUploadImage = vi.fn(async () => ({ src: 'https://cdn.test/a.png', alt: 'a' }))
    const view = mount(
      <MarkdownEditor defaultValue="start" onUploadImage={onUploadImage}>
        <Capture onReady={(instance) => (editor = instance)} />
      </MarkdownEditor>,
    )
    run(() => {
      editor.focus()
    })
    await runAsync(() =>
      editor.commands.uploadImage(new File(['x'], 'a.png', { type: 'image/png' })),
    )
    expect(onUploadImage).toHaveBeenCalled()
    expect(editor.getMarkdown()).toContain('![a](https://cdn.test/a.png)')
    expect(editor.getMarkdown()).not.toContain('blob:')
    view.unmount()
  })

  it('rejects an upload when the application has not configured one', async () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor defaultValue="start">
        <Capture onReady={(instance) => (editor = instance)} />
      </MarkdownEditor>,
    )
    await expect(
      editor.commands.uploadImage(new File(['x'], 'a.png', { type: 'image/png' })),
    ).rejects.toThrow(/onUploadImage/)
    view.unmount()
  })
})

describe('headless composition (spec 7.5, 7.13)', () => {
  it('works with a custom toolbar, provider and content, and no default chrome', () => {
    function Custom(): ReactElement {
      const editor = useMarkdownEditor({ preset, defaultValue: '# Headless' })
      return (
        <MarkdownEditorProvider editor={editor}>
          <div data-testid="my-toolbar">
            <button type="button" onClick={() => editor.commands.toggleMark('strong')}>
              Bold
            </button>
            <span data-testid="mode">{editor.mode}</span>
          </div>
          <MarkdownEditorContent aria-label="Notes" />
        </MarkdownEditorProvider>
      )
    }
    const view = mount(<Custom />)
    expect(view.container.querySelector('[data-testid="my-toolbar"]')).not.toBeNull()
    expect(view.container.querySelector('[data-rmk-toolbar-item]')).toBeNull()
    expect(view.container.querySelector('[role="textbox"]')?.getAttribute('aria-label')).toBe(
      'Notes',
    )
    expect(view.container.querySelector('h1')?.textContent).toBe('Headless')
    view.unmount()
  })

  it('throws a helpful error when the context is missing', () => {
    function Orphan(): ReactElement {
      useMarkdownEditorContext()
      return <span />
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => mount(<Orphan />)).toThrow(/MarkdownEditorProvider/)
    error.mockRestore()
  })
})

describe('accessibility and read-only', () => {
  it('exposes the rich surface as a multiline textbox', () => {
    const view = mount(<MarkdownEditor defaultValue="# H" aria-label="Note body" />)
    const surface = view.container.querySelector('[role="textbox"]')
    expect(surface?.getAttribute('aria-multiline')).toBe('true')
    expect(surface?.getAttribute('aria-label')).toBe('Note body')
    expect(surface?.getAttribute('contenteditable')).toBe('true')
    view.unmount()
  })

  it('is not editable when readOnly', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor defaultValue="# H" readOnly>
        <Capture onReady={(instance) => (editor = instance)} />
      </MarkdownEditor>,
    )
    expect(view.container.querySelector('[role="textbox"]')?.getAttribute('contenteditable')).toBe(
      'false',
    )
    expect(editor.readOnly).toBe(true)
    expect(button(view.container, 'bold').disabled).toBe(true)
    view.unmount()
  })
})

describe('extensions resolve per render (audit G9)', () => {
  it('reparses when the dialect changes, instead of being fixed at mount', () => {
    let editor!: MarkdownEditorInstance
    function Dialect({ gfmOn }: { gfmOn: boolean }): ReactElement {
      return (
        <MarkdownEditor extensions={gfmOn ? [gfm()] : []} defaultValue={'a ~~b~~ c\n'}>
          <Capture onReady={(instance) => (editor = instance)} />
        </MarkdownEditor>
      )
    }
    const view = mount(<Dialect gfmOn={false} />)
    expect(view.container.querySelector('.rmk-strikethrough')).toBeNull()
    expect(JSON.stringify(editor.getDocument().tree)).not.toContain('"delete"')

    view.rerender(<Dialect gfmOn />)
    expect(view.container.querySelector('.rmk-strikethrough')?.textContent).toBe('b')
    expect(JSON.stringify(editor.getDocument().tree)).toContain('"delete"')
    // Either way the source survives the dialect change untouched.
    expect(editor.getMarkdown()).toBe('a ~~b~~ c\n')
    view.unmount()
  })
})

describe('placeholder', () => {
  it('shows only while the document is empty, and is hidden from the a11y tree', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor placeholder="Start writing.">
        <Capture onReady={(instance) => (editor = instance)} />
      </MarkdownEditor>,
    )
    const placeholder = view.container.querySelector('.rmk-placeholder')
    expect(placeholder?.textContent).toBe('Start writing.')
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true')

    run(() => {
      editor.focus()
      editor.commands.insertMarkdown('Something')
    })
    expect(view.container.querySelector('.rmk-placeholder')).toBeNull()
    view.unmount()
  })
})

describe('the escape hatch', () => {
  it('exposes the native editor as unknown, so Lexical stays off the type path', () => {
    let editor!: MarkdownEditorInstance
    const view = mount(
      <MarkdownEditor defaultValue="# H">
        <Capture onReady={(instance) => (editor = instance)} />
      </MarkdownEditor>,
    )
    const native: unknown = editor.getNativeEditor()
    expect(native).toBeTypeOf('object')
    expect(native).not.toBeNull()
    view.unmount()
  })
})

describe('announced mode changes (spec 7.12)', () => {
  it('names the active mode in a polite live region', () => {
    const view = mount(<MarkdownEditor defaultValue="# H" />)
    const region = view.container.querySelector('[data-rmk-live-region]')
    expect(region?.getAttribute('role')).toBe('status')
    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(region?.textContent).toBe('Rich text editing')

    click(button(view.container, 'preview'))
    expect(view.container.querySelector('[data-rmk-live-region]')?.textContent).toBe('Preview')
    view.unmount()
  })
})
