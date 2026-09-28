/**
 * Keys → deck commands. The listener is attached to the deck element itself
 * and only while the deck is in present or presenter mode, so a static stack
 * never captures a key, two decks on a page never hear each other, and a
 * consumer's shortcuts keep working outside the deck. A key with a modifier
 * (other than Shift+Space, or Shift on a symbol such as `?`) or typed into a
 * field is left to the browser, and so is Space or Enter on a button, link
 * or summary: that is how the keyboard activates them (the deck's own
 * Previous button must not go forward).
 *
 * Which key runs which command comes from the command registry. Digits are
 * collected instead: typing `12` then Enter goes to slide 12, Escape drops
 * what was typed, and a pause of two seconds forgets it.
 */
import { commandForKey, type DeckCommand } from './commands/registry.js'

const ACTIVATABLE = 'button, summary, a[href], [role="button"]'
export const GOTO_TIMEOUT_MS = 2000

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target.closest('[contenteditable=""], [contenteditable="true"]') !== null
}

/** True for a key that activates the focused control instead of moving the deck. */
function activates(event: KeyboardEvent): boolean {
  if (!(event.target instanceof Element)) return false
  const activation = event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter'
  return activation && event.target.closest(ACTIVATABLE) !== null
}

/** Shift is part of typing a symbol (`?`, `+`), never of a letter or a named key. */
function shiftedSymbol(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !/[\p{L}\p{N}]/u.test(event.key)
}

function ignored(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target) || activates(event)
}

/** The command a key event asks for, or undefined when the deck should ignore it. */
export function keyCommand(event: KeyboardEvent): DeckCommand | undefined {
  if (ignored(event)) return undefined
  if (event.key === ' ' || event.key === 'Spacebar') return event.shiftKey ? 'previous' : 'next'
  if (event.shiftKey && !shiftedSymbol(event)) return undefined
  return commandForKey(event.key)
}

export interface KeyboardHandlers {
  /** Runs the command; false when it is not on offer, so the key goes back to the browser. */
  onCommand(command: DeckCommand): boolean
  /** A one-based slide number typed and confirmed with Enter. */
  onGoto(slide: number): void
  /** The digits typed so far; '' when they were confirmed, dropped or forgotten. */
  onTyping(typed: string): void
}

export function attachKeyboard(element: HTMLElement, handlers: KeyboardHandlers): () => void {
  let typed = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const setTyped = (value: string): void => {
    if (timer !== undefined) clearTimeout(timer)
    typed = value
    handlers.onTyping(value)
    if (value !== '') timer = setTimeout(() => setTyped(''), GOTO_TIMEOUT_MS)
  }

  const listener = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return
    if (typed !== '' && !ignored(event) && (event.key === 'Enter' || event.key === 'Escape')) {
      event.preventDefault()
      if (event.key === 'Enter') handlers.onGoto(Number(typed))
      setTyped('')
      return
    }
    if (/^\d$/.test(event.key) && !ignored(event)) {
      event.preventDefault()
      setTyped(`${typed}${event.key}`.slice(-4))
      return
    }
    const command = keyCommand(event)
    if (command === undefined || !handlers.onCommand(command)) return
    event.preventDefault()
  }
  element.addEventListener('keydown', listener)
  return () => {
    if (timer !== undefined) clearTimeout(timer)
    element.removeEventListener('keydown', listener)
  }
}
