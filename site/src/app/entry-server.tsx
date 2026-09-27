import { prerenderToNodeStream } from 'react-dom/static'
import type { ReactNode } from 'react'
import App from './App'
import NotFound from './NotFound'
import { ICON_TAGS, headTags } from './head'
import { loadPage, pages } from './routes'
import { THEME_SCRIPT } from './theme-script'

/* Used by scripts/build.mjs, from the server build, to write every page. */

export { pages, ICON_TAGS, THEME_SCRIPT }

async function html(node: ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node)
  const chunks: Buffer[] = []
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

export async function render(route: string): Promise<{ head: string; body: string }> {
  const page = pages.find((candidate) => candidate.route === route)
  if (page === undefined) throw new Error(`No page at ${route}`)
  const module = await loadPage(page)
  return { head: headTags(page, module), body: await html(<App page={page} module={module} />) }
}

export async function renderNotFound(): Promise<string> {
  return html(<NotFound />)
}
