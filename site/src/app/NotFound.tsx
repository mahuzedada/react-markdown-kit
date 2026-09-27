import type { ReactNode } from 'react'
import { SiteActivity } from '../lib/Activity'
import Shell from '../layouts/Shell'
import Prose from '../components/Prose'

/** build/404.html, which the container nginx serves with a real 404 status. */
export default function NotFound(): ReactNode {
  return (
    <SiteActivity site="docs" dev={import.meta.env.DEV}>
      <Shell>
        <main className="px-4 py-12">
          <Prose className="mx-auto max-w-(--width-reading)">
            <h1>Page not found</h1>
            <p>
              Nothing lives at this address. Start from the <a href="/">home page</a> or the{' '}
              <a href="/docs/getting-started">docs</a>.
            </p>
          </Prose>
        </main>
      </Shell>
    </SiteActivity>
  )
}
