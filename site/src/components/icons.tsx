import type { ReactNode, SVGProps } from 'react'

/* The site chrome's icons (Lucide paths), sized by the text around them. */

function Icon({ children, ...props }: SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

export const MenuIcon = (props: SVGProps<SVGSVGElement>): ReactNode => (
  <Icon {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
)

export const SunIcon = (props: SVGProps<SVGSVGElement>): ReactNode => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Icon>
)

export const MoonIcon = (props: SVGProps<SVGSVGElement>): ReactNode => (
  <Icon {...props}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Icon>
)

export const ExternalIcon = (props: SVGProps<SVGSVGElement>): ReactNode => (
  <Icon {...props}>
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </Icon>
)

export const ChevronIcon = (props: SVGProps<SVGSVGElement>): ReactNode => (
  <Icon {...props}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
)
