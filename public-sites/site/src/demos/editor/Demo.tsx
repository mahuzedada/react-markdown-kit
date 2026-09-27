import { lazy, Suspense, type ReactNode } from 'react'
import BrowserOnly from '@docusaurus/BrowserOnly'
import { DemoPlaceholder } from '@site/src/layouts/DemoLayout'

// The editor pulls in Lexical and needs a browser, so the demo is its own
// chunk, loaded on the client behind a placeholder the exact height it will
// take. The landing copy under it renders on the server.
const KitDemo = lazy(() => import('./KitDemo'))

// The round-trip panel uses the same editor bundle, further down the page.
const RoundTripPanel = lazy(() => import('./RoundTrip'))

export default function Demo(): ReactNode {
  return (
    <BrowserOnly fallback={<DemoPlaceholder />}>
      {() => (
        <Suspense fallback={<DemoPlaceholder />}>
          <KitDemo />
        </Suspense>
      )}
    </BrowserOnly>
  )
}

export function RoundTrip(): ReactNode {
  const placeholder = <div style={{ minHeight: '24rem' }} />
  return (
    <BrowserOnly fallback={placeholder}>
      {() => (
        <Suspense fallback={placeholder}>
          <RoundTripPanel />
        </Suspense>
      )}
    </BrowserOnly>
  )
}
