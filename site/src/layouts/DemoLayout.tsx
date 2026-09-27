import { useEffect, useState, type ReactNode } from 'react'
import Shell from './Shell'

/*
 * The demo pages (/markdown-renderer, /markdown-editor, /markdown-variables,
 * /mermaid-editor, /markdown-slides): the demo filling the first viewport under the navbar,
 * its copy below in the reading column, then the footer.
 *
 * A demo's root sizes itself with `h-[var(--rmk-demo-height,100dvh)]`: here
 * that is the viewport under the sticky navbar; in `?embed=1` mode the page
 * renders the demo alone and the variable is unset, so the demo takes the
 * whole frame.
 */
export default function DemoLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return <Shell className="[--rmk-demo-height:calc(100dvh-var(--navbar-height))]">{children}</Shell>
}

/**
 * `?embed=1`: the demo alone, for an iframe in someone else's page. The
 * server renders the full page (crawlers never send the parameter), so the
 * switch happens after hydration.
 */
const readEmbedParam = (search: string): boolean => new URLSearchParams(search).get('embed') === '1'

export function useEmbed(read: (search: string) => boolean = readEmbedParam): boolean {
  const [embed, setEmbed] = useState(false)
  useEffect(() => {
    setEmbed(read(location.search))
  }, [read])
  return embed
}

/** The placeholder a demo shows until its chunk has loaded: the height the demo will take. */
export function DemoPlaceholder(): ReactNode {
  return <div className="h-[var(--rmk-demo-height,100dvh)]" aria-hidden="true" />
}
