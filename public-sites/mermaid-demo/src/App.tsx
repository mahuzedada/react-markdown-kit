import { lazy, Suspense, type ReactNode } from 'react'
import { Shell } from '../../shared/Shell'
import Landing from './Landing'

// The canvas is the demo's heaviest code, so it is its own chunk behind a
// placeholder the exact height it will take.
const MermaidDemo = lazy(() => import('./MermaidDemo'))

/** `?embed=1`: the editor alone, for an iframe in a blog post or a docs page. */
function isEmbed(): boolean {
  if (typeof location === 'undefined') return false
  return new URLSearchParams(location.search).get('embed') === '1'
}

export default function App(): ReactNode {
  const embed = isEmbed()
  const demo = (
    <Suspense fallback={<div style={{ height: '100dvh' }} />}>
      <MermaidDemo embed={embed} />
    </Suspense>
  )
  // The built index.html carries the Shell and the landing copy for crawlers
  // (src/static.tsx); in embed mode the client mounts only the editor over it.
  // The editor draws its own header, so the Shell contributes the footer.
  if (embed) return demo
  return (
    <Shell site="mermaid">
      {demo}
      <Landing />
    </Shell>
  )
}
