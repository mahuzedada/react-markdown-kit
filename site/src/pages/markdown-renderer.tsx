import type { ReactNode } from 'react'
import DemoLayout from '@site/src/layouts/DemoLayout'
import Demo from '@site/src/demos/renderer/Demo'
import Landing, { DESCRIPTION, TITLE } from '@site/src/demos/renderer/Landing'
import type { PageMeta } from '@site/src/app/routes'

export const meta: PageMeta = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['react markdown renderer', 'render markdown in react', 'react markdown alternative', 'react markdown example', 'react-markdown remark-gfm', 'markdown to jsx', 'react markdown kit'],
  image: '/img/social-card-renderer.png',
}

export default function MarkdownRendererPage(): ReactNode {
  return (
    <DemoLayout>
      <Demo />
      <Landing />
    </DemoLayout>
  )
}
