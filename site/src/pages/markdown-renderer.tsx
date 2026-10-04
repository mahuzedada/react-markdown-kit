import DocumentMetadata from '@site/src/components/document/DocumentMetadata'
import type { ReactNode } from 'react'
import Shell from '@site/src/layouts/Shell'
import DocumentWorkbench from '@site/src/components/document/DocumentWorkbench'
import source from '@site/src/content/renderer.md?raw'
import type { PageMeta } from '@site/src/app/routes'

export const meta: PageMeta = {
  title: 'React Markdown Renderer Playground',
  description: 'Try the React Markdown renderer in the browser. Edit the guide’s source, explore GFM and custom components, and inspect generated HTML and syntax trees.',
  keywords: ['react markdown renderer', 'render markdown in react', 'react markdown alternative', 'react markdown example', 'react-markdown remark-gfm', 'markdown to jsx', 'react markdown kit'],
  image: '/img/social-card-renderer.png',
}

export default function MarkdownRendererPage(): ReactNode {
  return (
    <Shell>
      <DocumentMetadata meta={meta} path="/markdown-renderer" />
      <DocumentWorkbench kind="renderer" initialSource={source} />
    </Shell>
  )
}
