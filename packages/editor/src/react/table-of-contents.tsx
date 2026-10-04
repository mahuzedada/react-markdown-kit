/**
 * `TableOfContents` — the heading list the editor's outline draws, usable on
 * its own for any page of headings.
 *
 * No Lexical and no editor instance here: `MarkdownOutline` feeds it the
 * editor's headings, and a page can feed it its own. Entries with an `href`
 * render as links, so a prerendered page keeps working with no script.
 */
import { useEffect, useId, useRef, useState, type ReactElement } from 'react'
import { cx, editorClass, type EditorClassNames } from '../class-names.js'
import type { MarkdownEditorLabels } from '../types.js'

export interface TableOfContentsEntry {
  /** Stable per heading: the element id on a page, the node key in the editor. */
  readonly id: string
  readonly text: string
  /** The heading level, 1 to 6. */
  readonly depth: number
  /** Present: the entry is an `<a href>`. Absent: a button that calls `onSelect`. */
  readonly href?: string
}

export interface TableOfContentsProps {
  readonly entries: readonly TableOfContentsEntry[]
  /** The entry to mark `aria-current="location"`, usually from `useActiveHeading`. */
  readonly activeId?: string | null
  readonly onSelect?: (entry: TableOfContentsEntry) => void
  /** Show the button that hides and shows the list. Defaults to `true`. */
  readonly collapsible?: boolean
  readonly defaultCollapsed?: boolean
  readonly labels?: MarkdownEditorLabels | undefined
  readonly classNames?: EditorClassNames | undefined
}

const DEFAULT_LABELS: Readonly<Record<string, string>> = {
  'outline.title': 'Outline',
  'outline.empty': 'Headings you add appear here.',
  'outline.untitled': 'Untitled',
}

export function TableOfContents({
  entries,
  activeId = null,
  onSelect,
  collapsible = true,
  defaultCollapsed = false,
  labels,
  classNames,
}: TableOfContentsProps): ReactElement {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const listId = useId()
  const label = (key: string): string => labels?.[key] ?? DEFAULT_LABELS[key] ?? key
  const title = label('outline.title')
  // Indent relative to the shallowest heading, so a page that starts at h2
  // does not open with an empty step.
  const top = Math.min(...entries.map((entry) => entry.depth))

  return (
    <div className={editorClass('outline', classNames)} data-rmk-collapsed={collapsed ? '' : undefined}>
      {collapsible ? (
        <button
          type="button"
          className={editorClass('outlineToggle', classNames)}
          aria-label={title}
          aria-expanded={!collapsed}
          aria-controls={listId}
          onClick={() => setCollapsed((value) => !value)}
        >
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 5h12M4 10h8M4 15h10" />
          </svg>
          <span className={editorClass('outlineTitle', classNames)}>{title}</span>
        </button>
      ) : null}
      {/* `hidden`, not unmounted: collapsed links stay in the HTML. */}
      <nav id={listId} aria-label={title} hidden={collapsed} className={editorClass('outlineList', classNames)}>
        {entries.length === 0 ? (
          <p className={editorClass('outlineEmpty', classNames)}>{label('outline.empty')}</p>
        ) : (
          <ul>
            {entries.map((entry) => {
              const active = entry.id === activeId
              const props = {
                className: cx(
                  editorClass('outlineItem', classNames),
                  active ? editorClass('outlineItemActive', classNames) : undefined,
                ),
                'aria-current': active ? ('location' as const) : undefined,
                onClick: onSelect === undefined ? undefined : () => onSelect(entry),
              }
              const text = entry.text.trim() === '' ? label('outline.untitled') : entry.text
              return (
                <li key={entry.id} data-rmk-level={entry.depth - top}>
                  {entry.href === undefined ? (
                    <button type="button" {...props}>{text}</button>
                  ) : (
                    <a href={entry.href} {...props}>{text}</a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </div>
  )
}

export interface ActiveHeadingOptions {
  /**
   * How far below the top of the scrolling area a heading counts as reached,
   * in pixels. Raise it by the height of any sticky header. Defaults to 80.
   */
  readonly offset?: number
}

/**
 * The entry whose section is on screen: the last heading above the reading
 * line, or the last one when the scroller is at its end. Listens to every
 * scroll in the document, so it works whether the page or a box scrolls.
 */
export function useActiveHeading(
  entries: readonly TableOfContentsEntry[],
  resolve: (entry: TableOfContentsEntry) => Element | null,
  options: ActiveHeadingOptions = {},
): string | null {
  const offset = options.offset ?? 80
  const [active, setActive] = useState<string | null>(null)
  const resolveRef = useRef(resolve)
  resolveRef.current = resolve

  useEffect(() => {
    let frame = 0
    const measure = (): void => {
      const found = entries
        .map((entry) => ({ entry, element: resolveRef.current(entry) }))
        .filter((item): item is { entry: TableOfContentsEntry; element: Element } => item.element !== null)
      const first = found[0]
      const last = found[found.length - 1]
      if (first === undefined || last === undefined) {
        setActive(null)
        return
      }
      const scroller = scrollParent(first.element)
      const line = (scroller === null ? 0 : scroller.getBoundingClientRect().top) + offset
      let current = first.entry.id
      for (const { entry, element } of found) {
        if (element.getBoundingClientRect().top <= line) current = entry.id
      }
      if (atEnd(scroller)) current = last.entry.id
      setActive(current)
    }
    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    document.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
    }
  }, [entries, offset])

  return active
}

/** The nearest ancestor that scrolls vertically, or `null` for the page. */
function scrollParent(element: Element): HTMLElement | null {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

function atEnd(scroller: HTMLElement | null): boolean {
  const box = scroller ?? document.documentElement
  // A box that does not scroll at all is not "at the end" of anything.
  return box.scrollHeight > box.clientHeight && box.scrollTop + box.clientHeight >= box.scrollHeight - 2
}
