#!/usr/bin/env node
/**
 * Size comparison behind docs.reactmarkdownkit.com/react-mermaid (claims
 * policy, docs/SEO_PLAN.md section 8): what a page pays to draw a Mermaid
 * flowchart with `@react-markdown-kit/mermaid`, next to what it pays to load
 * Mermaid.js. Both numbers are measured on real build output, never quoted.
 *
 *   plugin   `plugins/mermaid/dist/index.js`, the root entry (no React, no
 *            Lexical), bundled and minified with esbuild, then gzipped.
 *   mermaid  the published `mermaid` package, fetched with `npm pack` into a
 *            temp dir. Its browser ESM build is `dist/mermaid.esm.min.mjs`,
 *            already minified, which lazy-loads one chunk per diagram type.
 *            Three figures: the entry alone; the entry plus every chunk a
 *            flowchart loads (the static import closure of the entry, of the
 *            flowDiagram chunk and of the dagre layout chunk it requests);
 *            and every chunk in the package, the upper bound. Each figure is
 *            the sum of the files' sizes, gzipped one file at a time, which
 *            is how a browser receives them.
 *
 * Writes docs/data/mermaid-size.json (the page imports it) and prints it.
 *
 * Usage: node scripts/mermaid-size.mjs [workdir]
 *   workdir  where the tarball is unpacked; a fresh temp dir by default.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'docs', 'data', 'mermaid-size.json')
const workdir = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'mermaid-size-'))
mkdirSync(workdir, { recursive: true })

const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' })

const GZIP_LEVEL = 9
const bytes = (file) => statSync(file).size
const gzipped = (file) => gzipSync(readFileSync(file), { level: GZIP_LEVEL }).length
const sum = (files, measure) => files.reduce((total, file) => total + measure(file), 0)

/* ------------------------------------------------------------- plugin */

const pluginDir = join(root, 'plugins', 'mermaid')
const pluginEntry = join(pluginDir, 'dist', 'index.js')
if (!existsSync(pluginEntry)) run('pnpm', ['--filter', '@react-markdown-kit/mermaid', 'build'])

const pluginBundle = join(workdir, 'rmk-mermaid.min.js')
const esbuild = join(root, 'node_modules', '.bin', 'esbuild')
run(esbuild, [
  pluginEntry,
  '--bundle',
  '--minify',
  '--format=esm',
  '--log-level=warning',
  ...['react', 'react/jsx-runtime', 'react-dom', 'lexical', '@lexical/utils', '@react-markdown-kit/editor', '@react-markdown-kit/renderer'].map((name) => `--external:${name}`),
  `--outfile=${pluginBundle}`,
])
const pluginPackage = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))

/* ------------------------------------------------------------ mermaid */

const tarball = run('npm', ['pack', 'mermaid@latest', '--silent', '--pack-destination', workdir]).trim().split('\n').pop()
run('tar', ['xzf', join(workdir, tarball)], workdir)
const mermaidDir = join(workdir, 'package')
const mermaidPackage = JSON.parse(readFileSync(join(mermaidDir, 'package.json'), 'utf8'))
const dist = join(mermaidDir, 'dist')
const entry = join(dist, 'mermaid.esm.min.mjs')
const chunkDir = join(dist, 'chunks', 'mermaid.esm.min')
const chunks = readdirSync(chunkDir)
  .filter((name) => name.endsWith('.mjs'))
  .map((name) => join(chunkDir, name))

/** The files a module imports, static (`from "./x"`, `import "./x"`) or dynamic (`import("./x")`). */
function imports(file, kind) {
  const source = readFileSync(file, 'utf8')
  const pattern = kind === 'static' ? /(?:from|import)\s*"(\.[^"]+)"/g : /import\(\s*"(\.[^"]+)"\s*\)/g
  return [...source.matchAll(pattern)].map((match) => join(dirname(file), match[1]))
}

/** Every file reached from `start` over static imports, `start` included. */
function closure(start) {
  const seen = new Set()
  const stack = [start]
  while (stack.length > 0) {
    const file = stack.pop()
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    stack.push(...imports(file, 'static'))
  }
  return seen
}

const lazy = imports(entry, 'dynamic')
const flowchartChunk = lazy.find((file) => /\/flowDiagram-[^/]+\.mjs$/.test(file))
if (flowchartChunk === undefined) throw new Error('mermaid: no flowDiagram chunk is lazy-loaded from the entry')
// The flowchart chunk requests its layout engine lazily; dagre is the default.
const dagreChunk = chunks.find((file) => /\/dagre-[^/]+\.mjs$/.test(file))
if (dagreChunk === undefined) throw new Error('mermaid: no dagre layout chunk in the package')
const flowchartFiles = [...new Set([...closure(entry), ...closure(flowchartChunk), ...closure(dagreChunk)])].sort()
const allFiles = [entry, ...chunks]

const measure = (files) => ({ files: files.length, minified: sum(files, bytes), gzipped: sum(files, gzipped) })
const rel = (file) => relative(mermaidDir, file)

/* ------------------------------------------------------------- report */

/** Today as YYYY-MM-DD in the machine's time zone, not UTC. */
function localDate() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const report = {
  date: localDate(),
  script: 'scripts/mermaid-size.mjs',
  gzip: `node:zlib gzipSync, level ${GZIP_LEVEL}, one file at a time`,
  plugin: {
    name: pluginPackage.name,
    version: pluginPackage.version,
    entry: 'plugins/mermaid/dist/index.js',
    method: `esbuild ${run(esbuild, ['--version']).trim()}: --bundle --minify --format=esm, React and Lexical external`,
    minified: bytes(pluginBundle),
    gzipped: gzipped(pluginBundle),
  },
  mermaid: {
    name: mermaidPackage.name,
    version: mermaidPackage.version,
    method: `npm pack ${mermaidPackage.name}@${mermaidPackage.version}; dist/mermaid.esm.min.mjs and dist/chunks/mermaid.esm.min/*.mjs as published, already minified`,
    entry: { file: rel(entry), ...measure([entry]) },
    flowchart: {
      what: `the entry plus every chunk a flowchart loads: static import closure of the entry, ${rel(flowchartChunk)} and ${rel(dagreChunk)}`,
      ...measure(flowchartFiles),
    },
    all: { what: 'the entry plus every chunk in dist/chunks/mermaid.esm.min', ...measure(allFiles) },
    unpackedSize: { what: 'dist.unpackedSize from the registry: every file in the tarball, source maps, types and docs included', bytes: 0 },
  },
}
try {
  report.mermaid.unpackedSize.bytes = Number(run('npm', ['view', `mermaid@${mermaidPackage.version}`, 'dist.unpackedSize']).trim())
} catch {
  delete report.mermaid.unpackedSize
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(`${report.plugin.name}@${report.plugin.version}: ${kb(report.plugin.minified)} minified, ${kb(report.plugin.gzipped)} gzipped`)
console.log(`mermaid@${report.mermaid.version} entry: ${kb(report.mermaid.entry.minified)} minified, ${kb(report.mermaid.entry.gzipped)} gzipped`)
console.log(`mermaid@${report.mermaid.version} flowchart (${report.mermaid.flowchart.files} files): ${kb(report.mermaid.flowchart.minified)} minified, ${kb(report.mermaid.flowchart.gzipped)} gzipped`)
console.log(`mermaid@${report.mermaid.version} all (${report.mermaid.all.files} files): ${kb(report.mermaid.all.minified)} minified, ${kb(report.mermaid.all.gzipped)} gzipped`)
console.log(`wrote ${relative(root, out)}`)
