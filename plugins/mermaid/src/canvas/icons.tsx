/**
 * Ported from @zuilib/text-editor (MIT). The canvas's inline SVG icons:
 * 20×20 stroke glyphs wrapped by `<Icon>`.
 */
import type { ReactElement } from 'react'
import type { DrawingShapeType } from '../core/drawing-data.js'

/** 20×20 stroke icons; hosts wrap them in their own <svg> */
export const SHAPE_ICONS: Record<DrawingShapeType | 'select', ReactElement> = {
  select: <path d="M4.5 2.5l12 6.5-5.4 1.4L8.5 16.5z" fill="currentColor" stroke="none" />,
  rect: <rect x="3" y="4.5" width="14" height="11" rx="2" />,
  ellipse: <ellipse cx="10" cy="10" rx="7" ry="5.5" />,
  diamond: <path d="M10 3l7 7-7 7-7-7z" />,
  note: <path d="M4 3.5h12v9l-3.5 3.5H4z M12.5 16v-3.5H16" />,
  cylinder: (
    <g>
      <ellipse cx="10" cy="5.5" rx="6" ry="2.5" />
      <path d="M4 5.5v9c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-9" />
    </g>
  ),
  cloud: <path d="M6 15.5a3 3 0 0 1-.5-5.95A4.5 4.5 0 0 1 14 8.3a3.6 3.6 0 0 1 .5 7.2z" />,
  queue: (
    <g>
      <path d="M5.5 5.5h9M5.5 14.5h9M5.5 5.5a2.2 4.5 0 0 0 0 9" />
      <ellipse cx="14.5" cy="10" rx="2.2" ry="4.5" />
    </g>
  ),
  actor: (
    <g>
      <circle cx="10" cy="5" r="2.2" />
      <path d="M10 7.2v5M6.5 9.2h7M10 12.2l-3 4.6M10 12.2l3 4.6" />
    </g>
  ),
  arrow: <path d="M4 16L16 4M9 4h7v7" />,
  line: <path d="M4 16L16 4" />,
  text: <path d="M4 5V3.5h12V5M10 3.5V16.5M7 16.5h6" />,
}

export const UI_ICONS = {
  more: (
    <g>
      <rect x="3" y="3" width="5.5" height="5.5" rx="1.2" />
      <circle cx="14.25" cy="5.75" r="2.75" />
      <path d="M5.75 11.5l2.75 5h-5.5z" />
      <path d="M11.5 12h5.5v5h-5.5z" />
    </g>
  ),
  straight: <path d="M4 16L16 4" />,
  elbow: <path d="M4 16v-6h12V4" />,
  oneWay: <path d="M3 10h13M12 5.5L16.5 10L12 14.5" />,
  twoWay: <path d="M3.5 10h13M8 5.5L3.5 10L8 14.5M12 5.5L16.5 10L12 14.5" />,
  trash: <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10M8.5 9v4M11.5 9v4" />,
  mermaid: (
    <g>
      <rect x="3" y="3.5" width="5" height="4" rx="1" />
      <rect x="12" y="3.5" width="5" height="4" rx="1" />
      <rect x="7.5" y="12.5" width="5" height="4" rx="1" />
      <path d="M5.5 7.5v2.5h9V7.5M10 10v2.5" />
    </g>
  ),
  check: <path d="M4 10.5l4 4 8-9" />,
  grip: (
    <path
      d="M7 7h.01M7 10h.01M7 13h.01M10 7h.01M10 10h.01M10 13h.01M13 7h.01M13 10h.01M13 13h.01"
      strokeWidth="2.2"
    />
  ),
  /** Editor toolbar button: two cards joined by an arrow */
  insertDiagram: (
    <g>
      <rect x="2.5" y="4" width="6" height="5" rx="1" />
      <rect x="11.5" y="11" width="6" height="5" rx="1" />
      <path d="M8.5 6.5h3.5v7M10.5 12l1.5 1.5 1.5-1.5" />
    </g>
  ),
  /** Header toggle: edit as text */
  code: <path d="M7 6l-4 4 4 4M13 6l4 4-4 4" />,
  /** Header toggle: edit on the canvas */
  canvas: (
    <g>
      <rect x="3" y="3.5" width="14" height="11" rx="1.5" />
      <path d="M6.5 8h3v3.5h-3zM12 6.5l2 2-2 2" />
    </g>
  ),
  /** Lossy notice */
  warning: <path d="M10 3.5l7 12.5H3zM10 8.5v3.5M10 14.2v.01" />,
  /** Sequence canvas: a participant box on its lifeline */
  participant: (
    <g>
      <rect x="4" y="3" width="12" height="6" rx="1.2" />
      <path d="M10 9v8" />
    </g>
  ),
  /** Sequence canvas: the autonumber badge */
  autonumber: (
    <g>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M8.5 8.5l1.5-1v5" />
    </g>
  ),
  solidLine: <path d="M3 10h14" />,
  dottedLine: <path d="M3 10h2.5M8.5 10h3M14.5 10h2.5" />,
  headArrow: <path d="M3 10h9M11 6l5 4-5 4z" fill="currentColor" />,
  headOpen: <path d="M3 10h13M12 6l4 4-4 4" />,
  headCross: <path d="M3 10h9M12 7l5 6M17 7l-5 6" />,
  headNone: <path d="M3 10h14" />,
  /** `+`: a bar opens on the receiver */
  activate: <path d="M4 10h7M13 6.5v7M10.5 10h5" />,
  /** `-`: a bar closes on the sender */
  deactivate: <path d="M4 10h7M13 10h3" />,
  swap: <path d="M4 7h11M12 4l3 3-3 3M16 13H5M8 10l-3 3 3 3" />,
  noteLeft: (
    <g>
      <rect x="3" y="5.5" width="8" height="9" rx="1" />
      <path d="M15 3v14" />
    </g>
  ),
  noteRight: (
    <g>
      <rect x="9" y="5.5" width="8" height="9" rx="1" />
      <path d="M5 3v14" />
    </g>
  ),
  noteOver: (
    <g>
      <rect x="5" y="6" width="10" height="8" rx="1" />
      <path d="M10 3v3M10 14v3" />
    </g>
  ),
  /** A frame around rows */
  wrap: <path d="M6 3.5H3.5v13H6M14 3.5h2.5v13H14M6.5 8h7M6.5 12h7" />,
  section: <path d="M3.5 3.5h13v13h-13zM3.5 10h13" strokeDasharray="2 2" />,
  unwrap: <path d="M6 3.5H3.5v13H6M14 3.5h2.5v13H14M8 7l4 6M12 7l-4 6" />,
}

/** A kind's own 24x24 icon path, drawn like the 20x20 glyphs. */
export function KindIcon({ path, size = 16 }: { path: string; size?: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  )
}

export function Icon({ children, size = 16 }: { children: ReactElement; size?: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}
