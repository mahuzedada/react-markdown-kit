import DocumentMetadata from '@site/src/components/document/DocumentMetadata'
import type { ReactNode } from 'react'
import Shell from '@site/src/layouts/Shell'
import DocumentWorkbench from '@site/src/components/document/DocumentWorkbench'
import source from '@site/src/content/variables.md?raw'
import type { PageMeta } from '@site/src/app/routes'

export const meta: PageMeta = {
  title: 'Markdown Variables Playground for React',
  description: 'Try Markdown variables for React in the browser: edit a document with typed placeholders, switch the data and locale, and see what resolves or fails.',
  keywords: ['markdown variables', 'markdown template variables', 'markdown placeholders', 'typed markdown variables', 'personalized markdown', 'markdown templating react', 'react markdown kit'],
  image: '/img/social-card-variables.png',
}

export default function MarkdownVariablesPage(): ReactNode {
  return (
    <Shell>
      <DocumentMetadata meta={meta} path="/markdown-variables" />
      <DocumentWorkbench kind="variables" initialSource={source} />
    </Shell>
  )
}
