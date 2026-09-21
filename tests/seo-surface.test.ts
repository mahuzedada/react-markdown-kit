/**
 * The SEO surface of the six public sites (docs/SEO_WORKPLAN.md, milestone E
 * item 1): every built page has one h1, a title, a description, an absolute
 * canonical, Open Graph and Twitter tags with a PNG image that exists, and
 * structured data that parses; every host serves robots.txt, a sitemap with
 * lastmod, and the shared llms.txt; and no page links to a 404 on any of the
 * six hosts.
 *
 * It reads build output, so a site that is not built is skipped here and
 * checked by the `public-sites` CI job after the builds.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

interface Site {
  readonly name: string
  readonly dir: string
  readonly url: string
  /** A single landing page written to the workplan's title and description lengths. */
  readonly landing: boolean
}

const SITES: readonly Site[] = [
  { name: 'home', dir: 'public-sites/home/build', url: 'https://reactmarkdownkit.com', landing: true },
  { name: 'docs', dir: 'public-sites/docs/build', url: 'https://docs.reactmarkdownkit.com', landing: false },
  { name: 'renderer', dir: 'public-sites/renderer-demo/build', url: 'https://renderer.reactmarkdownkit.com', landing: true },
  { name: 'editor', dir: 'public-sites/editor-demo/build', url: 'https://editor.reactmarkdownkit.com', landing: true },
  { name: 'mermaid', dir: 'public-sites/mermaid-demo/build', url: 'https://mermaid.reactmarkdownkit.com', landing: true },
  { name: 'slides', dir: 'public-sites/slides-demo/build', url: 'https://slides.reactmarkdownkit.com', landing: true },
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

const attribute = (html: string, tag: RegExp): string | undefined => tag.exec(html)?.[1]
const meta = (html: string, key: 'name' | 'property', value: string): string | undefined =>
  attribute(html, new RegExp(`<meta[^>]*${key}="${value}"[^>]*content="([^"]*)"`))
const decode = (text: string): string =>
  text.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

function jsonLd(html: string): Array<Record<string, unknown>> {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1]) as Record<string, unknown>,
  )
}

/** Does `path` (site-relative, no query or hash) resolve to a file in `dir`? */
function resolves(dir: string, path: string): boolean {
  const clean = decodeURIComponent(path).replace(/\/$/, '')
  if (clean === '') return existsSync(join(dir, 'index.html'))
  return [clean, `${clean}/index.html`, `${clean}.html`].some((candidate) => existsSync(join(dir, candidate)))
}

for (const site of SITES) {
  describe.skipIf(!built(site))(`${site.name} (${site.url})`, () => {
    const dir = join(root, site.dir)

    it('serves robots.txt naming its sitemap', () => {
      expect(readFileSync(join(dir, 'robots.txt'), 'utf8')).toContain(`Sitemap: ${site.url}/sitemap.xml`)
    })

    it('serves a sitemap with lastmod whose every URL is a built page', () => {
      const xml = readFileSync(join(dir, 'sitemap.xml'), 'utf8')
      const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1])
      expect(locs.length).toBeGreaterThan(0)
      expect(xml).toContain('<lastmod>')
      for (const loc of locs) {
        expect(loc.startsWith(site.url)).toBe(true)
        expect(resolves(dir, loc.slice(site.url.length)), loc).toBe(true)
      }
    })

    it('serves the shared llms.txt files', () => {
      for (const file of ['llms.txt', 'llms-full.txt']) {
        const source = readFileSync(join(root, 'public-sites/shared/llms', file), 'utf8')
        expect(readFileSync(join(dir, file), 'utf8')).toBe(source)
      }
    })

    for (const page of pages(dir)) {
      const route = '/' + relative(dir, page).replace(/index\.html$/, '')
      describe(route, () => {
        const html = readFileSync(page, 'utf8')

        it('has exactly one h1', () => {
          expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
        })

        it('has a title and a description of the right length', () => {
          const title = decode(attribute(html, /<title[^>]*>([^<]*)<\/title>/) ?? '')
          const description = decode(meta(html, 'name', 'description') ?? '')
          expect(title).not.toBe('')
          expect(description).not.toBe('')
          if (site.landing) {
            expect(title.length, title).toBeGreaterThanOrEqual(50)
            expect(title.length, title).toBeLessThanOrEqual(60)
            expect(description.length, description).toBeGreaterThanOrEqual(140)
            expect(description.length, description).toBeLessThanOrEqual(155)
          } else {
            expect(title.length, title).toBeLessThanOrEqual(75)
            expect(description.length, description).toBeLessThanOrEqual(160)
          }
        })

        it('has an absolute canonical on this host', () => {
          const canonical = attribute(html, /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/)
          expect(canonical).toBeDefined()
          expect(canonical?.startsWith(site.url)).toBe(true)
          if (site.landing) expect(canonical).toBe(`${site.url}/`)
        })

        it('has Open Graph and Twitter tags with a PNG image that exists', () => {
          expect(meta(html, 'property', 'og:title')).toBeTruthy()
          expect(meta(html, 'property', 'og:description')).toBeTruthy()
          expect(meta(html, 'property', 'og:url')?.startsWith(site.url)).toBe(true)
          expect(meta(html, 'name', 'twitter:card')).toBe('summary_large_image')
          const image = meta(html, 'property', 'og:image') ?? ''
          expect(image.startsWith(site.url)).toBe(true)
          expect(image.endsWith('.png')).toBe(true)
          expect(existsSync(join(dir, image.slice(site.url.length))), image).toBe(true)
        })

        it('has structured data that parses and names a type', () => {
          const blocks = jsonLd(html)
          expect(blocks.length).toBeGreaterThan(0)
          for (const block of blocks) expect(typeof block['@type']).toBe('string')
        })

        if (site.landing) {
          it('describes itself the same way in the meta description and the structured data', () => {
            const description = decode(meta(html, 'name', 'description') ?? '')
            const main = jsonLd(html).find((block) => block['@type'] === 'WebApplication' || block['@type'] === 'SoftwareSourceCode')
            expect(main?.['description']).toBe(description)
          })
        }

        it('links to no 404 on the six hosts', () => {
          const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((match) => decode(match[1]))
          const broken: string[] = []
          for (const href of hrefs) {
            const target = SITES.find((candidate) => href === candidate.url || href.startsWith(`${candidate.url}/`))
            const targetSite = target ?? (href.startsWith('/') ? site : undefined)
            if (targetSite === undefined || !built(targetSite)) continue
            const path = (target ? href.slice(target.url.length) : href).replace(/[#?].*$/, '')
            if (!resolves(join(root, targetSite.dir), path)) broken.push(href)
          }
          expect(broken).toEqual([])
        })
      })
    }
  })
}
