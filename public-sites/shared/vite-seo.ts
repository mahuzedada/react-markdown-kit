/**
 * The crawlable surface of a Vite site (docs/SEO_WORKPLAN.md, milestone A).
 *
 * After `vite build` this plugin renders the site's `src/static.tsx` with
 * `renderToStaticMarkup` into `#root`, so the built `index.html` carries the
 * h1, the copy, the FAQ, the structured data and the links without running
 * JavaScript; the app then mounts over that markup with `createRoot`. It also
 * writes `sitemap.xml` with the last commit date of the site, writes the
 * `404.html` that the container nginx serves with a real 404 status for any
 * path that is not a file, and copies the shared `llms.txt` files so every
 * host serves the same one.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, type Plugin, type ResolvedConfig } from 'vite'
import sites from './sites.json'

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
      writeFileSync(join(outDir, '404.html'), notFound(url))
      for (const file of LLMS_FILES) copyFileSync(join(shared, 'llms', file), join(outDir, file))
      config.logger.info(`rmk-seo: prerendered index.html, wrote sitemap.xml and 404.html, copied ${LLMS_FILES.join(' and ')}`)
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

/**
 * The page behind a 404 status. The demos have one route each, so there is no
 * client-side fallback to serve: say so and link the site root and the hub.
 * Self-contained, with the Foundry tokens inlined, because the fingerprinted
 * stylesheet name is not known here.
 */
function notFound(url: string): string {
  const host = new URL(url).host
  const hub = url === sites.home ? '' : `\n    <p><a href="${sites.home}/">React Markdown Kit home</a></p>`
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>Page not found | React Markdown Kit</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    :root { --background: #ffffff; --foreground: #1c2127; --muted-foreground: #5f6b7c; --primary-text: #215db0; color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      :root { --background: #1c2127; --foreground: #f6f7f9; --muted-foreground: #abb3bf; --primary-text: #8abbff; }
    }
    body { margin: 0; background: var(--background); color: var(--foreground); font: 16px/1.5 system-ui, sans-serif; }
    main { max-width: 40rem; margin: 0 auto; padding: 4rem 16px; }
    p { color: var(--muted-foreground); }
    a { color: var(--primary-text); }
  </style>
</head>
<body>
  <main>
    <h1>Page not found</h1>
    <p>Nothing lives at this address on ${host}.</p>
    <p><a href="/">Go to ${host}</a></p>${hub}
  </main>
</body>
</html>
`
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
