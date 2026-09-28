/**
 * Present mode beyond moving through slides: the overview, the help list,
 * the black screen, jumping by number, pointer tools, stepped code and
 * incremental lists, the presenter's timer and notes, the controller and a
 * custom control bar, a custom sync transport, following a streaming deck,
 * printed steps, and step deep links.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, type ReactElement } from 'react'
import { Markdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { click, mount, type Mounted } from '../../../packages/editor/tests/helpers/mount.js'
import { createDeckController, slides, type DeckControlsProps, type SlidesPresentOptions, type SyncTransport } from '../src/present.js'

const DECK = `# One

---

## Two

<!-- incremental: true -->

- a
- b

---

## Three

\`\`\`ts {1|2}
const a = 1
const b = 2
\`\`\`

???

Remember the second line.
`

const mounted: Mounted[] = []

function render(source: string, options: SlidesPresentOptions = {}): Mounted & { rewrite(source: string): void } {
  const preset = defineMarkdownPreset({ extensions: [slides(options)] })
  const view = mount(<Markdown preset={preset}>{source}</Markdown>)
  mounted.push(view)
  return { ...view, rewrite: (next) => view.rerender(<Markdown preset={preset}>{next}</Markdown>) }
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
  history.replaceState(null, '', location.pathname)
})

function deckOf(view: Mounted): HTMLElement {
  return view.container.querySelector<HTMLElement>('article[data-rmk-deck]')!
}

function press(target: Element, key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  })
}

function present(view: Mounted): HTMLElement {
  click(view.container.querySelector('[data-rmk-deck-action="present"]')!)
  return deckOf(view)
}

function current(view: Mounted): string | null {
  return view.container.querySelector('[data-rmk-slide-state="current"]')?.getAttribute('data-rmk-slide') ?? null
}

describe('overlays', () => {
  it('opens the overview with o, keeps every slide clickable, and picks one on click', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, 'o')
    expect(deck.getAttribute('data-rmk-deck-overlay')).toBe('overview')
    expect(view.container.querySelectorAll('[data-rmk-slide][inert]')).toHaveLength(0)
    click(view.container.querySelector('[data-rmk-slide="3"] h2')!)
    expect(deck.hasAttribute('data-rmk-deck-overlay')).toBe(false)
    expect(current(view)).toBe('3')
  })

  it('lists the shortcuts with ? and closes them with Escape before leaving', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, '?', { shiftKey: true })
    const help = view.container.querySelector('[data-rmk-deck-help]')
    expect(help?.textContent).toContain('Overview')
    expect(help?.textContent).not.toContain('synced window')
    press(deck, 'Escape')
    expect(view.container.querySelector('[data-rmk-deck-help]')).toBeNull()
    expect(deck.getAttribute('data-rmk-deck-mode')).toBe('present')
  })

  it('blacks out with b', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, 'b')
    expect(deck.getAttribute('data-rmk-deck-overlay')).toBe('blackout')
    press(deck, 'b')
    expect(deck.hasAttribute('data-rmk-deck-overlay')).toBe(false)
  })
})

describe('keys', () => {
  it('jumps to a typed slide number on Enter and shows what is typed', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, '3')
    expect(view.container.querySelector('[data-rmk-deck-goto]')?.textContent).toBe('Go to 3')
    press(deck, 'Enter')
    expect(current(view)).toBe('3')
    expect(view.container.querySelector('[data-rmk-deck-goto]')).toBeNull()
  })

  it('switches the pointer tools and stops clicks from turning slides while one is on', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, 'd')
    expect(deck.getAttribute('data-rmk-deck-tool')).toBe('draw')
    expect(view.container.querySelector('[data-rmk-slide-state="current"] [data-rmk-deck-drawing]')).not.toBeNull()
    click(deck)
    expect(current(view)).toBe('1')
    press(deck, 'l')
    expect(deck.getAttribute('data-rmk-deck-tool')).toBe('laser')
    press(deck, 'Escape')
    expect(deck.hasAttribute('data-rmk-deck-tool')).toBe(false)
  })

  it('announces each slide for screen readers', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, 'ArrowRight')
    expect(view.container.querySelector('[data-rmk-deck-announcer]')?.textContent).toBe('Slide 2 of 3: Two')
  })
})

describe('reveal steps', () => {
  it('reveals incremental list items one by one', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, 'ArrowRight')
    const items = (): (string | null)[] =>
      [...view.container.querySelectorAll('[data-rmk-slide-state="current"] li')].map((item) => item.getAttribute('data-rmk-fragment-state'))
    expect(items()).toEqual(['hidden', 'hidden'])
    press(deck, 'ArrowRight')
    expect(items()).toEqual(['shown', 'hidden'])
    press(deck, 'ArrowRight')
    expect(items()).toEqual(['shown', 'shown'])
  })

  it('moves the code highlight one step per press', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, 'End')
    press(deck, 'ArrowLeft')
    const lines = (): (string | null)[] =>
      [...view.container.querySelectorAll('[data-rmk-slide-state="current"] [data-rmk-code-line]')].map((line) => line.getAttribute('data-rmk-code-line-state'))
    expect(lines()).toEqual(['focus', 'dim'])
    press(deck, 'ArrowRight')
    expect(lines()).toEqual(['dim', 'focus'])
  })
})

describe('presenter view', () => {
  it('shows an elapsed timer that resets, the notes placeholder, and the notes size', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, 'p')
    expect(view.container.querySelector('[data-rmk-deck-elapsed]')?.textContent).toBe('00:00')
    expect(view.container.querySelector('[data-rmk-deck-notes-empty]')).not.toBeNull()
    press(deck, 'End')
    expect(view.container.querySelector('[data-rmk-deck-notes] [data-rmk-slide-notes]')?.textContent).toBe('Remember the second line.')
    const notes = view.container.querySelector<HTMLElement>('[data-rmk-deck-notes]')!
    const before = notes.style.getPropertyValue('--rmk-deck-notes-scale')
    press(deck, '+', { shiftKey: true })
    expect(notes.style.getPropertyValue('--rmk-deck-notes-scale')).not.toBe(before)
    expect(view.container.querySelector('[data-rmk-deck-preview-end]')).not.toBeNull()
  })
})

describe('controller and custom controls', () => {
  it('drives the deck from outside and reads where it is', () => {
    const controller = createDeckController()
    const view = render(DECK, { controller })
    act(() => controller.enter())
    act(() => controller.goto(2))
    expect(current(view)).toBe('3')
    expect(controller.getState().index).toBe(2)
    press(deckOf(view), 'Home')
    expect(controller.getState().index).toBe(0)
  })

  it('renders a component passed as controls with the deck state and the command runner', () => {
    function Bar(props: DeckControlsProps): ReactElement {
      return (
        <div data-custom-bar="">
          <span>{props.state.mode}</span>
          <button type="button" onClick={() => props.run(props.state.mode === 'stack' ? 'present' : 'next')}>
            go
          </button>
        </div>
      )
    }
    const view = render(DECK, { controls: Bar })
    const button = view.container.querySelector('[data-custom-bar] button')!
    click(button)
    expect(view.container.querySelector('[data-custom-bar] span')?.textContent).toBe('present')
    click(view.container.querySelector('[data-custom-bar] button')!)
    expect(current(view)).toBe('2')
  })
})

describe('sync transport', () => {
  it('posts moves to a custom transport and follows what it receives', () => {
    const posted: unknown[] = []
    let deliver: (message: unknown) => void = () => undefined
    const transport: SyncTransport = {
      post: (message) => posted.push(message),
      subscribe: (onMessage) => {
        deliver = onMessage
        return () => undefined
      },
    }
    const view = render(DECK, { sync: transport })
    expect(posted).toEqual([{ ask: true }])
    const deck = present(view)
    press(deck, 'ArrowRight')
    expect(posted).toContainEqual({ index: 1, fragment: 0 })
    act(() => deliver({ index: 2, fragment: 0 }))
    expect(current(view)).toBe('3')
  })
})

describe('streaming and printing', () => {
  it('follows slides appended after the last one while presenting', () => {
    const view = render('# One\n', { follow: true, initialMode: 'present' })
    view.rewrite('# One\n\n---\n\n# Two\n')
    expect(current(view)).toBe('2')
  })

  it('adds one print copy per reveal step before each stepped slide', () => {
    const view = render(DECK, { printSteps: true })
    const copies = view.container.querySelectorAll('[data-rmk-slide-print-step]')
    // Slide 2: two list items; slide 3: one extra code step.
    expect(copies).toHaveLength(3)
    expect(copies[0]?.hasAttribute('id')).toBe(false)
  })

  it('reads and writes a step in the hash', () => {
    location.hash = '#2.1'
    const view = render(DECK, { hashRouting: true })
    expect(current(view)).toBe('2')
    expect([...view.container.querySelectorAll('[data-rmk-slide-state="current"] li')].map((item) => item.getAttribute('data-rmk-fragment-state'))).toEqual([
      'shown',
      'hidden',
    ])
    press(deckOf(view), 'ArrowRight')
    expect(location.hash).toBe('#2.2')
  })
})

describe('review fixes', () => {
  it('keeps a broadcast transport alive across unsubscribe and resubscribe, and serves every subscriber', async () => {
    const { broadcastTransport } = await import('../src/present.js')
    const transport = broadcastTransport('rmk-test-transport')
    if (transport === undefined) return
    const seen: unknown[] = []
    const first = transport.subscribe((message) => seen.push(['first', message]))
    first()
    transport.subscribe((message) => seen.push(['second', message]))
    transport.subscribe((message) => seen.push(['third', message]))
    const other = new BroadcastChannel('rmk-test-transport')
    other.postMessage('hello')
    await new Promise((resolve) => setTimeout(resolve, 20))
    other.close()
    transport.close()
    expect(seen).toEqual([
      ['second', 'hello'],
      ['third', 'hello'],
    ])
  })

  it('offers the presenter keys only in the presenter view', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, '?', { shiftKey: true })
    expect(view.container.querySelector('[data-rmk-deck-help]')?.textContent).not.toContain('Reset timer')
    press(deck, 'Escape')
    press(deck, 'p')
    press(deck, '?', { shiftKey: true })
    expect(view.container.querySelector('[data-rmk-deck-help]')?.textContent).toContain('Reset timer')
  })

  it('moves the focus into the shortcut list and back to the deck when it closes', () => {
    const view = render(DECK)
    const deck = present(view)
    press(deck, 'h')
    expect(document.activeElement?.hasAttribute('data-rmk-deck-help-panel')).toBe(true)
    press(document.activeElement!, 'Escape')
    expect(document.activeElement).toBe(deck)
  })

  it('has the announcer in the DOM from mount, empty until presenting', () => {
    const view = render(DECK)
    expect(view.container.querySelector('[data-rmk-deck-announcer]')?.textContent).toBe('')
    present(view)
    expect(view.container.querySelector('[data-rmk-deck-announcer]')?.textContent).toBe('Slide 1 of 3: One')
    expect(view.container.querySelector('[data-rmk-deck-counter]')?.getAttribute('aria-live')).toBe('off')
  })

  it('deep links a slide whose name is a number past the last slide', () => {
    location.hash = '#2024'
    const view = render('# One\n\n---\n\n<!-- name: 2024 -->\n\n# Two\n', { hashRouting: true })
    expect(current(view)).toBe('2')
  })
})
