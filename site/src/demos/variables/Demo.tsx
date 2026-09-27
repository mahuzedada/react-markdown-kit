import { lazy, type ReactNode } from 'react'
import ClientOnly from '@site/src/components/ClientOnly'
import { DemoPlaceholder } from '@site/src/layouts/DemoLayout'

// The demo is the whole first viewport and reads the URL hash, so it is its
// own chunk, loaded on the client behind a placeholder the exact height it
// will take. The landing copy under it renders on the server.
const VariablesDemo = lazy(() => import('./VariablesDemo'))

export default function Demo(): ReactNode {
  return (
    <ClientOnly fallback={<DemoPlaceholder />}>
      <VariablesDemo />
    </ClientOnly>
  )
}
