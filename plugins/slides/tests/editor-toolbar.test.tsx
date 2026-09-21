/**
 * The deck inside <MarkdownEditor>: the rich surface shows breaks, markers
 * and chips as the plugin's nodes (a break nested in a quote as a rule),
 * the toolbar gains the four `slides` buttons (disabled outside rich mode,
 * relabelled through `labels`), the Background button opens a chip that
 * edits inline with no browser dialog and hands focus back to the surface,
 * one undo takes a committed draft out again, and Preview is the
 * interactive deck.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MarkdownEditor, useMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { button, click, mount, run } from '../../../packages/editor/tests/helpers/mount.js'
import { slides } from '../src/editor.js'

// Once the surface holds focus, Lexical measures the caret's range to scroll
// it into view; jsdom lays nothing out and has no Range.getBoundingClientRect.
const NO_RECT = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect
const rangeRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => NO_RECT
})
afterAll(() => {
  if (rangeRect === undefined) delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect
  else Object.defineProperty(Range.prototype, 'getBoundingClientRect', rangeRect)
})

const DECK = `# One

<!-- class: center -->

Hello.

--

More.

???

Say this.

---

# Two
`

function Capture({ onReady }: { onReady: (editor: MarkdownEditorInstance) => void }): null {
  onReady(useMarkdownEditorContext())
  return null
}

function open(value = DECK, props: { readonly defaultMode?: 'rich' | 'source' | 'preview'; readonly readOnly?: boolean } = {}) {
  let editor!: MarkdownEditorInstance
  const view = mount(
    <MarkdownEditor extensions={[slides()]} defaultValue={value} {...props}>
      <Capture onReady={(value) => (editor = value)} />
    </MarkdownEditor>,
  )
  return { view, editor }
}

function key(element: Element, key: string): void {
  run(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

function directiveInput(container: HTMLElement, key: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`[data-rmk-slide-directive="${key}"] input`)
  if (input === null) throw new Error(`No open ${key} chip.`)
  return input
}

describe('slides() in <MarkdownEditor>', () => {
  it('renders breaks, markers and chips as the plugin nodes', () => {
    const { view, editor } = open()
    const { container } = view
    expect(container.querySelectorAll('[data-rmk-slide-break="slide"]')).toHaveLength(1)
    expect(container.querySelector('[data-rmk-slide-break="slide"] hr')?.getAttribute('aria-label')).toBe('Slide break')
    expect(container.querySelector('[data-rmk-slide-marker="pause"]')?.textContent).toBe('Pause')
    expect(container.querySelector('[data-rmk-slide-marker="notes"]')?.textContent).toBe('Speaker notes')
    const chip = container.querySelector('[data-rmk-slide-directive="class"]')
    expect(chip?.getAttribute('contenteditable')).toBe('false')
    expect(chip?.querySelector('[data-rmk-slide-directive-key]')?.textContent).toBe('class:')
    expect(chip?.querySelector('button')?.textContent).toBe('center')
    expect(container.querySelector('[data-rmk-thematic-break]')).toBeNull()
    expect(editor.getMarkdown()).toBe(DECK)
    view.unmount()
  })

  it('names a chip\'s value button by its key and its value', () => {
    const { view } = open()
    const button = view.container.querySelector('[data-rmk-slide-directive="class"] button')
    expect(button?.getAttribute('aria-label')).toBe('class directive: center')
    expect(button?.textContent).toBe('center')
    view.unmount()
  })

  it('numbers only root-level slide breaks; one nested in a quote is a rule', () => {
    const source = '# One\n\n> quote\n>\n> ---\n>\n> more\n\n---\n\n# Two\n'
    const { view, editor } = open(source)
    expect(view.container.querySelectorAll('[data-rmk-slide-break="slide"]')).toHaveLength(1)
    const nested = view.container.querySelector('[data-rmk-slide-break="rule"]')
    expect(nested?.closest('blockquote, [data-rmk-blockquote]')).not.toBeNull()
    expect(nested?.querySelector('hr')?.getAttribute('aria-label')).toBe('Rule')
    expect(editor.getMarkdown()).toBe(source)
    view.unmount()
    const preview = open(source, { defaultMode: 'preview' })
    expect(preview.view.container.querySelector('[data-rmk-deck]')?.getAttribute('data-rmk-deck-slides')).toBe('2')
    preview.view.unmount()
  })

  it('contributes four labelled buttons in the slides group', () => {
    const { view } = open()
    const labels = ['slide', 'slideNotes', 'slidePause', 'slideBackground'].map((id) => button(view.container, id).getAttribute('aria-label'))
    expect(labels).toEqual(['New slide', 'Speaker notes', 'Pause', 'Background'])
    const group = button(view.container, 'slide').parentElement
    expect(group?.querySelectorAll('button')).toHaveLength(4)
    expect(group?.contains(button(view.container, 'slideBackground'))).toBe(true)
    view.unmount()
  })

  it('New slide, Speaker notes and Pause append their spelling', () => {
    const { view, editor } = open('# One\n\nHello.\n')
    click(button(view.container, 'slide'))
    expect(editor.getMarkdown()).toBe('# One\n\nHello.\n\n---\n')
    expect(view.container.querySelectorAll('[data-rmk-slide-break="slide"]')).toHaveLength(1)
    click(button(view.container, 'slideNotes'))
    expect(editor.getMarkdown()).toBe('# One\n\nHello.\n\n---\n\n???\n')
    click(button(view.container, 'slidePause'))
    expect(editor.getMarkdown()).toBe('# One\n\nHello.\n\n---\n\n???\n\n--\n')
    expect(view.container.querySelectorAll('[data-rmk-slide-marker]')).toHaveLength(2)
    view.unmount()
  })

  it('Background opens a chip whose input commits on Enter, with no dialog', () => {
    const { view, editor } = open('# One\n')
    click(button(view.container, 'slideBackground'))
    const input = directiveInput(view.container, 'background')
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-label')).toBe('background directive')
    input.value = 'https://example.com/bg.jpg'
    key(input, 'Enter')
    expect(editor.getMarkdown()).toBe('# One\n\n<!-- background: https://example.com/bg.jpg -->\n')
    expect(view.container.querySelector('[data-rmk-slide-directive="background"] input')).toBeNull()
    expect(view.container.querySelector('[data-rmk-slide-directive="background"] button')?.textContent).toBe('https://example.com/bg.jpg')
    view.unmount()
  })

  it('keeps an invalid value in the field and never writes it', () => {
    const { view, editor } = open('# One\n')
    click(button(view.container, 'slideBackground'))
    const input = directiveInput(view.container, 'background')
    input.value = 'two words'
    key(input, 'Enter')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('title')).toBe('Expected one URL with no spaces.')
    // The open draft is in the document; the rejected value never is.
    expect(editor.getMarkdown()).toBe('# One\n\n<!-- background:  -->\n')
    key(input, 'Escape')
    expect(editor.getMarkdown()).toBe('# One\n')
    view.unmount()
  })

  it('one undo takes a committed draft out again, and redo brings it back', () => {
    const { view, editor } = open('# One\n')
    click(button(view.container, 'slideBackground'))
    const input = directiveInput(view.container, 'background')
    input.value = 'https://example.com/bg.jpg'
    key(input, 'Enter')
    expect(editor.getMarkdown()).toBe('# One\n\n<!-- background: https://example.com/bg.jpg -->\n')
    run(() => editor.undo())
    expect(editor.getMarkdown()).toBe('# One\n')
    expect(view.container.querySelector('[data-rmk-slide-directive]')).toBeNull()
    run(() => editor.redo())
    expect(editor.getMarkdown()).toBe('# One\n\n<!-- background: https://example.com/bg.jpg -->\n')
    expect(view.container.querySelector('[data-rmk-slide-directive="background"] input')).toBeNull()
    view.unmount()
  })

  it('a chip whose value is emptied again is an open draft, never a closed empty chip', () => {
    const { view, editor } = open('# One\n')
    click(button(view.container, 'slideBackground'))
    key(directiveInput(view.container, 'background'), 'Escape')
    expect(editor.getMarkdown()).toBe('# One\n')
    // Undoing the cancel does not resurrect the empty draft.
    run(() => editor.undo())
    expect(editor.getMarkdown()).toBe('# One\n')
    expect(view.container.querySelector('[data-rmk-slide-directive]')).toBeNull()
    view.unmount()
  })

  it('hands focus back to the surface when the field closes by keyboard', () => {
    const { view, editor } = open()
    const surface = view.container.querySelector('[contenteditable="true"]')
    click(view.container.querySelector('[data-rmk-slide-directive="class"] button'))
    const input = directiveInput(view.container, 'class')
    expect(document.activeElement).toBe(input)
    input.value = 'inverse'
    key(input, 'Enter')
    expect(document.activeElement).toBe(surface)
    expect(editor.getMarkdown()).toBe(DECK.replace('<!-- class: center -->', '<!-- class: inverse -->'))

    click(view.container.querySelector('[data-rmk-slide-directive="class"] button'))
    key(directiveInput(view.container, 'class'), 'Escape')
    expect(document.activeElement).toBe(surface)

    click(button(view.container, 'slideBackground'))
    const draft = directiveInput(view.container, 'background')
    draft.value = 'https://example.com/bg.jpg'
    key(draft, 'Enter')
    expect(document.activeElement).toBe(surface)
    click(button(view.container, 'slideBackground'))
    key(directiveInput(view.container, 'background'), 'Escape')
    expect(document.activeElement).toBe(surface)
    view.unmount()
  })

  it('Escape on an empty draft removes the chip', () => {
    const { view, editor } = open('# One\n')
    click(button(view.container, 'slideBackground'))
    key(directiveInput(view.container, 'background'), 'Escape')
    expect(view.container.querySelector('[data-rmk-slide-directive="background"]')).toBeNull()
    expect(editor.getMarkdown()).toBe('# One\n')
    view.unmount()
  })

  it('clicking an existing chip edits its value in place', () => {
    const { view, editor } = open()
    click(view.container.querySelector('[data-rmk-slide-directive="class"] button'))
    const input = directiveInput(view.container, 'class')
    expect(input.value).toBe('center')
    input.value = 'center, inverse'
    key(input, 'Enter')
    expect(editor.getMarkdown()).toBe(DECK.replace('<!-- class: center -->', '<!-- class: center, inverse -->'))
    view.unmount()
  })

  it('Escape on an existing chip keeps its value', () => {
    const { view, editor } = open()
    click(view.container.querySelector('[data-rmk-slide-directive="class"] button'))
    const input = directiveInput(view.container, 'class')
    input.value = 'right'
    key(input, 'Escape')
    expect(view.container.querySelector('[data-rmk-slide-directive="class"] input')).toBeNull()
    expect(editor.getMarkdown()).toBe(DECK)
    view.unmount()
  })

  it('disables the four buttons outside rich mode and read-only', () => {
    const source = open(DECK, { defaultMode: 'source' })
    for (const id of ['slide', 'slideNotes', 'slidePause', 'slideBackground']) expect(button(source.view.container, id).disabled).toBe(true)
    source.view.unmount()
    const readOnly = open(DECK, { readOnly: true })
    expect(button(readOnly.view.container, 'slide').disabled).toBe(true)
    // A read-only chip has no button to open.
    expect(readOnly.view.container.querySelector('[data-rmk-slide-directive="class"] button')).toBeNull()
    expect(readOnly.view.container.querySelector('[data-rmk-slide-directive="class"] [data-rmk-slide-directive-value]')?.textContent).toBe('center')
    readOnly.view.unmount()
  })

  it('Preview is the deck', () => {
    const { view } = open(DECK, { defaultMode: 'preview' })
    const deck = view.container.querySelector('[data-rmk-deck]')
    expect(deck).not.toBeNull()
    expect(deck?.getAttribute('data-rmk-deck-slides')).toBe('2')
    expect(view.container.querySelectorAll('[data-rmk-slide]')).toHaveLength(2)
    view.unmount()
  })

  it('takes button labels from `labels` and node labels from `slides.*` or `editorLabels`', () => {
    const view = mount(
      <MarkdownEditor
        extensions={[slides({ editorLabels: { pause: 'Pausa' } })]}
        defaultValue={DECK}
        labels={{ slide: 'Neue Folie', 'slides.notes': 'Notizen' }}
      />,
    )
    expect(button(view.container, 'slide').getAttribute('aria-label')).toBe('Neue Folie')
    expect(view.container.querySelector('[data-rmk-slide-marker="notes"]')?.textContent).toBe('Notizen')
    expect(view.container.querySelector('[data-rmk-slide-marker="pause"]')?.textContent).toBe('Pausa')
    view.unmount()
  })
})
