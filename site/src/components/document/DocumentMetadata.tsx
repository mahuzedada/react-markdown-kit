import type { ReactNode } from 'react'
import type { PageMeta } from '../../app/routes'
import { BreadcrumbJsonLd, JsonLd } from '../JsonLd'
import { webApplication } from '../landing/Seo'
import sites from '../../sites.json'

/** Search metadata belongs to the page, independently of its visible layout. */
export default function DocumentMetadata({ meta, path }: { readonly meta: PageMeta; readonly path: string }): ReactNode {
  return <>
    <JsonLd data={webApplication({ name: meta.title, description: meta.description, url: `${sites.home}${path}` })} />
    <BreadcrumbJsonLd trail={[{ name: 'React Markdown Kit', path: '/' }, { name: meta.title }]} />
  </>
}
