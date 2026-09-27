import type { ReactNode } from 'react'
import DemoLayout from '@site/src/layouts/DemoLayout'
import Demo, { RoundTrip } from '@site/src/demos/editor/Demo'
import Landing from '@site/src/demos/editor/Landing'

export default function MarkdownEditorPage(): ReactNode {
  return (
    <DemoLayout
      title="Free Online Markdown Editor for React"
      description="Free online Markdown editor for React with rich, source and preview modes. It saves plain Markdown, needs no account and supports templates and diagrams."
      keywords={['react markdown editor', 'markdown editor online', 'free markdown editor', 'wysiwyg markdown editor react', 'lexical markdown editor', 'markdown round trip', 'react markdown kit']}
      image="/img/social-card-editor.png"
    >
      <Demo />
      <Landing roundTrip={<RoundTrip />} />
    </DemoLayout>
  )
}
