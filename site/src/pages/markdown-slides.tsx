import DocumentMetadata from '@site/src/components/document/DocumentMetadata'
import type { ReactNode } from 'react'
import DemoLayout, { useEmbed } from '@site/src/layouts/DemoLayout'
import Demo from '@site/src/demos/slides/Demo'
import { readEmbed } from '@site/src/demos/slides/url-state'
import type { PageMeta } from '@site/src/app/routes'

export const meta: PageMeta = {
  title: 'Markdown Slides Editor Online in React',
  description: 'Write and present Markdown slides in your browser. Edit this guide as a deck, use speaker notes and presenter tools, and export your slides to PowerPoint.',
  keywords: ['markdown slides', 'markdown presentation', 'markdown to slides', 'markdown slide deck', 'react slides', 'markdown presenter', 'speaker notes markdown', 'remark slides', 'marp alternative', 'react markdown kit'],
  image: '/img/social-card-slides.png',
}

export default function MarkdownSlidesPage(): ReactNode {
  const embed = useEmbed(readEmbed)
  if (embed) return <Demo embed />
  return (
    <DemoLayout>
      <DocumentMetadata meta={meta} path="/markdown-slides" />
      <Demo />
    </DemoLayout>
  )
}
