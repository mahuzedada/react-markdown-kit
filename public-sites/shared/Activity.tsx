import { useEffect, type ReactNode } from 'react'
import { ActivityProvider } from '@zuilib/primitives/activity'
import { consoleAdapter } from '@zuilib/primitives/activity/adapters'
import { loadUmami, umamiAdapter } from './umami'

export type ActivitySite = 'home' | 'docs' | 'renderer' | 'editor' | 'mermaid' | 'slides'

export interface SiteActivityProps {
  readonly site: ActivitySite
  /** Development build: events go to the console and untagged controls are flagged. */
  readonly dev: boolean
  readonly children: ReactNode
}

/**
 * User-activity tracking for every public site, mounted once at the root.
 * Clicks, field changes and page views are read from the DOM through the
 * `data-zui-tag` each primitive writes for its `track` name; tab changes are
 * reported by the component. Every event carries the site it came from.
 *
 * Production reports to the self-hosted Umami at stats.reactmarkdownkit.com
 * (./umami.ts); development only logs to the console and loads no script.
 */
export function SiteActivity({ site, dev, children }: SiteActivityProps): ReactNode {
  useEffect(() => {
    if (!dev) loadUmami(site)
  }, [site, dev])

  return (
    <ActivityProvider
      adapters={[dev ? consoleAdapter() : umamiAdapter()]}
      properties={{ site }}
      // Slides switches views with `?view=`, the share links live in the hash:
      // only a new path is a new page.
      capture={{ pageViewOn: 'path' }}
    >
      {children}
    </ActivityProvider>
  )
}
