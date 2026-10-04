/**
 * @react-markdown-kit/editor/table-of-contents
 *
 * The editor's heading list without the editor: no Lexical, no renderer. For a
 * page that wants the same table of contents over its own headings.
 */
'use client'

export { TableOfContents, useActiveHeading } from './react/table-of-contents.js'
export type { TableOfContentsEntry, TableOfContentsProps, ActiveHeadingOptions } from './react/table-of-contents.js'
