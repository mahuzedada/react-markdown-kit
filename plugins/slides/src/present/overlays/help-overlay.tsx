/**
 * The shortcut list (`?` or `h`), built from the command registry, so a
 * new command shows here with its keys and nothing else to edit. Commands
 * that are not on offer (fullscreen without the API, a synced window
 * without sync) are left out.
 */
import { useEffect, useRef, type ReactElement, type RefObject } from 'react'
import { DECK_COMMANDS, isAvailable } from '../commands/registry.js'
import type { OverlayViewProps } from './registry.js'

const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Escape: 'Esc',
}


/** The list takes the focus while open (it stays inside the deck, so the keys still work) and hands it back on close. */
function useDialogFocus(onClose: () => void): RefObject<HTMLDivElement | null> {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    return () => close.current()
  }, [])
  return panel
}

export function HelpOverlay({ labels, context, onClose }: OverlayViewProps): ReactElement {
  const rows = DECK_COMMANDS.filter((spec) => spec.keys.length > 0 && isAvailable(spec.id, context))
  const panel = useDialogFocus(onClose)
  return (
    <div data-rmk-deck-help="" role="dialog" aria-modal="true" aria-label={labels.shortcuts}>
      <div data-rmk-deck-help-panel="" ref={panel} tabIndex={-1}>
        <h2>{labels.shortcuts}</h2>
        <dl>
          {rows.map((spec) => (
            <div key={spec.id}>
              <dt>
                {spec.keys.map((key) => (
                  <kbd key={key}>{KEY_NAMES[key] ?? key}</kbd>
                ))}
              </dt>
              <dd>{spec.label(labels)}</dd>
            </div>
          ))}
          <div>
            <dt>
              <kbd>1</kbd>…<kbd>Enter</kbd>
            </dt>
            <dd>{labels.gotoHelp}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
