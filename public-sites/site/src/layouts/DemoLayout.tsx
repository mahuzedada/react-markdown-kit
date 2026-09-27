import { useEffect, useState, type ReactNode } from 'react'
import Head from '@docusaurus/Head'
import Layout from '@theme/Layout'
import { PageMetadata } from '@docusaurus/theme-common'

/*
 * The layout of the four demo pages (/markdown-renderer, /markdown-editor,
 * /mermaid-editor, /markdown-slides): the site navbar, the demo filling the
 * rest of the first viewport, the demo's landing copy below it, and the site
 * footer. The docs use the docs plugin's layout and the pages in src/pages
 * that are Markdown use ArticleLayout.
 *
 * A demo's root sizes itself with `h-[var(--rmk-demo-height,100dvh)]`: here
 * that is the viewport under the sticky navbar; in `?embed=1` mode the page
 * renders the demo alone and the variable is unset, so the demo takes the
 * whole frame.
 */

export interface DemoLayoutProps {
  /** The page title without the site name, which Docusaurus appends. */
  readonly title: string
  readonly description: string
  readonly keywords: readonly string[]
  /** The social card, a site path such as `/img/social-card-mermaid.png`. */
  readonly image: string
  /** Extra head tags, such as a font the demo draws with. */
  readonly head?: ReactNode
  readonly children: ReactNode
}

const DEMO_HEIGHT = '[--rmk-demo-height:calc(100dvh-var(--ifm-navbar-height))]'

export default function DemoLayout({ title, description, keywords, image, head, children }: DemoLayoutProps): ReactNode {
  return (
    <Layout title={title} description={description} wrapperClassName={DEMO_HEIGHT}>
      <PageMetadata keywords={[...keywords]} image={image} />
      {head ? <Head>{head}</Head> : null}
      {children}
    </Layout>
  )
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
