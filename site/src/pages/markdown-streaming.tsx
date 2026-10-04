import DocumentMetadata from '@site/src/components/document/DocumentMetadata'
import type { ReactNode } from 'react'
import Shell from '@site/src/layouts/Shell'
import DocumentWorkbench from '@site/src/components/document/DocumentWorkbench'
import source from '@site/src/content/streaming.md?raw'
import type { PageMeta } from '@site/src/app/routes'

export const meta: PageMeta = {
  title: 'React Streaming Markdown Playground',
  description: 'Stream Markdown into a React renderer like an AI chat reply. Replay this editable guide, pause at any chunk, and explore how incomplete Markdown renders.',
  keywords: ['streaming markdown', 'react streaming markdown', 'ai chat markdown', 'llm markdown renderer', 'streamdown alternative', 'markdown streaming playground', 'react markdown kit'],
  image: '/img/social-card-stream.png',
}

export default function MarkdownStreamingPage(): ReactNode {
  return (
    <Shell>
      <DocumentMetadata meta={meta} path="/markdown-streaming" />
      <DocumentWorkbench kind="streaming" initialSource={source} />
    </Shell>
  )
}
