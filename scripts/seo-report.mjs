#!/usr/bin/env node
/**
 * One table row per built page of the six public sites: host, path, title
 * with its length, description length, h1 and JSON-LD types
 * (docs/SEO_WORKPLAN.md, milestone E item 4). Reads build output only, so
 * run `pnpm build:sites` first. Every site that is not built counts as one
 * problem, and so does every value outside the workplan's rules (title 50 to
 * 60, description 140 to 155, exactly one h1, at least one JSON-LD type);
 * the script exits 1 when there is any, so the section 6 acceptance checks
 * can gate on it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const SITES = [
  { host: 'reactmarkdownkit.com', dir: 'public-sites/home/build' },
  { host: 'docs.reactmarkdownkit.com', dir: 'public-sites/docs/build' },
  { host: 'renderer.reactmarkdownkit.com', dir: 'public-sites/renderer-demo/build' },
  { host: 'editor.reactmarkdownkit.com', dir: 'public-sites/editor-demo/build' },
  { host: 'mermaid.reactmarkdownkit.com', dir: 'public-sites/mermaid-demo/build' },
  { host: 'slides.reactmarkdownkit.com', dir: 'public-sites/slides-demo/build' },
]

const TITLE = [50, 60]
const DESCRIPTION = [140, 155]

/** Every rendered page of a build: `index.html` at the root and in each route directory. */
function pages(dir) {
  const found = []
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (entry === 'index.html') found.push(path)
    }
  }
  walk(dir)
  return found.sort()
}

const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')

const stripTags = (html) => decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()

function inspect(html) {
  const title = decode(/<title[^>]*>([^<]*)<\/title>/.exec(html)?.[1] ?? '')
  const description = decode(/<meta[^>]*name="description"[^>]*content="([^"]*)"/.exec(html)?.[1] ?? '')
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((match) => stripTags(match[1]))
  const types = []
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const block = JSON.parse(match[1])
      types.push(typeof block['@type'] === 'string' ? block['@type'] : '(no @type)')
    } catch {
      types.push('(invalid JSON)')
    }
  }
  return { title, description, h1s, types }
}

const within = (value, [min, max]) => value >= min && value <= max

function problems({ title, description, h1s, types }) {
  const found = []
  if (!within(title.length, TITLE)) found.push(`title ${title.length} not in ${TITLE.join('..')}`)
  if (!within(description.length, DESCRIPTION)) found.push(`description ${description.length} not in ${DESCRIPTION.join('..')}`)
  if (h1s.length !== 1) found.push(`${h1s.length} h1`)
  if (types.length === 0) found.push('no JSON-LD')
  if (types.some((type) => type.startsWith('('))) found.push('bad JSON-LD')
  return found
}

const rows = []
let failures = 0
let unbuilt = 0
for (const site of SITES) {
  const dir = join(root, site.dir)
  if (!existsSync(join(dir, 'index.html'))) {
    console.warn(`problem: ${site.host} is not built (${site.dir}); run pnpm build:sites`)
    unbuilt += 1
    failures += 1
    continue
  }
  for (const page of pages(dir)) {
    const path = '/' + relative(dir, page).replace(/index\.html$/, '')
    const info = inspect(readFileSync(page, 'utf8'))
    const issues = problems(info)
    failures += issues.length
    rows.push({
      host: site.host,
      path,
      title: `${info.title} (${info.title.length})`,
      desc: info.description.length,
      h1: info.h1s.join(' | ') || '(none)',
      'json-ld': info.types.join(', ') || '(none)',
      issues: issues.join('; '),
    })
  }
}

function printTable(table) {
  const columns = Object.keys(table[0])
  const width = Object.fromEntries(
    columns.map((column) => [column, Math.max(column.length, ...table.map((row) => String(row[column]).length))]),
  )
  const line = (cells) => cells.map((cell, index) => String(cell).padEnd(width[columns[index]])).join('  ').trimEnd()
  console.log(line(columns))
  console.log(line(columns.map((column) => '-'.repeat(width[column]))))
  for (const row of table) console.log(line(columns.map((column) => row[column])))
}

if (rows.length === 0) {
  console.error('no built site found; run pnpm build:sites')
  process.exit(1)
}
printTable(rows)
const unbuiltNote = unbuilt === 0 ? '' : `, ${unbuilt} of ${SITES.length} sites not built`
console.log(`\n${rows.length} pages, ${failures} problem${failures === 1 ? '' : 's'}${unbuiltNote}`)
process.exit(failures === 0 ? 0 : 1)
