import type { ReactNode } from 'react'
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

export const documentPreset = defineMarkdownPreset({ extensions: [gfm()] })

/** The same document typography for static pages and live examples. */
export default function MarkdownDocument({ source }: { readonly source: string }): ReactNode {
  return <div className="rmk-document document-prose" data-prose=""><Markdown preset={documentPreset}>{source}</Markdown></div>
}
