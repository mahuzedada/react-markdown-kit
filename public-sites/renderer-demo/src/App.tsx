import { lazy, Suspense, type ReactNode } from 'react'
import { Shell } from '../../shared/Shell'
import Landing from './Landing'

// The demo is the whole first viewport, so it loads as its own chunk behind a
// placeholder the exact height it will take.
const Playground = lazy(() => import('./playground/PlaygroundInner'))

export default function App(): ReactNode {
  return (
    <Shell site="renderer">
      <Suspense fallback={<div style={{ height: '100dvh' }} />}>
        <Playground />
      </Suspense>
      <Landing />
    </Shell>
  )
}
