import type { MouseEvent, ReactNode } from 'react'
import Button from '@zuilib/primitives/button'
import { cn } from '@zuilib/primitives/lib/cn'

/*
 * The strip along the bottom of a demo: the pane switch on a narrow screen,
 * the demo's own figures, and the way down to the copy under it. Every demo
 * but Mermaid (whose canvas floats its own islands) ends in one, so they all
 * switch panes and point at their docs the same way.
 */

/** Below this width a demo shows one pane at a time and the strip switches them. */
export const NARROW_PX = 900

export function StatusStrip({ children, className }: { readonly children: ReactNode; readonly className?: string }): ReactNode {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-[1.4rem] gap-y-[0.4rem] border-t border-border bg-muted px-[0.9rem] py-2 text-xs text-muted-foreground tabular-nums print:hidden [&_b]:font-semibold [&_b]:text-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface PaneSwitchProps<T extends string> {
  readonly panes: readonly (readonly [T, string])[]
  readonly value: T
  readonly onChange: (pane: T) => void
}

/** Shown only below `NARROW_PX`, where the panes stack and one is hidden. */
export function PaneSwitch<T extends string>({ panes, value, onChange }: PaneSwitchProps<T>): ReactNode {
  return (
    <div className="hidden items-center gap-1 max-[900px]:inline-flex" role="group" aria-label="Pane">
      {panes.map(([pane, label]) => (
        <Button
          key={pane}
          variant={pane === value ? 'solid' : 'outline'}
          size="sm"
          track={`pane-${pane}`}
          aria-pressed={pane === value}
          onClick={() => onChange(pane)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

/**
 * Scrolls to the copy under the demo without touching the hash, which may
 * be carrying the reader's document.
 */
export function scrollToDocs(event: MouseEvent<HTMLAnchorElement>): void {
  const target = document.getElementById('docs')
  if (target === null) return
  event.preventDefault()
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function DocsLink({ className }: { readonly className?: string }): ReactNode {
  return (
    <a
      href="#docs"
      onClick={scrollToDocs}
      data-zui-tag="scroll-to-docs"
      className={cn('inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground no-underline hover:text-foreground', className)}
    >
      <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
      </svg>
      Docs and FAQ below
    </a>
  )
}
