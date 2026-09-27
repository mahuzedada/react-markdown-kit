import type { ReactNode } from 'react'
import DemoLayout, { useEmbed } from '@site/src/layouts/DemoLayout'
import Demo from '@site/src/demos/slides/Demo'
import Landing, { DESCRIPTION, TITLE } from '@site/src/demos/slides/Landing'
import { readEmbed } from '@site/src/demos/slides/url-state'

export default function MarkdownSlidesPage(): ReactNode {
  const embed = useEmbed(readEmbed)
  if (embed) return <Demo embed />
  return (
    <DemoLayout
      title={TITLE}
      description={DESCRIPTION}
      keywords={['markdown slides', 'markdown presentation', 'markdown to slides', 'markdown slide deck', 'react slides', 'markdown presenter', 'speaker notes markdown', 'remark slides', 'marp alternative', 'react markdown kit']}
      image="/img/social-card-slides.png"
    >
      <Demo />
      <Landing />
    </DemoLayout>
  )
}
