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
