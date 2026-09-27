import type { ReactNode } from 'react'
import Prose from '../components/Prose'
import Toc from '../components/Toc'
import type { TocItem } from '../app/routes'

/**
 * The reading column the docs and the articles share: prose at the site's
 * reading width, the table of contents beside it on wide screens.
 */
export default function Reading({
  toc,
  footer,
  children,
}: {
  readonly toc: readonly TocItem[]
  readonly footer?: ReactNode
  readonly children: ReactNode
}): ReactNode {
  return (
    <div className="flex justify-center gap-12 px-4 py-12">
      <main className="w-full max-w-(--width-reading) min-w-0">
        <Toc toc={toc} variant="inline" />
        <Prose>{children}</Prose>
        {footer}
      </main>
      {toc.length > 0 ? (
        <aside className="hidden w-56 shrink-0 xl:block">
          <Toc toc={toc} variant="aside" />
        </aside>
      ) : null}
    </div>
  )
}

/** "Last updated on Sep 27, 2026", from the file's last commit. Formatted by hand so server and browser agree. */
export function LastUpdated({ date }: { readonly date: string }): ReactNode {
  const [year, month, day] = date.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return (
    <p className="mt-12 mb-0 text-sm text-muted-foreground">
      Last updated on <time dateTime={date}>{`${months[month - 1]} ${day}, ${year}`}</time>
    </p>
  )
}
