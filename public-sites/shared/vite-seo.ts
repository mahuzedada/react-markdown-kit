/**
 * The crawlable surface of a Vite site (docs/SEO_WORKPLAN.md, milestone A).
 *
 * After `vite build` this plugin renders the site's `src/static.tsx` with
 * `renderToStaticMarkup` into `#root`, so the built `index.html` carries the
 * h1, the copy, the FAQ, the structured data and the links without running
 * JavaScript; the app then mounts over that markup with `createRoot`. It also
 * writes `sitemap.xml` with the last commit date of the site, and copies the
 * shared `llms.txt` files so every host serves the same one.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, type Plugin, type ResolvedConfig } from 'vite'

const shared = dirname(fileURLToPath(import.meta.url))
const LLMS_FILES = ['llms.txt', 'llms-full.txt'] as const
const STATIC_ENTRY = '/src/static.tsx'
const ROOT_MARKER = '<div id="root"></div>'

export interface SeoOptions {
  /** The host with its scheme and no trailing slash. */
  readonly url: string
  /** Routes other than `/` to list in the sitemap. */
  readonly routes?: readonly string[]
}

export function seo({ url, routes = [] }: SeoOptions): Plugin {
  let config: ResolvedConfig
  return {
    name: 'rmk-seo',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    async closeBundle() {
      const outDir = resolve(config.root, config.build.outDir)
      await prerender(config.root, outDir)
      writeFileSync(join(outDir, 'sitemap.xml'), sitemap(url, routes, lastModified(config.root)))
      for (const file of LLMS_FILES) copyFileSync(join(shared, 'llms', file), join(outDir, file))
      config.logger.info(`rmk-seo: prerendered index.html, wrote sitemap.xml, copied ${LLMS_FILES.join(' and ')}`)
    },
  }
}

async function prerender(root: string, outDir: string): Promise<void> {
  const server = await createServer({
    root,
    configFile: false,
    // No plugins: esbuild reads `jsx: react-jsx` from the tsconfig, which is
    // all the static entry needs.
    logLevel: 'error',
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
    // Only the static entry is loaded, on the server: no dependency scan.
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  try {
    const entry = (await server.ssrLoadModule(STATIC_ENTRY)) as { default: ComponentType }
    const markup = renderToStaticMarkup(createElement(entry.default))
    const file = join(outDir, 'index.html')
    const html = readFileSync(file, 'utf8')
    if (!html.includes(ROOT_MARKER)) throw new Error(`${file}: expected ${ROOT_MARKER}`)
    writeFileSync(file, html.replace(ROOT_MARKER, `<div id="root">${markup}</div>`))
  } finally {
    await server.close()
  }
}

function sitemap(url: string, routes: readonly string[], lastmod: string): string {
  const paths = ['/', ...routes.filter((route) => route !== '/')]
  const entries = paths.map((path) => `  <url><loc>${url}${path}</loc><lastmod>${lastmod}</lastmod></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
}

/** The date of the last commit that touched the site or the shared files. */
function lastModified(root: string): string {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', root, shared], { encoding: 'utf8' }).trim()
    if (iso !== '') return iso.slice(0, 10)
  } catch {
    // No git in this environment: fall through to today.
  }
  return new Date().toISOString().slice(0, 10)
}
