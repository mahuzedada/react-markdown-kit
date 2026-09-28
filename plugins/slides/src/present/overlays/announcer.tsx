/**
 * A polite live region that says which slide is on screen after each move,
 * for screen reader users who cannot see the slide change. It is in the DOM
 * from mount, empty in the stack, because most screen readers ignore text a
 * live region is inserted with. Hidden visually with inline style so it
 * holds without the stylesheet.
 */
import type { CSSProperties, ReactElement } from 'react'

const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export function Announcer({ message }: { readonly message: string }): ReactElement {
  return (
    <div data-rmk-deck-announcer="" aria-live="polite" aria-atomic="true" style={VISUALLY_HIDDEN}>
      {message}
    </div>
  )
}
