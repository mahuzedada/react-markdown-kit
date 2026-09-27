import { lazy, type ReactNode } from 'react'
import ClientOnly from '@site/src/components/ClientOnly'
import { DemoPlaceholder } from '@site/src/layouts/DemoLayout'

// The editor pulls in Lexical and needs a browser, so the demo is its own
// chunk, loaded on the client behind a placeholder the exact height it will
// take. The landing copy under it renders on the server.
const KitDemo = lazy(() => import('./KitDemo'))

// The round-trip panel uses the same editor bundle, further down the page.
const RoundTripPanel = lazy(() => import('./RoundTrip'))

export default function Demo(): ReactNode {
  return (
    <ClientOnly fallback={<DemoPlaceholder />}>
      <KitDemo />
    </ClientOnly>
  )
}

export function RoundTrip(): ReactNode {
  const placeholder = <div style={{ minHeight: '24rem' }} />
  return (
    <ClientOnly fallback={placeholder}>
      <RoundTripPanel />
    </ClientOnly>
  )
}
