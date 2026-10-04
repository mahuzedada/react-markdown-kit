import { describe, expect, it, vi } from 'vitest'
import {
  MarkdownEditor,
  TableOfContents,
  useMarkdownEditorContext,
  type MarkdownEditorInstance,
} from '@react-markdown-kit/editor'
import { button, click, mount, run } from './helpers/mount.js'

const DOCUMENT = '# Guide\n\nIntro\n\n## Install\n\nText\n\n### From npm\n\nMore\n'

const items = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('.rmk-outline-item')].map((item) => item.textContent ?? '')

describe('the editor outline', () => {
  it('lists the headings, indented from the shallowest one', () => {
    const view = mount(<MarkdownEditor defaultValue={DOCUMENT} outline />)
    expect(items(view.container)).toEqual(['Guide', 'Install', 'From npm'])
    const levels = [...view.container.querySelectorAll('.rmk-outline-list li')].map((li) => li.getAttribute('data-rmk-level'))
    expect(levels).toEqual(['0', '1', '2'])
    view.unmount()
  })

  it('follows edits to the document', () => {
    let editor!: MarkdownEditorInstance
    function Capture(): null {
      editor = useMarkdownEditorContext()
      return null
    }
    const view = mount(
      <MarkdownEditor defaultValue="# One" outline>
        <Capture />
      </MarkdownEditor>,
    )
    run(() => editor.commands.setMarkdown('# One\n\n## Two\n'))
    expect(items(view.container)).toEqual(['One', 'Two'])
    view.unmount()
  })

  it('scrolls to the heading it names and leaves the Markdown alone', () => {
    let editor!: MarkdownEditorInstance
    function Capture(): null {
      editor = useMarkdownEditorContext()
      return null
    }
    const view = mount(
      <MarkdownEditor defaultValue={DOCUMENT} outline>
        <Capture />
      </MarkdownEditor>,
    )
    const heading = view.container.querySelector('[contenteditable] h2') as HTMLElement
    heading.scrollIntoView = vi.fn()
    click([...view.container.querySelectorAll('.rmk-outline-item')][1] ?? null)
    expect(heading.scrollIntoView).toHaveBeenCalledOnce()
    expect(editor.getMarkdown()).toBe(DOCUMENT)
    view.unmount()
  })

  it('hides the list behind its toggle and shows only in rich mode', () => {
    const view = mount(<MarkdownEditor defaultValue={DOCUMENT} outline />)
    const toggle = view.container.querySelector('.rmk-outline-toggle') as HTMLButtonElement
    click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(view.container.querySelector('.rmk-outline-list')?.hasAttribute('hidden')).toBe(true)
    click(button(view.container, 'source'))
    expect(view.container.querySelector('.rmk-outline')).toBeNull()
    view.unmount()
  })

  it('is absent unless asked for', () => {
    const view = mount(<MarkdownEditor defaultValue={DOCUMENT} />)
    expect(view.container.querySelector('.rmk-outline')).toBeNull()
    view.unmount()
  })
})

describe('TableOfContents on its own', () => {
  it('renders entries with an href as links and marks the active one', () => {
    const view = mount(
      <TableOfContents
        entries={[
          { id: 'install', text: 'Install', depth: 2, href: '#install' },
          { id: 'usage', text: 'Usage', depth: 2, href: '#usage' },
        ]}
        activeId="usage"
        labels={{ 'outline.title': 'On this page' }}
      />,
    )
    const links = [...view.container.querySelectorAll('a')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#install', '#usage'])
    expect(links[1]?.getAttribute('aria-current')).toBe('location')
    expect(view.container.querySelector('nav')?.getAttribute('aria-label')).toBe('On this page')
    view.unmount()
  })
})
