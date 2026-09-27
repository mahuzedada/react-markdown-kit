import type { ReactNode } from 'react'
import DemoLayout from '@site/src/layouts/DemoLayout'
import Demo from '@site/src/demos/stream/Demo'
import Landing, { DESCRIPTION, TITLE } from '@site/src/demos/stream/Landing'
import type { PageMeta } from '@site/src/app/routes'

export const meta: PageMeta = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['streaming markdown', 'react streaming markdown', 'ai chat markdown', 'llm markdown renderer', 'streamdown alternative', 'markdown streaming playground', 'react markdown kit'],
  image: '/img/social-card-stream.png',
}

export default function MarkdownStreamingPage(): ReactNode {
  return (
    <DemoLayout>
      <Demo />
      <Landing />
    </DemoLayout>
  )
}
