import { beforeAll, describe, expect, it } from 'vitest'
import { MarkdownEditor, useMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { mount, run, click } from './helpers/mount.js'

beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect(20,100,140,20)
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
})
describe('contextual formatting', () => {
  it('formats the visible DOM selection when a floating control is clicked', () => {
    let editor!: MarkdownEditorInstance
    function Capture() { editor = useMarkdownEditorContext(); return null }
    const view = mount(<MarkdownEditor defaultValue="Hello world"><Capture/></MarkdownEditor>)
    view.container.querySelector('[contenteditable]')!.parentElement!.getBoundingClientRect = () => new DOMRect(0,0,800,600)
    const text = view.container.querySelector('[contenteditable] p span')!.firstChild!
    run(() => {
      const range = document.createRange()
      range.setStart(text,0); range.setEnd(text,5)
      window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })
    click(view.container.querySelector('[aria-label="Selection formatting"] [aria-label="Bold"]'))
    expect(editor.getMarkdown()).toBe('**Hello** world\n')
    view.unmount()
  })
})
