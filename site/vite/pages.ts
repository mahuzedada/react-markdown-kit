import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import GithubSlugger from 'github-slugger'
import type { Plugin } from 'vite'

/*
 * The site's pages, found on disk: every doc in docs/ and every page in
 * src/pages, with its route, front matter and last git commit date. The app
 * imports the list as `virtual:pages` to build the docs sidebar, the page
 * head and the sitemap without loading every page module.
 *
 * Also the one remark plugin the MDX pages go through: heading ids,
 * `export const toc` and `export const frontMatter` (which the pages read in
 * their own scope), and relative `.mdx` links rewritten to routes.
 */

export type PageKind = 'doc' | 'article' | 'page'

export interface PageEntry {
  readonly route: string
  /** Path from the site root, such as `docs/getting-started.mdx`. */
  readonly file: string
  readonly kind: PageKind
  readonly title?: string
  readonly description?: string
  readonly sidebarLabel?: string
  readonly hideToc?: boolean
  /** `YYYY-MM-DD` of the last commit that touched the file. */
  readonly lastUpdated: string
}

const SITE = resolve(dirname(new URL(import.meta.url).pathname), '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** `docs/renderer/gfm.mdx` is `/docs/renderer/gfm`, `src/pages/index.tsx` is `/`. */
export function routeOf(file: string): string {
  const path = file.replace(/\.(mdx|tsx)$/, '')
  if (path.startsWith('docs/')) return `/${path}`
  const page = path.slice('src/pages/'.length)
  return page === 'index' ? '/' : `/${page}`
}

/** The front matter of these pages is flat `key: value` lines; strings may be quoted. */
function frontMatter(source: string): Record<string, string> {
  return fields(/^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '')
}

function fields(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const raw = line.slice(colon + 1).trim()
    out[line.slice(0, colon).trim()] = raw.startsWith('"')
      ? (JSON.parse(raw) as string)
      : raw.startsWith("'")
        ? raw.slice(1, -1).replace(/''/g, "'")
        : raw
  }
  return out
}

/** The last commit date of every file under the page directories, from one `git log`. */
function lastUpdated(): Map<string, string> {
  const dates = new Map<string, string>()
  let date = ''
  try {
    const log = execFileSync('git', ['log', '--format=%cs', '--name-only', '--', 'docs', 'src/pages'], { cwd: SITE, encoding: 'utf8' })
    for (const line of log.split('\n')) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(line)) date = line
      else if (line !== '') {
        const file = relative(SITE, resolve(SITE, '..', line))
        if (!dates.has(file)) dates.set(file, date)
      }
    }
  } catch {
    // No git (a tarball build): every page falls back to today.
  }
  return dates
}

export function findPages(): PageEntry[] {
  const dates = lastUpdated()
  const today = new Date().toISOString().slice(0, 10)
  const files = [...walk(join(SITE, 'docs')), ...walk(join(SITE, 'src/pages'))]
    .map((path) => relative(SITE, path))
    .filter((file) => /\.(mdx|tsx)$/.test(file))
  return files.sort().map((file) => {
    const kind: PageKind = file.startsWith('docs/') ? 'doc' : file.endsWith('.mdx') ? 'article' : 'page'
    const matter = file.endsWith('.mdx') ? frontMatter(readFileSync(join(SITE, file), 'utf8')) : {}
    return {
      route: routeOf(file),
      file,
      kind,
      title: matter['title'],
      description: matter['description'],
      sidebarLabel: matter['sidebar_label'],
      hideToc: matter['hide_table_of_contents'] === 'true',
      lastUpdated: dates.get(file) ?? today,
    }
  })
}

export function pages(): Plugin {
  const id = 'virtual:pages'
  return {
    name: 'site-pages',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load: (source) => (source === `\0${id}` ? `export default ${JSON.stringify(findPages())}` : undefined),
    // `vite preview` answers /docs/x with the home page; nginx serves /docs/x/index.html. Match nginx.
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        const [path, query = ''] = (request.url ?? '/').split('?')
        if (!/\.\w+$/.test(path) && existsSync(join(SITE, 'build', path, 'index.html'))) {
          request.url = `${path.replace(/\/?$/, '/')}index.html${query ? `?${query}` : ''}`
        }
        next()
      })
    },
  }
}

/* remark */

interface Node {
  type: string
  depth?: number
  url?: string
  value?: string
  children?: Node[]
  data?: Record<string, unknown>
}

const text = (node: Node): string => node.value ?? (node.children ?? []).map(text).join('')

/** An ESTree literal for a JSON value, so the plugin can add `export const toc`. */
function literal(value: unknown): object {
  if (Array.isArray(value)) return { type: 'ArrayExpression', elements: value.map(literal) }
  if (value !== null && typeof value === 'object') {
    return {
      type: 'ObjectExpression',
      properties: Object.entries(value).map(([key, item]) => ({
        type: 'Property',
        key: { type: 'Identifier', name: key },
        value: literal(item),
        kind: 'init',
        method: false,
        shorthand: false,
        computed: false,
      })),
    }
  }
  return { type: 'Literal', value }
}

/** An MDX ESM node for `export const name = value`, value being JSON. */
function exportConst(name: string, value: unknown): Node {
  return {
    type: 'mdxjsEsm',
    value: '',
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [
          {
            type: 'ExportNamedDeclaration',
            specifiers: [],
            source: null,
            declaration: {
              type: 'VariableDeclaration',
              kind: 'const',
              declarations: [{ type: 'VariableDeclarator', id: { type: 'Identifier', name }, init: literal(value) }],
            },
          },
        ],
      },
    },
  }
}

export interface TocItem {
  readonly id: string
  readonly value: string
  readonly level: number
}

export function remarkSite() {
  return (tree: Node, file: { path: string }): void => {
    const slugger = new GithubSlugger()
    const toc: TocItem[] = []
    const visit = (node: Node): void => {
      if (node.type === 'heading') {
        const value = text(node)
        const id = slugger.slug(value)
        node.data = { ...node.data, hProperties: { id } }
        if (node.depth === 2 || node.depth === 3) toc.push({ id, value, level: node.depth })
      }
      if (node.type === 'link' && node.url !== undefined) {
        const link = /^(\.{1,2}\/[^#]*\.mdx)(#.*)?$/.exec(node.url)
        if (link) node.url = routeOf(relative(SITE, resolve(dirname(file.path), link[1]))) + (link[2] ?? '')
      }
      node.children?.forEach(visit)
    }
    visit(tree)
    const yaml = tree.children?.find((node) => node.type === 'yaml')
    tree.children?.push(exportConst('toc', toc), exportConst('frontMatter', fields(yaml?.value ?? '')))
  }
}
