import { lazy, Suspense, type ReactNode } from 'react'
import { Shell } from '../../shared/Shell'
import Landing from './Landing'
import { readEmbed } from './url-state'

// The workbench pulls in Lexical, so the demo is its own chunk behind a
// placeholder the exact height it will take. The embed pulls in neither the
// editor nor the landing copy, so it is a chunk of its own too.
const SlidesDemo = lazy(() => import('./SlidesDemo'))
const Embed = lazy(() => import('./Embed'))

export default function App(): ReactNode {
  // `?embed=1` is the deck alone in someone else's iframe: no footer, no
  // landing copy, nothing but the deck and one link back here. The built
  // index.html still carries the Shell and the landing copy for crawlers
  // (src/static.tsx); an embed mounts only the deck over them.
  if (typeof location !== 'undefined' && readEmbed(location.search)) {
    return (
      <Suspense fallback={<div style={{ height: '100dvh' }} />}>
        <Embed />
      </Suspense>
    )
  }

  return (
    <Shell site="slides">
      <Suspense fallback={<div style={{ height: '100dvh' }} />}>
        <SlidesDemo />
      </Suspense>
      <Landing />
    </Shell>
  )
}
