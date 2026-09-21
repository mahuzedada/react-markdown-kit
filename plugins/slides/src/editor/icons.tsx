/**
 * The four toolbar glyphs: 20×20 stroke icons in the editor's own style
 * (`currentColor`, no icon font, no request), wrapped by `<Icon>` exactly
 * as the mermaid canvas wraps its own.
 */
import type { ReactElement } from 'react'

export function Icon({ children, size = 18 }: { children: ReactElement; size?: number }): ReactElement {
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

export const SLIDES_ICONS = {
  /** A slide with a plus: "New slide". */
  slide: (
    <Icon>
      <g>
        <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
        <path d="M10 7.5v5M7.5 10h5" />
      </g>
    </Icon>
  ),
  /** A speech bubble with lines: "Speaker notes". */
  notes: (
    <Icon>
      <g>
        <path d="M3.5 4.5h13v8.5h-6l-3.5 3v-3h-3.5z" />
        <path d="M6.5 7.75h7M6.5 10.25h4" />
      </g>
    </Icon>
  ),
  /** Two bars: "Pause". */
  pause: (
    <Icon>
      <g>
        <rect x="5" y="4" width="3.5" height="12" rx="0.8" />
        <rect x="11.5" y="4" width="3.5" height="12" rx="0.8" />
      </g>
    </Icon>
  ),
  /** A picture: "Background". */
  background: (
    <Icon>
      <g>
        <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
        <circle cx="7" cy="8" r="1.5" />
        <path d="M2.5 14.5l4.5-4 3 3 2.5-2.5 5 4.5" />
      </g>
    </Icon>
  ),
}
