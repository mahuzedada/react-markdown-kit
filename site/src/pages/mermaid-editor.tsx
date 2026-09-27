import type { ReactNode } from 'react'
import DemoLayout, { useEmbed } from '@site/src/layouts/DemoLayout'
import Demo from '@site/src/demos/mermaid/Demo'
import Landing, { DESCRIPTION, TITLE } from '@site/src/demos/mermaid/Landing'

export default function MermaidEditorPage(): ReactNode {
  const embed = useEmbed()
  if (embed) return <Demo embed />
  return (
    <DemoLayout
      title={TITLE}
      description={DESCRIPTION}
      keywords={['mermaid live editor', 'mermaid editor', 'visual mermaid editor', 'mermaid diagram', 'mermaid flowchart', 'mermaid sequence diagram', 'mermaid markdown', 'react mermaid', 'markdown diagram editor']}
      image="/img/social-card-mermaid.png"
      head={
        <>
          {/* Recursive, on its casual and cursive axes, is the face of the canvas's hand-drawn ink style. */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1&display=swap"
          />
        </>
      }
    >
      <Demo />
      <Landing />
    </DemoLayout>
  )
}
