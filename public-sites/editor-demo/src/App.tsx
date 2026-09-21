import { lazy, Suspense, type ReactNode } from 'react'
import { Shell } from '../../shared/Shell'
import Landing from './Landing'

// The editor pulls in Lexical, so the demo is its own chunk behind a
// placeholder the exact height it will take.
const KitDemo = lazy(() => import('./KitDemo'))

export default function App(): ReactNode {
  return (
    <Shell site="editor">
      <Suspense fallback={<div style={{ height: '100dvh' }} />}>
        <KitDemo />
      </Suspense>
      <Landing />
    </Shell>
  )
}
