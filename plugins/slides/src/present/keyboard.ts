/**
 * Keys → deck commands. The listener is attached to the deck element itself
 * and only while the deck is in present or presenter mode, so a static stack
 * never captures a key, two decks on a page never hear each other, and a
 * consumer's shortcuts keep working outside the deck. A key with a modifier
 * (other than Shift+Space) or typed into a field is left to the browser, and
 * so is Space or Enter on a button, link or summary: that is how the keyboard
 * activates them (the deck's own Previous button must not go forward).
 */
export type KeyCommand = 'next' | 'previous' | 'first' | 'last' | 'fullscreen' | 'presenter' | 'exit'

const KEYS: Readonly<Record<string, KeyCommand>> = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  PageDown: 'next',
  j: 'next',
  ArrowLeft: 'previous',
  ArrowUp: 'previous',
  PageUp: 'previous',
  k: 'previous',
  Home: 'first',
  End: 'last',
  f: 'fullscreen',
  p: 'presenter',
  Escape: 'exit',
}

const ACTIVATABLE = 'button, summary, a[href], [role="button"]'

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

/** The command a key event asks for, or undefined when the deck should ignore it. */
export function keyCommand(event: KeyboardEvent): KeyCommand | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target) || activates(event)) return undefined
  if (event.key === ' ' || event.key === 'Spacebar') return event.shiftKey ? 'previous' : 'next'
  if (event.shiftKey) return undefined
  return KEYS[event.key]
}

export function attachKeyboard(element: HTMLElement, onCommand: (command: KeyCommand) => void): () => void {
  const listener = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return
    const command = keyCommand(event)
    if (command === undefined) return
    event.preventDefault()
    onCommand(command)
  }
  element.addEventListener('keydown', listener)
  return () => {
    element.removeEventListener('keydown', listener)
  }
}
