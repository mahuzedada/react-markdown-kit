import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/** A link to a page of the site or anywhere else. Pages are static HTML, so it is a plain anchor; `to` reads like a route. */
export default function Link({ to, href, ...props }: ComponentPropsWithoutRef<'a'> & { readonly to?: string }): ReactNode {
  return <a href={to ?? href} {...props} />
}
