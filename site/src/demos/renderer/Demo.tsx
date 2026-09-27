import { lazy, Suspense, type ReactNode } from 'react'
import BrowserOnly from '@docusaurus/BrowserOnly'
import { DemoPlaceholder } from '@site/src/layouts/DemoLayout'

// The demo is the whole first viewport and needs a browser, so it is its own
// chunk, loaded on the client behind a placeholder the exact height it will
// take. The landing copy under it renders on the server.
const Playground = lazy(() => import('./playground/PlaygroundInner'))

export default function Demo(): ReactNode {
  return (
    <BrowserOnly fallback={<DemoPlaceholder />}>
      {() => (
        <Suspense fallback={<DemoPlaceholder />}>
          <Playground />
        </Suspense>
      )}
    </BrowserOnly>
  )
}
