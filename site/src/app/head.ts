import sites from '../sites.json'
import type { PageEntry, PageMeta, PageModule } from './routes'

/*
 * The `<head>` of a built page, as HTML. tests/seo-surface.test.ts checks
 * every tag this writes: title and description lengths, canonical, Open Graph
 * and Twitter with a PNG, the ownership tags.
 */

const SITE_NAME = 'React Markdown Kit'
const DEFAULT_IMAGE = '/img/social-card.png'

// Search Console and Bing Webmaster ownership (docs/SEO_WORKPLAN.md section 8).
// One account-level token per engine; losing either unverifies the host.
const VERIFICATION = {
  'google-site-verification': 'OeinVf8DkV6qubXo57xz7nxQyV2n5RQWJ7xaf7E0JUY',
  'msvalidate.01': '2B64E1F8A84336B6ADCDC7C6804331D5',
}

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The head fields of any page: a React page's `meta`, or an MDX page's front matter. */
export function pageMeta(page: PageEntry, module: PageModule): PageMeta {
  if (module.meta) return module.meta
  return { title: page.title ?? SITE_NAME, description: page.description ?? '' }
}

export function documentTitle(meta: PageMeta): string {
  return `${meta.title} | ${SITE_NAME}`
}

export function headTags(page: PageEntry, module: PageModule): string {
  const meta = pageMeta(page, module)
  const url = page.route === '/' ? `${sites.home}/` : `${sites.home}${page.route}`
  const image = `${sites.home}${meta.image ?? DEFAULT_IMAGE}`
  const title = documentTitle(meta)
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(meta.description)}">`,
    meta.keywords ? `<meta name="keywords" content="${escape(meta.keywords.join(','))}">` : '',
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="en">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(meta.description)}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${image}">`,
    ...Object.entries(VERIFICATION).map(([name, content]) => `<meta name="${name}" content="${content}">`),
    ...(meta.stylesheets ?? []).map((href) => `<link rel="stylesheet" href="${escape(href)}">`),
  ]
  return tags.filter(Boolean).join('\n')
}

/** Tags every page carries, the 404 page included. scripts/brand-icons.mjs writes the files. */
export const ICON_TAGS = [
  '<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">',
  '<link rel="icon" href="/favicon.ico" sizes="32x32">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<link rel="manifest" href="/site.webmanifest">',
].join('\n')
