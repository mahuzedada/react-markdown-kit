/**
 * Convenience entry: Markdown with GitHub Flavored Markdown already on.
 *
 *   import { GfmMarkdown } from '@react-markdown-kit/renderer/gfm'
 *   <GfmMarkdown>{source}</GfmMarkdown>
 *
 * Equivalent to passing `gfmPreset`, or to the documented `remark-gfm` route.
 */
import type { ReactElement } from 'react'
import { Markdown, type MarkdownProps } from './markdown.js'
import { defineMarkdownPreset } from './preset.js'
import { gfm } from './extensions/gfm.js'

export const gfmPreset = defineMarkdownPreset({ extensions: [gfm()] })

export function GfmMarkdown(props: MarkdownProps): ReactElement {
  return Markdown({ preset: gfmPreset, ...props } as MarkdownProps)
}

export { gfm }
export default GfmMarkdown
