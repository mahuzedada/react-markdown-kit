import { lazy, Suspense, type ReactNode } from 'react'
import { Shell } from '../../shared/Shell'
import Landing from './Landing'

// The workbench pulls in Lexical, so the demo is its own chunk behind a
// placeholder the exact height it will take.
const SlidesDemo = lazy(() => import('./SlidesDemo'))

export default function App(): ReactNode {
  return (
    <Shell site="slides">
      <Suspense fallback={<div style={{ height: '100dvh' }} />}>
        <SlidesDemo />
      </Suspense>
      <Landing />
    </Shell>
  )
}
