import type { ReactNode } from 'react'
import DemoLayout from '@site/src/layouts/DemoLayout'
import Demo from '@site/src/demos/variables/Demo'
import Landing, { DESCRIPTION, TITLE } from '@site/src/demos/variables/Landing'
import type { PageMeta } from '@site/src/app/routes'

export const meta: PageMeta = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['markdown variables', 'markdown template variables', 'markdown placeholders', 'typed markdown variables', 'personalized markdown', 'markdown templating react', 'react markdown kit'],
  image: '/img/social-card-variables.png',
}

export default function MarkdownVariablesPage(): ReactNode {
  return (
    <DemoLayout>
      <Demo />
      <Landing />
    </DemoLayout>
  )
}
