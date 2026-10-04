/**
 * `MarkdownOutline` — the editor's table of contents. Lists the document's
 * headings as they change, scrolls to one on click, and marks the section on
 * screen. It is view only: nothing is added to the document or the Markdown.
 */
import { useEffect, useState, type ReactElement } from 'react'
import { $getRoot, type LexicalEditor } from 'lexical'
import { editorOf } from '../bridge/session.js'
import { HeadingNode } from '../nodes/blocks.js'
import { useOptionalMarkdownEditorContext } from './context.js'
import { internalsOf } from './internals.js'
import { TableOfContents, useActiveHeading, type TableOfContentsEntry } from './table-of-contents.js'
import type { MarkdownEditorInstance } from '../types.js'

export interface MarkdownOutlineProps {
  readonly editor?: MarkdownEditorInstance
  readonly collapsible?: boolean
  readonly defaultCollapsed?: boolean
  /** Passed to `useActiveHeading`: raise it by the height of a sticky header above the editor. */
  readonly offset?: number
}

export function MarkdownOutline(props: MarkdownOutlineProps): ReactElement | null {
  const contextEditor = useOptionalMarkdownEditorContext()
  const editor = props.editor ?? contextEditor
  if (editor === null) {
    throw new Error(
      '<MarkdownOutline> needs an editor: render it inside <MarkdownEditorProvider>, or pass editor={useMarkdownEditor(...)}.',
    )
  }
  const internals = internalsOf(editor)
  const native = editorOf(internals.bridge)
  const entries = useHeadings(native)
  const activeId = useActiveHeading(entries, (entry) => native.getElementByKey(entry.id), {
    ...(props.offset === undefined ? {} : { offset: props.offset }),
  })

  // Source mode has no headings on screen, and preview's belong to the renderer.
  if (internals.mode !== 'rich') return null

  return (
    <TableOfContents
      entries={entries}
      activeId={activeId}
      onSelect={(entry) => {
        const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        native.getElementByKey(entry.id)?.scrollIntoView?.({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
      }}
      {...(props.collapsible === undefined ? {} : { collapsible: props.collapsible })}
      {...(props.defaultCollapsed === undefined ? {} : { defaultCollapsed: props.defaultCollapsed })}
      labels={internals.labels}
      classNames={internals.classNames}
    />
  )
}

function useHeadings(native: LexicalEditor): readonly TableOfContentsEntry[] {
  const [entries, setEntries] = useState(() => readHeadings(native))

  useEffect(() => {
    const refresh = (): void => {
      const next = readHeadings(native)
      setEntries((previous) => (sameEntries(previous, next) ? previous : next))
    }
    refresh()
    return native.registerUpdateListener(refresh)
  }, [native])

  return entries
}

function readHeadings(native: LexicalEditor): readonly TableOfContentsEntry[] {
  return native.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .filter((node): node is HeadingNode => node instanceof HeadingNode)
      .map((node) => ({ id: node.getKey(), text: node.getTextContent(), depth: node.getDepth() })),
  )
}

function sameEntries(a: readonly TableOfContentsEntry[], b: readonly TableOfContentsEntry[]): boolean {
  return (
    a.length === b.length &&
    a.every((entry, index) => {
      const other = b[index]
      return other !== undefined && entry.id === other.id && entry.text === other.text && entry.depth === other.depth
    })
  )
}
