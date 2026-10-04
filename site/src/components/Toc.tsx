import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TableOfContents, useActiveHeading, type TableOfContentsEntry } from '@react-markdown-kit/editor/table-of-contents'
import type { TocItem } from '../app/routes'

const WIDE = '(min-width: 1240px)'
const LABELS = { 'outline.title': 'On this page' }

/**
 * The page's h2 and h3 headings, drawn by the editor's own table of contents:
 * a sticky column beside the text on wide screens, collapsed above it on
 * narrow ones. The links are plain anchors, so the prerendered page works
 * before any script runs.
 */
export default function Toc({ toc }: { readonly toc: readonly TocItem[] }): ReactNode {
  const entries = useMemo<TableOfContentsEntry[]>(
    () => toc.map((item) => ({ id: item.id, text: item.value, depth: item.level, href: `#${item.id}` })),
    [toc],
  )
  const activeId = useActiveHeading(entries, (entry) => document.getElementById(entry.id), { offset: 120 })
  // The server renders it collapsed; a wide screen opens it once mounted.
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(WIDE)
    const update = (): void => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  if (toc.length === 0) return null
  return (
    <aside className="document-toc">
      <TableOfContents key={String(wide)} entries={entries} activeId={activeId} defaultCollapsed={!wide} labels={LABELS} />
    </aside>
  )
}
