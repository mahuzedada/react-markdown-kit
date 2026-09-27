import { Suspense, useEffect, useState, type ReactNode } from 'react'

/**
 * Children that need a browser (the editors, the canvases): the server and
 * the first client render show `fallback`, sized like the real thing so the
 * page does not jump, and the children mount after hydration. Children may be
 * `lazy`, so their chunk loads only in the browser.
 */
export default function ClientOnly({ children, fallback }: { readonly children: ReactNode; readonly fallback: ReactNode }): ReactNode {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <Suspense fallback={fallback}>{children}</Suspense> : fallback
}
