import type { ReactNode } from 'react'
import { Shell } from '../../shared/Shell'
import Landing from './Landing'

/**
 * What the built index.html carries before the app mounts: the space the
 * demo will take, the landing copy and the footer. Rendered at build time by
 * shared/vite-seo.ts; the client then mounts App over it.
 */
export default function Static(): ReactNode {
  return (
    <Shell site="renderer">
      <div style={{ height: '100dvh' }} aria-hidden="true" />
      <Landing />
    </Shell>
  )
}
