import DocumentMetadata from '@site/src/components/document/DocumentMetadata'
import type { ReactNode } from 'react'
import Shell from '@site/src/layouts/Shell'
import Demo from '@site/src/demos/editor/Demo'
import type { PageMeta } from '@site/src/app/routes'

export const meta: PageMeta = {
  title: 'Free Online Markdown Editor for React',
  description: 'Free online Markdown editor for React with rich, source and preview modes. It saves plain Markdown, needs no account and supports variables and diagrams.',
  keywords: ['react markdown editor', 'markdown editor online', 'free markdown editor', 'wysiwyg markdown editor react', 'lexical markdown editor', 'markdown round trip', 'react markdown kit'],
  image: '/img/social-card-editor.png',
}

export default function MarkdownEditorPage(): ReactNode {
  return (
    <Shell>
      <DocumentMetadata meta={meta} path="/markdown-editor" />
      <Demo />
    </Shell>
  )
}
