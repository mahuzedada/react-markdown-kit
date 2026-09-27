import { lazy, Suspense, type ReactNode } from 'react'
import BrowserOnly from '@docusaurus/BrowserOnly'
import { DemoPlaceholder } from '@site/src/layouts/DemoLayout'

// The canvas is the demo's heaviest code and needs a browser, so it is its
// own chunk, loaded on the client behind a placeholder the exact height it
// will take. The landing copy under it renders on the server.
const MermaidDemo = lazy(() => import('./MermaidDemo'))

/** The editor. With `embed`, the editor alone, for an iframe in a blog post or a docs page. */
export default function Demo({ embed = false }: { readonly embed?: boolean }): ReactNode {
  return (
    <BrowserOnly fallback={<DemoPlaceholder />}>
      {() => (
        <Suspense fallback={<DemoPlaceholder />}>
          <MermaidDemo embed={embed} />
        </Suspense>
      )}
    </BrowserOnly>
  )
}
