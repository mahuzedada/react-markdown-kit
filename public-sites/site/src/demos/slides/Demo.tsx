import { lazy, Suspense, type ReactNode } from 'react'
import BrowserOnly from '@docusaurus/BrowserOnly'
import { DemoPlaceholder } from '@site/src/layouts/DemoLayout'

// The workbench pulls in Lexical and needs a browser, so the demo is its own
// chunk, loaded on the client behind a placeholder the exact height it will
// take. The embed pulls in neither the editor nor the landing copy, so it is
// a chunk of its own too.
const SlidesDemo = lazy(() => import('./SlidesDemo'))
const Embed = lazy(() => import('./Embed'))

/**
 * The workbench. With `embed` (`?embed=1`), the deck alone in someone else's
 * iframe: no navbar, no landing copy, nothing but the deck and one link back.
 */
export default function Demo({ embed = false }: { readonly embed?: boolean }): ReactNode {
  return (
    <BrowserOnly fallback={<DemoPlaceholder />}>
      {() => <Suspense fallback={<DemoPlaceholder />}>{embed ? <Embed /> : <SlidesDemo />}</Suspense>}
    </BrowserOnly>
  )
}
