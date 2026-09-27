import type { ReactNode } from 'react'
import DemoLayout from '@site/src/layouts/DemoLayout'
import Demo, { RoundTrip } from '@site/src/demos/editor/Demo'
import Landing, { DESCRIPTION, TITLE } from '@site/src/demos/editor/Landing'
import type { PageMeta } from '@site/src/app/routes'

export const meta: PageMeta = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['react markdown editor', 'markdown editor online', 'free markdown editor', 'wysiwyg markdown editor react', 'lexical markdown editor', 'markdown round trip', 'react markdown kit'],
  image: '/img/social-card-editor.png',
}

export default function MarkdownEditorPage(): ReactNode {
  return (
    <DemoLayout>
      <Demo />
      <Landing roundTrip={<RoundTrip />} />
    </DemoLayout>
  )
}
