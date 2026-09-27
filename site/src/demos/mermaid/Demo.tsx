import { lazy, type ReactNode } from 'react'
import ClientOnly from '@site/src/components/ClientOnly'
import { DemoPlaceholder } from '@site/src/layouts/DemoLayout'

// The canvas is the demo's heaviest code and needs a browser, so it is its
// own chunk, loaded on the client behind a placeholder the exact height it
// will take. The landing copy under it renders on the server.
const MermaidDemo = lazy(() => import('./MermaidDemo'))

/** The editor. With `embed`, the editor alone, for an iframe in a blog post or a docs page. */
export default function Demo({ embed = false }: { readonly embed?: boolean }): ReactNode {
  return (
    <ClientOnly fallback={<DemoPlaceholder />}>
      <MermaidDemo embed={embed} />
    </ClientOnly>
  )
}
