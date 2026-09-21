/**
 * The interactive deck from `/present`, mounted in jsdom: the first render
 * is the static markup, the Present button opens present mode, keys and
 * pointer move through slides and fragments, Escape leaves, deep links are
 * read and written, keys typed into fields are ignored, two decks on one
 * page stay independent, a sync channel is followed and told, the focus
 * stays where the keys work, an empty deck offers nothing, and the
 * Fullscreen API is used when a browser has it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode, act, createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, defineMarkdownPreset, type MarkdownExtension } from '@react-markdown-kit/renderer'
import { click, mount, type Mounted } from '../../../packages/editor/tests/helpers/mount.js'
import { slides as headlessSlides } from '../src/index.js'
import { slides, SLIDES_LABELS, type SlidesPresentOptions } from '../src/present.js'
import { createDeckArticle } from '../src/present/deck-article.js'
import { inertValue } from '../src/present/sections.js'
import { reduceDeck, INITIAL_DECK_STATE, type DeckShape } from '../src/present/use-deck-state.js'

const DECK = `---
title: Q3 review
---

# Welcome

Hello.

---

<!-- name: numbers -->

## Numbers

Intro.

--

One.

--

Two.

???

say this

---

## Close
`

const TWO = `# One

---

# Two
`

function deckOf(options: SlidesPresentOptions = {}): MarkdownExtension {
  return slides(options)
}

function render(source: string, options: SlidesPresentOptions = {}): Mounted & { rewrite(source: string): void } {
  const preset = defineMarkdownPreset({ extensions: [deckOf(options)] })
  const view = mount(<Markdown preset={preset}>{source}</Markdown>)
  return { ...view, rewrite: (next) => view.rerender(<Markdown preset={preset}>{next}</Markdown>) }
}

function article(view: Mounted): HTMLElement {
  const found = view.container.querySelector<HTMLElement>('article[data-rmk-deck]')
  if (found === null) throw new Error('No deck.')
  return found
}

function action(view: Mounted, name: string): HTMLButtonElement {
  const found = view.container.querySelector<HTMLButtonElement>(`[data-rmk-deck-action="${name}"]`)
  if (found === null) throw new Error(`No ${name} button.`)
  return found
}

function press(target: Element, key: string, init: KeyboardEventInit = {}): boolean {
  let handled = false
  act(() => {
    handled = !target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  })
  return handled
}

function present(view: Mounted): HTMLElement {
  click(action(view, 'present'))
  return article(view)
}

function states(view: Mounted): (string | null)[] {
  return [...view.container.querySelectorAll('[data-rmk-slide]:not([data-rmk-slide-preview])')].map((section) =>
    section.getAttribute('data-rmk-slide-state'),
  )
}

function counter(view: Mounted): string | undefined {
  return view.container.querySelector('[data-rmk-deck-counter]')?.textContent ?? undefined
}

function fragmentStates(view: Mounted): (string | null)[] {
  return [...view.container.querySelectorAll('[data-rmk-slide-state="current"] [data-rmk-fragment]')].map((fragment) =>
    fragment.getAttribute('data-rmk-fragment-state'),
  )
}

const mounted: Mounted[] = []
function keep<T extends Mounted>(view: T): T {
  mounted.push(view)
  return view
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
  history.replaceState(null, '', location.pathname)
})

describe('static output', () => {
  it('renders the same markup as the headless entry on the server', () => {
    const interactive = defineMarkdownPreset({ extensions: [deckOf()] })
    const headless = defineMarkdownPreset({ extensions: [headlessSlides()] })
    const html = renderToStaticMarkup(<Markdown preset={interactive}>{DECK}</Markdown>)
    expect(html).toBe(renderToStaticMarkup(<Markdown preset={headless}>{DECK}</Markdown>))
    expect(html).not.toContain('data-rmk-deck-controls')
    expect(html).not.toContain('data-rmk-deck-mode')
  })

  it('hydrates server markup without a mismatch and then mounts the controls', () => {
    const preset = defineMarkdownPreset({ extensions: [deckOf()] })
    const element = <Markdown preset={preset}>{DECK}</Markdown>
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(element)
    document.body.appendChild(container)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let root!: ReturnType<typeof hydrateRoot>
    act(() => {
      root = hydrateRoot(container, element)
    })
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    expect(container.querySelector('[data-rmk-deck-action="present"]')).not.toBeNull()
    expect(container.querySelector('article')?.getAttribute('data-rmk-deck-mode')).toBe('stack')
    act(() => root.unmount())
    container.remove()
  })

  it('replaces the headless extension in a preset by name', () => {
    const preset = defineMarkdownPreset({ extensions: [headlessSlides(), deckOf()] })
    expect(preset.extensions.map((extension) => extension.name)).toEqual(['slides'])
    expect(preset.extensions[0]?.capabilities?.renderer?.components).toHaveProperty('article')
  })

  it('renders any other <article> as a plain element', () => {
    const DeckArticle = createDeckArticle({})
    expect(renderToStaticMarkup(createElement(DeckArticle, { node: {}, id: 'x' }, 'text'))).toBe('<article id="x">text</article>')
  })
})

describe('the stack', () => {
  it('mounts a Present button and no slide state', () => {
    const view = keep(render(DECK))
    const deck = article(view)
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('stack')
    expect(deck.getAttribute('tabindex')).toBe('-1')
    expect(action(view, 'present').textContent).toBe(SLIDES_LABELS.present)
    expect(view.container.querySelector('[data-rmk-deck-controls]')?.getAttribute('role')).toBe('toolbar')
    expect(states(view)).toEqual([null, null, null])
    expect(view.container.querySelector('[data-rmk-deck-counter]')).toBeNull()
  })

  it('never captures keys', () => {
    const onSlideChange = vi.fn()
    const view = keep(render(DECK, { onSlideChange }))
    expect(press(article(view), 'ArrowRight')).toBe(false)
    expect(onSlideChange).not.toHaveBeenCalled()
    expect(states(view)).toEqual([null, null, null])
  })

  it('renders no controls with controls: false', () => {
    const view = keep(render(DECK, { controls: false }))
    expect(view.container.querySelector('[data-rmk-deck-controls]')).toBeNull()
  })

  it('uses the labels option', () => {
    const view = keep(render(DECK, { labels: { present: 'Play' } }))
    expect(action(view, 'present').textContent).toBe('Play')
  })
})

describe('present mode', () => {
  it('opens from the Present button, focuses the deck and shows the first slide', () => {
    const view = keep(render(DECK))
    const deck = present(view)
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('present')
    expect(document.activeElement).toBe(deck)
    expect(states(view)).toEqual(['current', 'future', 'future'])
    const sections = view.container.querySelectorAll('[data-rmk-slide]')
    expect(sections[0]?.hasAttribute('inert')).toBe(false)
    expect(sections[1]?.hasAttribute('inert')).toBe(true)
    expect(counter(view)).toBe('1 / 3')
    expect(action(view, 'previous').disabled).toBe(true)
    expect(action(view, 'next').disabled).toBe(false)
  })

  it('moves with the buttons', () => {
    const view = keep(render(TWO))
    present(view)
    click(action(view, 'next'))
    expect(states(view)).toEqual(['past', 'current'])
    expect(counter(view)).toBe('2 / 2')
    expect(action(view, 'next').disabled).toBe(true)
    click(action(view, 'previous'))
    expect(states(view)).toEqual(['current', 'future'])
  })

  it('moves with the arrows through fragments then slides, and reports slide changes', () => {
    const onSlideChange = vi.fn()
    const view = keep(render(DECK, { onSlideChange }))
    const deck = present(view)
    expect(press(deck, 'ArrowRight')).toBe(true)
    expect(states(view)).toEqual(['past', 'current', 'future'])
    expect(fragmentStates(view)).toEqual(['hidden', 'hidden'])
    expect(onSlideChange).toHaveBeenLastCalledWith(1)
    press(deck, 'ArrowRight')
    expect(fragmentStates(view)).toEqual(['shown', 'hidden'])
    expect(counter(view)).toBe('2 / 3')
    press(deck, 'ArrowDown')
    expect(fragmentStates(view)).toEqual(['shown', 'shown'])
    press(deck, 'PageDown')
    expect(states(view)).toEqual(['past', 'past', 'current'])
    expect(onSlideChange).toHaveBeenLastCalledWith(2)
    press(deck, 'ArrowRight')
    expect(states(view)).toEqual(['past', 'past', 'current'])
    press(deck, 'ArrowLeft')
    expect(states(view)).toEqual(['past', 'current', 'future'])
    expect(fragmentStates(view)).toEqual(['shown', 'shown'])
    press(deck, 'ArrowUp')
    expect(fragmentStates(view)).toEqual(['shown', 'hidden'])
    press(deck, 'Home')
    expect(states(view)).toEqual(['current', 'future', 'future'])
    press(deck, 'End')
    expect(states(view)).toEqual(['past', 'past', 'current'])
    expect(onSlideChange.mock.calls.map(([index]) => index)).toEqual([1, 2, 1, 0, 2])
  })

  it('takes Space, Shift+Space, j and k', () => {
    const view = keep(render(TWO))
    const deck = present(view)
    press(deck, ' ')
    expect(states(view)).toEqual(['past', 'current'])
    press(deck, ' ', { shiftKey: true })
    expect(states(view)).toEqual(['current', 'future'])
    press(deck, 'j')
    expect(states(view)).toEqual(['past', 'current'])
    press(deck, 'k')
    expect(states(view)).toEqual(['current', 'future'])
  })

  it('leaves on Escape and on the exit button, back to the plain stack', () => {
    const view = keep(render(DECK))
    const deck = present(view)
    press(deck, 'ArrowRight')
    press(deck, 'Escape')
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('stack')
    expect(states(view)).toEqual([null, null, null])
    expect(view.container.querySelector('[inert]')).toBeNull()
    expect(view.container.querySelector('[data-rmk-fragment-state]')).toBeNull()
    click(action(view, 'present'))
    expect(states(view)).toEqual(['past', 'current', 'future'])
    click(action(view, 'exit'))
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('stack')
  })

  it('ignores keys with modifiers and keys typed into a field', () => {
    const view = keep(render(TWO))
    const deck = present(view)
    expect(press(deck, 'ArrowRight', { ctrlKey: true })).toBe(false)
    expect(press(deck, 'ArrowRight', { metaKey: true })).toBe(false)
    expect(press(deck, 'j', { shiftKey: true })).toBe(false)
    const input = document.createElement('input')
    deck.appendChild(input)
    expect(press(input, 'ArrowRight')).toBe(false)
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    const inner = document.createElement('span')
    editable.appendChild(inner)
    deck.appendChild(editable)
    expect(press(inner, ' ')).toBe(false)
    expect(states(view)).toEqual(['current', 'future'])
  })

  it('leaves Space and Enter on a focused control to the browser, which activates it', () => {
    const view = keep(render(TWO))
    present(view)
    click(action(view, 'next'))
    expect(states(view)).toEqual(['past', 'current'])
    const previous = action(view, 'previous')
    previous.focus()
    expect(press(previous, ' ')).toBe(false)
    expect(press(previous, 'Enter')).toBe(false)
    expect(states(view)).toEqual(['past', 'current'])
    expect(press(previous, ' ', { shiftKey: true })).toBe(false)
    // Arrows on the control still move the deck.
    expect(press(previous, 'ArrowLeft')).toBe(true)
    expect(states(view)).toEqual(['current', 'future'])
    // A link the author put in a slide is activated by Enter, not captured.
    const link = document.createElement('a')
    link.href = '#somewhere'
    article(view).querySelector('[data-rmk-slide-state="current"] [data-rmk-slide-body]')?.appendChild(link)
    expect(press(link, 'Enter')).toBe(false)
    expect(press(link, ' ')).toBe(false)
    expect(states(view)).toEqual(['current', 'future'])
  })

  it('moves on a click in the right half and back in the left half, not on controls', () => {
    const view = keep(render(TWO))
    const deck = present(view)
    deck.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    const clickAt = (target: Element, clientX: number): void => {
      act(() => {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY: 300 }))
      })
    }
    clickAt(deck, 900)
    expect(states(view)).toEqual(['past', 'current'])
    clickAt(deck, 100)
    expect(states(view)).toEqual(['current', 'future'])
    clickAt(action(view, 'presenter'), 900)
    expect(article(view).getAttribute('data-rmk-deck-mode')).toBe('presenter')
    expect(states(view)).toEqual(['current', 'future'])
  })

  it('moves on a horizontal swipe longer than 40 px and swallows the click that follows', () => {
    // jsdom has no PointerEvent; a MouseEvent carries the same coordinates.
    vi.stubGlobal('PointerEvent', MouseEvent)
    const view = keep(render(TWO))
    const deck = present(view)
    deck.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    const swipe = (from: number, to: number): void => {
      act(() => {
        deck.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: from, clientY: 300 }))
        deck.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: to, clientY: 310 }))
        deck.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: to, clientY: 310 }))
      })
    }
    swipe(800, 700)
    expect(states(view)).toEqual(['past', 'current'])
    // A 30 px drag is a tap: the click in the left half goes back.
    swipe(100, 130)
    expect(states(view)).toEqual(['current', 'future'])
    swipe(700, 600)
    expect(states(view)).toEqual(['past', 'current'])
    swipe(200, 600)
    expect(states(view)).toEqual(['current', 'future'])
    vi.unstubAllGlobals()
  })

  it('does not lose the tap that follows a touch swipe, which fires no click', () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    const view = keep(render(TWO))
    const deck = present(view)
    deck.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    const pan = (from: number, to: number): void => {
      act(() => {
        deck.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: from, clientY: 300 }))
        deck.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: to, clientY: 300 }))
      })
    }
    const tap = (at: number): void => {
      pan(at, at)
      act(() => {
        deck.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: at, clientY: 300 }))
      })
    }
    pan(800, 600)
    expect(states(view)).toEqual(['past', 'current'])
    tap(100)
    expect(states(view)).toEqual(['current', 'future'])
    tap(900)
    expect(states(view)).toEqual(['past', 'current'])
    vi.unstubAllGlobals()
  })

  it('opens at mount with initialMode: present', () => {
    const view = keep(render(TWO, { initialMode: 'present' }))
    expect(article(view).getAttribute('data-rmk-deck-mode')).toBe('present')
    expect(states(view)).toEqual(['current', 'future'])
  })

  it('opens at mount with initialMode: presenter, at the deep-linked slide', () => {
    const view = keep(render(TWO, { initialMode: 'presenter' }))
    expect(article(view).getAttribute('data-rmk-deck-mode')).toBe('presenter')
    expect(article(view).querySelector('[data-rmk-deck-presenter]')).not.toBeNull()
    expect(states(view)).toEqual(['current', 'future'])
    view.unmount()
    location.hash = '#2'
    const linked = keep(render(TWO, { initialMode: 'presenter', hashRouting: true }))
    expect(article(linked).getAttribute('data-rmk-deck-mode')).toBe('presenter')
    expect(states(linked)).toEqual(['past', 'current'])
  })

  it('fades the controls after 2.5 s without pointer movement', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const view = keep(render(TWO))
      const deck = present(view)
      expect(deck.hasAttribute('data-rmk-deck-idle')).toBe(false)
      act(() => {
        vi.advanceTimersByTime(2500)
      })
      expect(deck.hasAttribute('data-rmk-deck-idle')).toBe(true)
      act(() => {
        deck.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }))
      })
      expect(deck.hasAttribute('data-rmk-deck-idle')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('presenter view', () => {
  it('toggles with p and shows the next slide, the notes and a clock', () => {
    const view = keep(render(DECK))
    const deck = present(view)
    press(deck, 'p')
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('presenter')
    const panel = view.container.querySelector('[data-rmk-deck-presenter]')
    expect(panel).not.toBeNull()
    const preview = panel?.querySelector('[data-rmk-slide-preview]')
    expect(preview?.getAttribute('data-rmk-slide')).toBe('2')
    expect(preview?.hasAttribute('id')).toBe(false)
    expect(document.querySelectorAll('#slide-numbers')).toHaveLength(1)
    expect(panel?.querySelector('[data-rmk-deck-notes] [data-rmk-slide-notes]')).toBeNull()
    expect(panel?.querySelector('[data-rmk-deck-clock]')?.textContent).not.toBe('')
    press(deck, 'ArrowRight')
    const notes = panel?.querySelector('[data-rmk-deck-notes] [data-rmk-slide-notes]')
    expect(notes?.hasAttribute('hidden')).toBe(false)
    expect(notes?.textContent).toBe('say this')
    expect(panel?.querySelector('[data-rmk-slide-preview]')?.getAttribute('data-rmk-slide')).toBe('3')
    expect(action(view, 'presenter').getAttribute('aria-pressed')).toBe('true')
    press(deck, 'p')
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('present')
    expect(view.container.querySelector('[data-rmk-deck-presenter]')).toBeNull()
  })
})

describe('deep links', () => {
  it('opens present mode at #N, #name and #slide-name when hashRouting is on', () => {
    for (const hash of ['#2', '#numbers', '#slide-numbers']) {
      location.hash = hash
      const view = render(DECK, { hashRouting: true })
      expect(article(view).getAttribute('data-rmk-deck-mode')).toBe('present')
      expect(states(view)).toEqual(['past', 'current', 'future'])
      view.unmount()
    }
    location.hash = '#9'
    const view = keep(render(DECK, { hashRouting: true }))
    expect(article(view).getAttribute('data-rmk-deck-mode')).toBe('stack')
  })

  it('writes #N while presenting and ignores the hash otherwise', () => {
    const view = keep(render(DECK, { hashRouting: true }))
    expect(location.hash).toBe('')
    const deck = present(view)
    expect(location.hash).toBe('#1')
    press(deck, 'End')
    expect(location.hash).toBe('#3')
    view.unmount()
    mounted.splice(0)
    location.hash = '#2'
    const plain = keep(render(DECK))
    expect(article(plain).getAttribute('data-rmk-deck-mode')).toBe('stack')
    const deck2 = present(plain)
    press(deck2, 'ArrowRight')
    expect(location.hash).toBe('#2')
    expect(states(plain)).toEqual(['past', 'current', 'future'])
  })
})

describe('two decks on one page', () => {
  it('present, move and leave independently', () => {
    const first = keep(render(TWO))
    const second = keep(render(DECK))
    const deck = present(first)
    press(deck, 'ArrowRight')
    expect(states(first)).toEqual(['past', 'current'])
    expect(article(second).getAttribute('data-rmk-deck-mode')).toBe('stack')
    expect(states(second)).toEqual([null, null, null])
    expect(press(article(second), 'ArrowRight')).toBe(false)
    present(second)
    expect(states(first)).toEqual(['past', 'current'])
    expect(states(second)).toEqual(['current', 'future', 'future'])
    press(deck, 'Escape')
    expect(article(first).getAttribute('data-rmk-deck-mode')).toBe('stack')
    expect(article(second).getAttribute('data-rmk-deck-mode')).toBe('present')
  })
})

describe('sync', () => {
  class FakeChannel {
    static instances: FakeChannel[] = []
    readonly posted: unknown[] = []
    onmessage: ((event: { data: unknown }) => void) | null = null
    closed = false
    constructor(readonly name: string) {
      FakeChannel.instances.push(this)
    }
    postMessage(data: unknown): void {
      this.posted.push(data)
    }
    close(): void {
      this.closed = true
    }
    receive(data: unknown): void {
      act(() => {
        this.onmessage?.({ data })
      })
    }
  }

  beforeEach(() => {
    FakeChannel.instances = []
    vi.stubGlobal('BroadcastChannel', FakeChannel)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks on open, posts local moves, follows remote ones without echoing, answers an ask', () => {
    const view = keep(render(DECK, { sync: 'deck' }))
    const channel = FakeChannel.instances[0]
    if (channel === undefined) throw new Error('No channel opened.')
    expect(channel.name).toBe('deck')
    expect(channel.posted).toEqual([{ ask: true }])
    const deck = present(view)
    press(deck, 'ArrowRight')
    expect(channel.posted).toEqual([{ ask: true }, { index: 1, fragment: 0 }])
    channel.receive({ index: 2, fragment: 0 })
    expect(states(view)).toEqual(['past', 'past', 'current'])
    expect(channel.posted).toHaveLength(2)
    channel.receive({ index: 1, fragment: 2 })
    expect(states(view)).toEqual(['past', 'current', 'future'])
    expect(fragmentStates(view)).toEqual(['shown', 'shown'])
    channel.receive({ nonsense: true })
    expect(states(view)).toEqual(['past', 'current', 'future'])
    channel.receive({ ask: true })
    expect(channel.posted.at(-1)).toEqual({ index: 1, fragment: 2 })
    view.unmount()
    mounted.splice(0)
    expect(channel.closed).toBe(true)
  })

  it('broadcasts a local move back to the last received position', () => {
    const view = keep(render(DECK, { sync: 'deck' }))
    const channel = FakeChannel.instances[0]
    if (channel === undefined) throw new Error('No channel opened.')
    const deck = present(view)
    channel.receive({ index: 2, fragment: 0 })
    expect(states(view)).toEqual(['past', 'past', 'current'])
    expect(channel.posted).toEqual([{ ask: true }])
    press(deck, 'ArrowLeft')
    expect(channel.posted.at(-1)).toEqual({ index: 1, fragment: 2 })
    press(deck, 'ArrowRight')
    expect(channel.posted.at(-1)).toEqual({ index: 2, fragment: 0 })
    expect(channel.posted).toHaveLength(3)
    // And back again, through the same position a second time.
    press(deck, 'ArrowLeft')
    press(deck, 'ArrowRight')
    expect(channel.posted).toHaveLength(5)
    expect(channel.posted.at(-1)).toEqual({ index: 2, fragment: 0 })
  })

  it('posts no position on mount, also under StrictMode double effects', () => {
    const preset = defineMarkdownPreset({ extensions: [deckOf({ sync: 'deck' })] })
    const view = keep(
      mount(
        <StrictMode>
          <Markdown preset={preset}>{DECK}</Markdown>
        </StrictMode>,
      ),
    )
    expect(FakeChannel.instances.length).toBeGreaterThan(0)
    for (const channel of FakeChannel.instances) expect(channel.posted).toEqual([{ ask: true }])
    const deck = present(view)
    press(deck, 'ArrowRight')
    const open = FakeChannel.instances.find((channel) => !channel.closed)
    expect(open?.posted).toEqual([{ ask: true }, { index: 1, fragment: 0 }])
  })

  it('opens no channel without the option or without BroadcastChannel', () => {
    keep(render(TWO))
    expect(FakeChannel.instances).toHaveLength(0)
    vi.stubGlobal('BroadcastChannel', undefined)
    const view = keep(render(TWO, { sync: 'deck' }))
    expect(FakeChannel.instances).toHaveLength(0)
    const deck = present(view)
    press(deck, 'ArrowRight')
    expect(states(view)).toEqual(['past', 'current'])
  })
})

describe('focus', () => {
  it('takes the focus back when the slide that held it goes off stage', () => {
    const view = keep(render(DECK))
    const deck = present(view)
    const link = document.createElement('a')
    link.href = '#somewhere'
    const first = view.container.querySelector('[data-rmk-slide="1"] [data-rmk-slide-body]')
    if (first === null) throw new Error('No first slide body.')
    first.appendChild(link)
    link.focus()
    expect(document.activeElement).toBe(link)
    press(link, 'ArrowRight')
    expect(states(view)).toEqual(['past', 'current', 'future'])
    expect(document.activeElement).toBe(deck)
    expect(press(deck, 'ArrowLeft')).toBe(true)
    expect(states(view)).toEqual(['current', 'future', 'future'])
    // A browser that had already blurred to the body is handled the same way.
    link.focus()
    press(link, 'End')
    if (document.activeElement !== deck) throw new Error('Deck not focused.')
    expect(press(deck, 'Escape')).toBe(true)
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('stack')
  })

  it('leaves the focus on a control the presenter is using', () => {
    const view = keep(render(TWO))
    present(view)
    const next = action(view, 'next')
    next.focus()
    click(next)
    expect(states(view)).toEqual(['past', 'current'])
    expect(document.activeElement).toBe(next)
  })

  it('keeps the focus in the deck after the Exit button, which removes itself', () => {
    const view = keep(render(TWO))
    const deck = present(view)
    const exit = action(view, 'exit')
    exit.focus()
    click(exit)
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('stack')
    expect(document.activeElement).toBe(deck)
    // From the deck, the next Tab stop is the Present button.
    expect(deck.querySelector('button')).toBe(action(view, 'present'))
  })
})

describe('an empty deck', () => {
  it('offers no controls and refuses to present', () => {
    const view = keep(render(''))
    expect(article(view).getAttribute('data-rmk-deck-slides')).toBe('0')
    expect(article(view).getAttribute('data-rmk-deck-mode')).toBe('stack')
    expect(view.container.querySelector('[data-rmk-deck-controls]')).toBeNull()
    const opened = keep(render('', { initialMode: 'present' }))
    expect(article(opened).getAttribute('data-rmk-deck-mode')).toBe('stack')
  })

  it('leaves present mode when the slides are removed under it, and returns when they come back', () => {
    const view = keep(render(DECK))
    const deck = present(view)
    press(deck, 'End')
    expect(counter(view)).toBe('3 / 3')
    view.rewrite(TWO)
    expect(article(view).getAttribute('data-rmk-deck-mode')).toBe('present')
    expect(counter(view)).toBe('2 / 2')
    view.rewrite('')
    expect(article(view).getAttribute('data-rmk-deck-mode')).toBe('stack')
    expect(view.container.querySelector('[data-rmk-deck-controls]')).toBeNull()
    view.rewrite(TWO)
    expect(article(view).getAttribute('data-rmk-deck-mode')).toBe('stack')
    present(view)
    expect(states(view)).toEqual(['current', 'future'])
  })
})

describe('inert', () => {
  it('writes the attribute with the value the running React needs', () => {
    expect(inertValue('19.3.0')).toBe(true)
    expect(inertValue('20.0.0-canary')).toBe(true)
    expect(inertValue('18.3.1')).toBe('')
    const view = keep(render(DECK))
    present(view)
    click(action(view, 'presenter'))
    const sections = [...view.container.querySelectorAll('[data-rmk-slide]')]
    expect(sections.map((section) => section.getAttribute('inert'))).toEqual([null, '', '', ''])
    expect(view.container.querySelector('[data-rmk-slide-preview]')?.getAttribute('inert')).toBe('')
  })
})

describe('fullscreen', () => {
  it('offers no button where the API is missing', () => {
    const view = keep(render(TWO))
    const deck = present(view)
    expect(view.container.querySelector('[data-rmk-deck-action="fullscreen"]')).toBeNull()
    expect(press(deck, 'f')).toBe(true)
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('present')
  })

  it('requests fullscreen on the deck with f and the button, and leaves it with the deck', () => {
    const request = vi.fn(() => Promise.resolve())
    const exit = vi.fn(() => Promise.resolve())
    let element: Element | null = null
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: request })
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit })
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element })
    try {
      const view = keep(render(TWO))
      const deck = present(view)
      expect(action(view, 'fullscreen').textContent).toBe(SLIDES_LABELS.fullscreen)
      press(deck, 'f')
      expect(request).toHaveBeenCalledTimes(1)
      expect(request.mock.instances[0]).toBe(deck)
      element = deck
      press(deck, 'f')
      expect(exit).toHaveBeenCalledTimes(1)
      element = null
      click(action(view, 'fullscreen'))
      expect(request).toHaveBeenCalledTimes(2)
      element = deck
      press(deck, 'Escape')
      expect(exit).toHaveBeenCalledTimes(2)
      expect(deck.getAttribute('data-rmk-deck-mode')).toBe('stack')
    } finally {
      delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen
      delete (document as { exitFullscreen?: unknown }).exitFullscreen
      delete (document as { fullscreenElement?: unknown }).fullscreenElement
    }
  })
})

describe('reduceDeck', () => {
  const shape: DeckShape = { count: 3, fragments: [0, 2, 0] }

  it('returns the same state for a move that changes nothing', () => {
    const state = { ...INITIAL_DECK_STATE, mode: 'present' as const }
    expect(reduceDeck(state, { type: 'previous' }, shape)).toBe(state)
    expect(reduceDeck(state, { type: 'goto', index: 0 }, shape)).toBe(state)
    expect(reduceDeck(state, { type: 'enter', mode: 'present' }, shape)).toBe(state)
    expect(reduceDeck(INITIAL_DECK_STATE, { type: 'exit' }, shape)).toBe(INITIAL_DECK_STATE)
    expect(reduceDeck(INITIAL_DECK_STATE, { type: 'toggle-presenter' }, shape)).toBe(INITIAL_DECK_STATE)
  })

  it('refuses to enter an empty deck and leaves one that becomes empty', () => {
    const empty: DeckShape = { count: 0, fragments: [] }
    expect(reduceDeck(INITIAL_DECK_STATE, { type: 'enter', mode: 'present' }, empty)).toBe(INITIAL_DECK_STATE)
    expect(reduceDeck(INITIAL_DECK_STATE, { type: 'enter', mode: 'presenter', index: 2 }, empty)).toBe(INITIAL_DECK_STATE)
    expect(reduceDeck({ mode: 'present', index: 2, fragment: 1 }, { type: 'clamp' }, empty)).toEqual(INITIAL_DECK_STATE)
    expect(reduceDeck(INITIAL_DECK_STATE, { type: 'clamp' }, empty)).toBe(INITIAL_DECK_STATE)
    expect(reduceDeck({ mode: 'present', index: 2, fragment: 0 }, { type: 'clamp' }, shape).mode).toBe('present')
  })

  it('clamps out-of-range targets', () => {
    expect(reduceDeck(INITIAL_DECK_STATE, { type: 'goto', index: 9, fragment: 9 }, shape)).toEqual({ mode: 'stack', index: 2, fragment: 0 })
    expect(reduceDeck(INITIAL_DECK_STATE, { type: 'goto', index: 1, fragment: 9 }, shape)).toEqual({ mode: 'stack', index: 1, fragment: 2 })
    expect(reduceDeck({ mode: 'stack', index: 5, fragment: 0 }, { type: 'clamp' }, shape)).toEqual({ mode: 'stack', index: 2, fragment: 0 })
    expect(reduceDeck(INITIAL_DECK_STATE, { type: 'last' }, { count: 0, fragments: [] })).toEqual(INITIAL_DECK_STATE)
  })
})
