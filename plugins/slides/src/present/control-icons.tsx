/** Stroke icons for the control bar, 20px, drawn in `currentColor`. A command spec names the one it shows. */
import type { ReactElement } from 'react'

function icon(children: ReactElement | ReactElement[]): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const previousIcon = icon(<path d="M15 18l-6-6 6-6" />)
export const nextIcon = icon(<path d="M9 18l6-6-6-6" />)
export const overviewIcon = icon([<rect key="a" x="3" y="3" width="7" height="7" rx="1" />, <rect key="b" x="14" y="3" width="7" height="7" rx="1" />, <rect key="c" x="3" y="14" width="7" height="7" rx="1" />, <rect key="d" x="14" y="14" width="7" height="7" rx="1" />])
export const presenterIcon = icon([<rect key="a" x="2" y="4" width="13" height="10" rx="1" />, <path key="b" d="M18 6h4M18 10h4M18 14h4M6 18h5" />])
export const fullscreenIcon = icon(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />)
export const drawIcon = icon(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />)
export const laserIcon = icon([<circle key="a" cx="12" cy="12" r="3" />, <path key="b" d="M12 2v3M12 19v3M2 12h3M19 12h3" />])
export const helpIcon = icon([<circle key="a" cx="12" cy="12" r="9" />, <path key="b" d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5M12 17h.01" />])
export const exitIcon = icon(<path d="M18 6L6 18M6 6l12 12" />)
