/** The site's public URLs: absolute links in structured data, share links and the demos. */
import sites from './sites.json'

/** An absolute link to a page of the site, such as `docsUrl('/docs/mermaid')`. */
export function docsUrl(path: string): string {
  return `${sites.docs}${path}`
}

export { sites }
export default sites
