/** Stroke icons for the canvas chrome, 16px, drawn in `currentColor`. */
import type { ReactElement } from 'react'

function icon(children: ReactElement | ReactElement[]): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const headingIcon = icon(<path d="M6 4v16M18 4v16M6 12h12" />)
export const textIcon = icon(<path d="M5 6V4h14v2M12 4v16M9 20h6" />)
export const boldIcon = icon(<path d="M7 4h6a4 4 0 010 8H7zM7 12h7a4 4 0 010 8H7z" />)
export const italicIcon = icon(<path d="M14 4h-4M14 20h-4M15 4L9 20" />)
export const bulletIcon = icon([<path key="a" d="M9 6h11M9 12h11M9 18h11" />, <circle key="b" cx="4.5" cy="6" r="1" />, <circle key="c" cx="4.5" cy="12" r="1" />, <circle key="d" cx="4.5" cy="18" r="1" />])
export const numberedIcon = icon(<path d="M10 6h10M10 12h10M10 18h10M4 4h1v4M4 8h2M4 14h2l-2 4h2" />)
export const tableIcon = icon([<rect key="a" x="3" y="4" width="18" height="16" rx="2" />, <path key="b" d="M3 10h18M3 15h18M9 4v16M15 4v16" />])
export const codeIcon = icon(<path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />)
export const imageIcon = icon([<rect key="a" x="3" y="4" width="18" height="16" rx="2" />, <circle key="b" cx="9" cy="10" r="1.5" />, <path key="c" d="M21 16l-5-5-9 9" />])
export const playIcon = icon(<path d="M7 5l12 7-12 7z" />)
export const plusIcon = icon(<path d="M12 5v14M5 12h14" />)
export const notesIcon = icon(<path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2zM4 5v16M8 7h6M8 11h6" />)
export const stripIcon = icon(<rect x="4" y="5" width="16" height="14" rx="2" />)
export const gridIcon = icon([<rect key="a" x="4" y="4" width="7" height="7" rx="1" />, <rect key="b" x="13" y="4" width="7" height="7" rx="1" />, <rect key="c" x="4" y="13" width="7" height="7" rx="1" />, <rect key="d" x="13" y="13" width="7" height="7" rx="1" />])
export const chevronDownIcon = icon(<path d="M6 9l6 6 6-6" />)
export const chevronUpIcon = icon(<path d="M6 15l6-6 6 6" />)
export const copyIcon = icon([<rect key="a" x="8" y="8" width="12" height="12" rx="2" />, <path key="b" d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />])
export const trashIcon = icon(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />)
export const warningIcon = icon(<path d="M12 4l9 16H3zM12 10v4M12 17h.01" />)
