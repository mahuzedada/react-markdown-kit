import type { ReactNode } from 'react'
import { cn } from '@zuilib/primitives/lib/cn'
import type { TocItem } from '../app/routes'

function TocList({ toc }: { readonly toc: readonly TocItem[] }): ReactNode {
  return (
    <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
      {toc.map((item) => (
        <li key={item.id} className={cn(item.level === 3 && 'ps-3')}>
          <a href={`#${item.id}`} className="text-muted-foreground no-underline hover:text-foreground">
            {item.value}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** The page's h2 and h3 headings: a sticky column beside the text on wide screens, a collapsed list above it on narrow ones. */
export default function Toc({ toc, variant }: { readonly toc: readonly TocItem[]; readonly variant: 'aside' | 'inline' }): ReactNode {
  if (toc.length === 0) return null
  if (variant === 'inline') {
    return (
      <details className="mb-6 rounded-(--radius) border border-border px-3 py-2 xl:hidden">
        <summary className="cursor-pointer text-sm font-medium">On this page</summary>
        <div className="mt-2">
          <TocList toc={toc} />
        </div>
      </details>
    )
  }
  return (
    <nav aria-label="On this page" className="sticky top-[calc(var(--navbar-height)+2rem)] max-h-[calc(100dvh-var(--navbar-height)-4rem)] overflow-y-auto border-s border-border ps-4">
      <TocList toc={toc} />
    </nav>
  )
}
