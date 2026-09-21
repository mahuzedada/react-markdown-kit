/**
 * Link checker for the six public sites and the five package READMEs
 * (docs/SEO_WORKPLAN.md, milestone E item 3): every `href` and `src` that
 * points inside a reactmarkdownkit.com host, or is a relative path, must
 * resolve to a built file or route. A README's relative link must resolve to
 * a file or directory in the repository. Links to any other host are never
 * fetched, so the test runs offline.
 *
 * It reads build output, so a site that is not built is skipped locally. In
 * CI (`CI` set) a missing build is a failure, so the `public-sites` job cannot
 * pass with a host it never inspected.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

interface Site {
  readonly name: string
  readonly dir: string
  readonly url: string
}

const SITES: readonly Site[] = [
  { name: 'home', dir: 'public-sites/home/build', url: 'https://reactmarkdownkit.com' },
  { name: 'docs', dir: 'public-sites/docs/build', url: 'https://docs.reactmarkdownkit.com' },
  { name: 'renderer', dir: 'public-sites/renderer-demo/build', url: 'https://renderer.reactmarkdownkit.com' },
  { name: 'editor', dir: 'public-sites/editor-demo/build', url: 'https://editor.reactmarkdownkit.com' },
  { name: 'mermaid', dir: 'public-sites/mermaid-demo/build', url: 'https://mermaid.reactmarkdownkit.com' },
  { name: 'slides', dir: 'public-sites/slides-demo/build', url: 'https://slides.reactmarkdownkit.com' },
]

const READMES = [
  'packages/renderer/README.md',
  'packages/editor/README.md',
  'plugins/template/README.md',
  'plugins/mermaid/README.md',
  'plugins/slides/README.md',
]

const built = (site: Site): boolean => existsSync(join(root, site.dir, 'index.html'))

/** Every rendered page of a build: `index.html` at the root and in each route directory. */
function pages(dir: string): string[] {
  const found: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (entry === 'index.html') found.push(path)
    }
  }
  walk(dir)
  return found.sort()
}

const decode = (text: string): string =>
  text.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

/** Does `path` (site-relative, no query or hash) resolve to a file in `dir`? */
function resolves(dir: string, path: string): boolean {
  const clean = decodeURIComponent(path).replace(/\/$/, '')
  if (clean === '') return existsSync(join(dir, 'index.html'))
  return [clean, `${clean}/index.html`, `${clean}.html`].some((candidate) => existsSync(join(dir, candidate)))
}

/** A link this checker does not resolve: another host, a fragment, or a non-HTTP scheme. */
const external = (url: string): boolean =>
  url === '' || url.startsWith('#') || url.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(url)

type Target = { readonly site: Site; readonly path: string } | 'external' | 'unbuilt'

/**
 * Where a link from `route` (a page's site-relative route, ending in `/`)
 * points. A relative path resolves the way a browser resolves it against
 * the page's URL, so `diagram.png` on `/docs/mermaid/` is `/docs/mermaid/diagram.png`.
 */
function target(url: string, from: Site, route: string): Target {
  const host = SITES.find((site) => url === site.url || url.startsWith(`${site.url}/`))
  if (host === undefined && external(url)) return 'external'
  const site = host ?? from
  if (!built(site)) return 'unbuilt'
  const path = (host ? url.slice(host.url.length) : url).replace(/[#?].*$/, '')
  if (host !== undefined || path.startsWith('/')) return { site, path }
  return { site, path: new URL(path, `http://x${route}`).pathname }
}

describe('target()', () => {
  const docs = SITES[1] as Site
  it('resolves a relative path against the page route like a browser', () => {
    // Independent of the build: the route is a directory, so the file sits inside it.
    const where = new URL('diagram.png', 'http://x/docs/mermaid/').pathname
    expect(where).toBe('/docs/mermaid/diagram.png')
    expect(new URL('../shared.png', 'http://x/docs/mermaid/').pathname).toBe('/docs/shared.png')
    if (built(docs)) {
      expect(target('diagram.png', docs, '/docs/mermaid/')).toEqual({ site: docs, path: '/docs/mermaid/diagram.png' })
      expect(target('/img/logo.svg#x', docs, '/docs/mermaid/')).toEqual({ site: docs, path: '/img/logo.svg' })
    }
  })
})

/** Every `href` and `src` in an HTML document, decoded. */
const links = (html: string): string[] =>
  [...html.matchAll(/<[a-z][^>]*\s(?:href|src)="([^"]*)"/gi)].map((match) => decode(match[1]))

function broken(urls: string[], from: Site, route: string): string[] {
  const missing: string[] = []
  for (const url of urls) {
    const where = target(url, from, route)
    if (typeof where === 'string') continue
    if (!resolves(join(root, where.site.dir), where.path)) missing.push(url)
  }
  return missing
}

const inCI = process.env['CI'] !== undefined && process.env['CI'] !== ''

for (const site of SITES) {
  if (inCI) {
    it(`${site.name} is built`, () => {
      expect(built(site), site.dir).toBe(true)
    })
  }
  describe.skipIf(!built(site))(`${site.name} (${site.url})`, () => {
    const dir = join(root, site.dir)
    for (const page of pages(dir)) {
      const route = '/' + relative(dir, page).replace(/index\.html$/, '')
      it(`${route} links only to files and routes that exist`, () => {
        expect(broken(links(readFileSync(page, 'utf8')), site, route)).toEqual([])
      })
    }
  })
}

/** Markdown links and images, plus inline HTML `href`/`src`, outside fenced code. */
function readmeLinks(markdown: string): string[] {
  const prose = markdown.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '')
  const inline = [...prose.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((match) => match[1])
  const reference = [...prose.matchAll(/^\[[^\]]+\]:\s*(\S+)/gm)].map((match) => match[1])
  const html = [...prose.matchAll(/<[a-z][^>]*\s(?:href|src)="([^"]*)"/gi)].map((match) => match[1])
  return [...inline, ...reference, ...html].map((url) => url.replace(/^<|>$/g, ''))
}

describe('package READMEs', () => {
  for (const readme of READMES) {
    it(`${readme} links only to files, routes and hosts that exist`, () => {
      const missing: string[] = []
      for (const url of readmeLinks(readFileSync(join(root, readme), 'utf8'))) {
        const host = SITES.find((site) => url === site.url || url.startsWith(`${site.url}/`))
        if (host !== undefined) {
          if (!built(host)) continue
          const path = url.slice(host.url.length).replace(/[#?].*$/, '')
          if (!resolves(join(root, host.dir), path)) missing.push(url)
        } else if (!external(url)) {
          const path = url.replace(/[#?].*$/, '')
          if (path !== '' && !existsSync(join(root, dirname(readme), path))) missing.push(url)
        }
      }
      expect(missing).toEqual([])
    })
  }
})
