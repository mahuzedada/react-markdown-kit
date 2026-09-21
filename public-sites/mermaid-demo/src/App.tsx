import { lazy, Suspense, type ReactNode } from 'react'
import { Shell } from '../../shared/Shell'
import Landing from './Landing'

// The canvas pulls in Lexical, so the demo is its own chunk behind a
// placeholder the exact height it will take.
const MermaidDemo = lazy(() => import('./MermaidDemo'))

export default function App(): ReactNode {
  return (
    <Shell site="mermaid">
      <Suspense fallback={<div style={{ height: '100dvh' }} />}>
        <MermaidDemo />
      </Suspense>
      <Landing />
    </Shell>
  )
}
