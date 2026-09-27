/*
 * Builds the site into build/: the client bundle, then a server bundle that
 * renders every page to static HTML, then the 404 page and the sitemap.
 * nginx serves the result as files (see nginx.container.conf).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const site = fileURLToPath(new URL('..', import.meta.url))
const out = join(site, 'build')
const server = join(site, 'node_modules/.cache/site-server')
const origin = JSON.parse(readFileSync(join(site, 'src/sites.json'), 'utf8')).home

rmSync(out, { recursive: true, force: true })
await build({ root: site, logLevel: 'warn' })
await build({ root: site, logLevel: 'warn', build: { ssr: 'src/app/entry-server.tsx', outDir: server, manifest: false, copyPublicDir: false } })

const manifest = JSON.parse(readFileSync(join(out, '.vite/manifest.json'), 'utf8'))
// cssCodeSplit is off, so every page's CSS is the one `style.css` entry.
const assets = [
  `<link rel="stylesheet" href="/${manifest['style.css'].file}">`,
  `<script type="module" src="/${manifest['src/app/entry-client.tsx'].file}"></script>`,
].join('\n')

const { pages, render, renderNotFound, ICON_TAGS, THEME_SCRIPT } = await import(pathToFileURL(join(server, 'entry-server.js')).href)

const documentHtml = (head, body) => `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${THEME_SCRIPT}</script>
${head}
${ICON_TAGS}
${assets}
</head>
<body>
<div id="root">${body}</div>
</body>
</html>
`

for (const page of pages) {
  const { head, body } = await render(page.route)
  const dir = join(out, page.route)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), documentHtml(head, body))
}

writeFileSync(
  join(out, '404.html'),
  documentHtml('<title>Page not found | React Markdown Kit</title>\n<meta name="robots" content="noindex">', await renderNotFound()),
)

const urls = pages
  .map((page) => `<url><loc>${origin}${page.route === '/' ? '/' : page.route}</loc><lastmod>${page.lastUpdated}</lastmod></url>`)
  .join('')
writeFileSync(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`,
)

rmSync(join(out, '.vite'), { recursive: true, force: true })
rmSync(server, { recursive: true, force: true })
console.log(`Built ${pages.length} pages into ${out}`)
