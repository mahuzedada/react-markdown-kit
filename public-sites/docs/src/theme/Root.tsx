/*
 * Swizzled root: wraps every page in the public sites' activity tracking
 * (../../shared/Activity.tsx). Docusaurus navigates with the History API, so
 * the provider's capture reports each route as a page view.
 */
import type { ReactNode } from 'react'
import { SiteActivity } from '../../../shared/Activity'

export default function Root({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <SiteActivity site="docs" dev={process.env.NODE_ENV !== 'production'}>
      {children}
    </SiteActivity>
  )
}
