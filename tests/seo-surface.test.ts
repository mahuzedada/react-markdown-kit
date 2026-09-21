/**
 * The SEO surface of the six public sites (docs/SEO_WORKPLAN.md, milestone E
 * item 1): every built page has one h1, a title of 50 to 60 characters, a
 * description of 140 to 155, an absolute canonical, Open Graph and Twitter
 * tags with a PNG image that exists, structured data that parses and names a
 * type, and a FAQPage block wherever it shows an FAQ; every host serves
 * robots.txt, a sitemap with lastmod, the shared llms.txt and a 404.html
 * that the container nginx serves with a real 404 status (no soft 404s); and
 * no page links to a 404 on any of the six hosts. tests/seo-links.test.ts checks
 * every other href and src, and the READMEs.
 *
 * It reads build output, so a site that is not built is skipped locally. In
 * CI (`CI` set) a missing build is a failure, so the `public-sites` job cannot
 * pass with a host it never inspected.
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
  /** A single landing page: canonical is the root and the structured data repeats the description. */
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

const GOOGLE_SITE_VERIFICATION = 'OeinVf8DkV6qubXo57xz7nxQyV2n5RQWJ7xaf7E0JUY'
const BING_SITE_VERIFICATION = '2B64E1F8A84336B6ADCDC7C6804331D5'

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

/** A page with an FAQ section: the shared `Faq` component, or a heading that says so. */
const hasFaq = (html: string): boolean =>
  /class="[^"]*\bsite-faq\b/.test(html) || /<h[1-6][^>]*>[^<]*(FAQ|Frequently asked)/i.test(html)

/** Does `path` (site-relative, no query or hash) resolve to a file in `dir`? */
function resolves(dir: string, path: string): boolean {
  const clean = decodeURIComponent(path).replace(/\/$/, '')
  if (clean === '') return existsSync(join(dir, 'index.html'))
  return [clean, `${clean}/index.html`, `${clean}.html`].some((candidate) => existsSync(join(dir, candidate)))
}

// The public-sites CI job builds all six hosts and sets this; everywhere else an
// unbuilt host skips instead of failing, since `pnpm test` runs before builds.
const sitesMustBeBuilt = process.env['RMK_SITES_BUILT'] === '1'

describe('nginx.container.conf', () => {
  const conf = readFileSync(join(root, 'nginx.container.conf'), 'utf8')

  it('answers an unknown path with 404 and the site 404.html, not the home page', () => {
    expect(conf).toMatch(/try_files \$uri \$uri\/index\.html \$uri\.html =404;/)
    expect(conf).toMatch(/error_page 404 \/404\.html;/)
    expect(conf).not.toMatch(/try_files[^;]*\s\/index\.html;/)
  })
})

for (const site of SITES) {
  if (sitesMustBeBuilt) {
    it(`${site.name} is built`, () => {
      expect(built(site), site.dir).toBe(true)
    })
  }
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

    it('ships a 404.html that search engines will not index', () => {
      const html = readFileSync(join(dir, '404.html'), 'utf8')
      expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
      if (site.name !== 'docs') expect(html).toContain('<meta name="robots" content="noindex" />')
    })

    it('carries the Search Console and Bing Webmaster ownership tags on its root page', () => {
      // One account-level token per engine verifies all six properties
      // (docs/SEO_WORKPLAN.md section 8). Losing either unverifies the host.
      const html = readFileSync(join(dir, 'index.html'), 'utf8')
      expect(meta(html, 'name', 'google-site-verification')).toBe(GOOGLE_SITE_VERIFICATION)
      expect(meta(html, 'name', 'msvalidate.01')).toBe(BING_SITE_VERIFICATION)
    })

    it('serves the shared llms.txt files', () => {
      for (const file of ['llms.txt', 'llms-full.txt']) {
        const source = readFileSync(join(root, 'public-sites/shared/llms', file), 'utf8')
        expect(readFileSync(join(dir, file), 'utf8')).toBe(source)
      }
    })

    for (const page of built(site) ? pages(dir) : []) {
      const route = '/' + relative(dir, page).replace(/index\.html$/, '')
      describe(route, () => {
        const html = readFileSync(page, 'utf8')

        it('has exactly one h1', () => {
          expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
        })

        it('has a title of 50 to 60 characters naming the kit', () => {
          const title = decode(attribute(html, /<title[^>]*>([^<]*)<\/title>/) ?? '')
          expect(title.length, title).toBeGreaterThanOrEqual(50)
          expect(title.length, title).toBeLessThanOrEqual(60)
          expect(title, title).toContain('React Markdown Kit')
        })

        it('has a description of 140 to 155 characters', () => {
          const description = decode(meta(html, 'name', 'description') ?? '')
          expect(description.length, description).toBeGreaterThanOrEqual(140)
          expect(description.length, description).toBeLessThanOrEqual(155)
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
          expect(meta(html, 'property', 'og:type')).toBe('website')
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

        if (hasFaq(html)) {
          it('backs its FAQ with a FAQPage block that lists every question', () => {
            const faq = jsonLd(html).find((block) => block['@type'] === 'FAQPage')
            expect(faq).toBeDefined()
            const questions = (faq?.['mainEntity'] as Array<Record<string, unknown>> | undefined) ?? []
            expect(questions.length).toBeGreaterThan(0)
            for (const question of questions) {
              expect(question['@type']).toBe('Question')
              expect(typeof question['name']).toBe('string')
            }
          })
        }

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

describe.skipIf(!built(SITES[1]))('docs breadcrumbs', () => {
  const dir = join(root, SITES[1].dir)
  const types = (route: string): unknown[] =>
    jsonLd(readFileSync(join(dir, route, 'index.html'), 'utf8')).map((block) => block['@type'])
  const trail = (route: string): unknown[] => {
    const list = jsonLd(readFileSync(join(dir, route, 'index.html'), 'utf8')).find((block) => block['@type'] === 'BreadcrumbList')
    return ((list?.['itemListElement'] as Array<Record<string, unknown>> | undefined) ?? []).map((item) => item['item'])
  }

  it('the docs index is the WebSite and the root of the trail', () => {
    expect(types('')).toEqual(expect.arrayContaining(['WebSite', 'BreadcrumbList']))
  })

  it('every comparison page runs through the /compare index', () => {
    const compare = readdirSync(join(dir, 'compare')).filter((entry) => statSync(join(dir, 'compare', entry)).isDirectory())
    expect(compare.length).toBeGreaterThan(0)
    expect(types('compare')).toContain('CollectionPage')
    for (const entry of compare) expect(trail(`compare/${entry}`), entry).toContain(`${SITES[1].url}/compare`)
  })
})

/**
 * The Mermaid size figures in the shared llms.txt files are copied by hand
 * from docs/data/mermaid-size.json (scripts/mermaid-size.mjs writes it), so a
 * rerun of the script that changes the JSON fails here until the text is
 * updated. docs/src/pages/react-mermaid.mdx and home/src/Landing.tsx read the
 * JSON at build time with the same formula.
 */
describe('llms.txt Mermaid size figures', () => {
  const size = JSON.parse(readFileSync(join(root, 'docs/data/mermaid-size.json'), 'utf8')) as {
    plugin: { gzipped: number }
    mermaid: { flowchart: { gzipped: number } }
  }
  const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`
  for (const file of ['llms.txt', 'llms-full.txt']) {
    it(`${file} states the measured plugin and Mermaid.js flowchart sizes`, () => {
      const text = readFileSync(join(root, 'public-sites/shared/llms', file), 'utf8')
      const line = text.split('\n').find((candidate) => candidate.includes('/react-mermaid)'))
      expect(line).toBeDefined()
      expect(line).toContain(`${kb(size.plugin.gzipped)} gzipped against ${kb(size.mermaid.flowchart.gzipped)}`)
    })
  }
})
