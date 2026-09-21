/**
 * Toolbar icons.
 *
 * Inline SVG in the package: no icon font, no icon dependency, no network
 * request (docs/STYLING.md, "Editor chrome"). Each one inherits `currentColor`
 * and sizes off the button's font size, so restyling the toolbar restyles the
 * icons with it. Replace them wholesale with the `toolbar` render prop.
 */
import type { ReactElement, ReactNode } from 'react'

function Glyph({ children }: { children: ReactNode }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const icons: Readonly<Record<string, ReactElement>> = {
  bold: (
    <Glyph>
      <path d="M7 4h6a4 4 0 0 1 0 8H7z" />
      <path d="M7 12h7a4 4 0 0 1 0 8H7z" />
    </Glyph>
  ),
  italic: (
    <Glyph>
      <path d="M15 4h-5M14 20H9M15 4 9 20" />
    </Glyph>
  ),
  strikethrough: (
    <Glyph>
      <path d="M4 12h16" />
      <path d="M16 6a4 4 0 0 0-4-2c-2.5 0-4 1.3-4 3 0 1.5 1 2.4 3 3" />
      <path d="M8 18a4 4 0 0 0 4 2c2.5 0 4-1.3 4-3 0-1.2-.6-2-2-2.6" />
    </Glyph>
  ),
  code: (
    <Glyph>
      <path d="m9 18-6-6 6-6M15 6l6 6-6 6" />
    </Glyph>
  ),
  heading1: (
    <Glyph>
      <path d="M4 5v14M12 5v14M4 12h8M16 10l3-2v11" />
    </Glyph>
  ),
  heading2: (
    <Glyph>
      <path d="M4 5v14M11 5v14M4 12h7M16 9a2.5 2.5 0 1 1 4 2l-4 5h5" />
    </Glyph>
  ),
  heading3: (
    <Glyph>
      <path d="M4 5v14M11 5v14M4 12h7M16 8h4l-2.5 3.5A2.5 2.5 0 1 1 16 16" />
    </Glyph>
  ),
  paragraph: (
    <Glyph>
      <path d="M13 4H8a4 4 0 0 0 0 8h5M13 4v16M17 4v16" />
    </Glyph>
  ),
  bulletList: (
    <Glyph>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </Glyph>
  ),
  orderedList: (
    <Glyph>
      <path d="M10 6h10M10 12h10M10 18h10M4 5h1v4M4 15h2v1l-2 2h2" />
    </Glyph>
  ),
  taskList: (
    <Glyph>
      <path d="M11 6h9M11 12h9M11 18h9M3 6.5 4.5 8 7 5M3 16.5 4.5 18 7 15" />
    </Glyph>
  ),
  blockquote: (
    <Glyph>
      <path d="M5 5v14M9 8h11M9 12h11M9 16h7" />
    </Glyph>
  ),
  codeBlock: (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m9 10-2 2 2 2M15 10l2 2-2 2" />
    </Glyph>
  ),
  link: (
    <Glyph>
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </Glyph>
  ),
  image: (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-5-5-6 6-2-2-5 5" />
    </Glyph>
  ),
  thematicBreak: (
    <Glyph>
      <path d="M4 12h16" />
    </Glyph>
  ),
  undo: (
    <Glyph>
      <path d="M3 8h10a5 5 0 0 1 0 10H8" />
      <path d="m3 8 4-4M3 8l4 4" />
    </Glyph>
  ),
  redo: (
    <Glyph>
      <path d="M21 8H11a5 5 0 0 0 0 10h5" />
      <path d="m21 8-4-4M21 8l-4 4" />
    </Glyph>
  ),
  rich: (
    <Glyph>
      <path d="M4 6h16M4 12h10M4 18h13" />
    </Glyph>
  ),
  source: (
    <Glyph>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
    </Glyph>
  ),
  preview: (
    <Glyph>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Glyph>
  ),
}
