#!/usr/bin/env node
/**
 * Bundle size comparison (SEO workplan Milestone D item 6, spec 14.3).
 *
 * Every size claim on a public page has to point at the run that produced it,
 * so this script produces the whole table in one pass: the kit and each
 * competitor, installed from the tarball a user would install, bundled by the
 * same esbuild with the same flags, measured minified and gzipped.
 *
 * What the numbers mean, and what they do not:
 *
 * - The unit is "bytes a browser downloads for this import", not "size of the
 *   package on disk". React and React DOM are marked external, because every
 *   app already ships them and no library here bundles them.
 *   `process.env.NODE_ENV` is set to production, because that is what an app
 *   build does and several of these packages ship development-only warnings.
 * - Tree shaking is on. A package that exposes a smaller entry point gets
 *   credit for it, which is why the kit is measured twice: with and without
 *   the GFM preset, which lives behind its own export.
 * - CSS is reported separately when a bundle emits any. Summing it into the
 *   JS number would flatter the packages that ship no styles.
 * - If a package fails to install or fails to bundle, the failure is recorded
 *   in the JSON as an error string. Nothing here is estimated.
 *
 * Usage:
 *   node scripts/compare-bundles.mjs                 # all targets
 *   node scripts/compare-bundles.mjs --date=2026-09-20
 *   node scripts/compare-bundles.mjs --only=kit-renderer,react-markdown
 *   node scripts/compare-bundles.mjs --out=docs/data/bundle-sizes.json
 *
 * Refresh the committed JSON with `pnpm size:bundles`. It needs network access
 * (npm) and it rebuilds the kit's packages through `npm pack`'s prepack hook.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// esbuild is not a direct dependency of this repo; it comes in under Vite.
// Resolving it through Vite keeps the two on the same version instead of
// adding a second copy just for this script.
const require = createRequire(join(root, 'scripts', 'compare-bundles.mjs'))
const esbuildEntry = createRequire(require.resolve('vite')).resolve('esbuild')
const esbuild = await import(pathToFileURL(esbuildEntry).href)

// React is external everywhere: an app pays for it once, whichever of these
// libraries it picks. `*` covers react/jsx-runtime, react-dom/client and so on.
const EXTERNAL = ['react', 'react/*', 'react-dom', 'react-dom/*']
const BUILD_OPTIONS = {
  bundle: true,
  write: false,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  external: EXTERNAL,
}
const GZIP_LEVEL = 9

// One npm install per group, reused by every target that imports from it.
// `packs` are workspace directories packed with `npm pack`, so the kit is
// measured from the published tarball's dist, exactly like the competitors.
const GROUPS = [
  {
    id: 'kit',
    packs: ['packages/renderer', 'packages/editor'],
    // The editor's peer range points at a version that is not on npm yet, so
    // npm must not try to resolve peers; the tarballs above are the peers.
    legacyPeerDeps: true,
  },
  { id: 'react-markdown', specs: ['react-markdown@latest', 'remark-gfm@latest'] },
  { id: 'markdown-to-jsx', specs: ['markdown-to-jsx@latest'] },
  { id: 'streamdown', specs: ['streamdown@latest'] },
  { id: 'mdxeditor', specs: ['@mdxeditor/editor@latest'] },
  { id: 'milkdown', specs: ['@milkdown/react@latest', '@milkdown/preset-commonmark@latest'] },
]

// `entry` is the exact module bundled. It is recorded in the JSON so a reader
// can reproduce a row without reading this file.
const TARGETS = [
  {
    id: 'kit-renderer',
    label: '@react-markdown-kit/renderer, CommonMark',
    group: 'kit',
    package: '@react-markdown-kit/renderer',
    entry: "import { Markdown } from '@react-markdown-kit/renderer'\nexport { Markdown }\n",
  },
  {
    id: 'kit-renderer-gfm',
    label: '@react-markdown-kit/renderer + GFM preset',
    group: 'kit',
    package: '@react-markdown-kit/renderer',
    entry:
      "import { Markdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'\n" +
      "import { gfm } from '@react-markdown-kit/renderer/gfm'\n" +
      'export const preset = defineMarkdownPreset({ extensions: [gfm()] })\n' +
      'export { Markdown }\n',
  },
  {
    id: 'kit-editor',
    label: '@react-markdown-kit/editor',
    group: 'kit',
    package: '@react-markdown-kit/editor',
    entry:
      "import { MarkdownEditor, createMarkdownBridge } from '@react-markdown-kit/editor'\n" +
      'export { MarkdownEditor, createMarkdownBridge }\n',
  },
  {
    id: 'react-markdown',
    label: 'react-markdown, CommonMark',
    group: 'react-markdown',
    package: 'react-markdown',
    entry: "import Markdown from 'react-markdown'\nexport { Markdown }\n",
  },
  {
    id: 'react-markdown-gfm',
    label: 'react-markdown + remark-gfm',
    group: 'react-markdown',
    package: 'react-markdown',
    extraPackages: ['remark-gfm'],
    entry:
      "import Markdown from 'react-markdown'\n" +
      "import remarkGfm from 'remark-gfm'\n" +
      'export const plugins = [remarkGfm]\n' +
      'export { Markdown }\n',
  },
  {
    id: 'markdown-to-jsx',
    label: 'markdown-to-jsx',
    group: 'markdown-to-jsx',
    package: 'markdown-to-jsx',
    entry: "import Markdown from 'markdown-to-jsx'\nexport { Markdown }\n",
  },
  {
    id: 'streamdown',
    label: 'streamdown',
    group: 'streamdown',
    package: 'streamdown',
    entry: "import { Streamdown } from 'streamdown'\nexport { Streamdown }\n",
  },
  {
    id: 'mdxeditor',
    label: '@mdxeditor/editor',
    group: 'mdxeditor',
    package: '@mdxeditor/editor',
    entry: "import { MDXEditor } from '@mdxeditor/editor'\nexport { MDXEditor }\n",
  },
  {
    id: 'milkdown',
    label: '@milkdown/react + @milkdown/preset-commonmark',
    group: 'milkdown',
    package: '@milkdown/react',
    extraPackages: ['@milkdown/preset-commonmark'],
    entry:
      "import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'\n" +
      "import { commonmark } from '@milkdown/preset-commonmark'\n" +
      'export { Milkdown, MilkdownProvider, useEditor, commonmark }\n',
  },
]

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const found = args.find((a) => a.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : fallback
}
const only = flag('only')
const selected = only ? new Set(only.split(',').map((s) => s.trim())) : null
const targets = selected ? TARGETS.filter((t) => selected.has(t.id)) : TARGETS
if (targets.length === 0) throw new Error(`--only matched no target: ${only}`)
const outFile = join(root, flag('out', 'docs/data/bundle-sizes.json'))

// The date is an argument so a docs page can state when the table was taken;
// with no argument it is the commit date of HEAD, which keeps reruns stable.
const measuredOn =
  flag('date') ??
  execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: root, encoding: 'utf8' }).trim()

const run = (cmd, cmdArgs, cwd) =>
  execFileSync(cmd, cmdArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })

const errorText = (error) => {
  const parts = [error.stderr, error.message].filter((p) => typeof p === 'string' && p.trim() !== '')
  return parts.join('\n').split('\n').slice(0, 6).join(' ').slice(0, 600).trim()
}

/** Install one group into its own directory, so one bad package cannot skew another. */
function installGroup(group, scratch) {
  const dir = join(scratch, group.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: `size-${group.id}`, private: true, version: '1.0.0', type: 'module' }, null, 2),
  )

  const specs = [...(group.specs ?? [])]
  for (const pkgDir of group.packs ?? []) {
    // prepack builds the package, so this measures freshly built dist output.
    run('npm', ['pack', '--pack-destination', dir], join(root, pkgDir))
  }
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.tgz')) specs.push(join(dir, file))
  }

  // React is external for bundling but still installed, so npm can satisfy
  // peer ranges and so a package that imports react resolves at all.
  specs.push('react@19', 'react-dom@19')
  const npmArgs = ['install', '--no-audit', '--no-fund', '--loglevel=error']
  if (group.legacyPeerDeps) npmArgs.push('--legacy-peer-deps')
  try {
    run('npm', [...npmArgs, ...specs], dir)
  } catch (error) {
    if (group.legacyPeerDeps) throw error
    // A peer conflict between competitors is not a fact about the kit; retry
    // the way a user hitting the same conflict would.
    run('npm', [...npmArgs, '--legacy-peer-deps', ...specs], dir)
  }
  return dir
}

/** The root entry a bare import of the package resolves to, as a relative path. */
function rootEntry(pkg) {
  const exp = pkg.exports
  if (typeof exp === 'string') return exp
  const dot = exp && typeof exp === 'object' ? (exp['.'] ?? exp) : null
  if (typeof dot === 'string') return dot
  if (dot && typeof dot === 'object') {
    for (const key of ['import', 'browser', 'default', 'require']) {
      const value = dot[key]
      if (typeof value === 'string') return value
      if (value && typeof value === 'object' && typeof value.default === 'string') return value.default
    }
  }
  return pkg.main ?? 'index.js'
}

/** Facts a comparison page needs that are simply written in the package metadata. */
function metadata(installDir, name) {
  const pkgDir = join(installDir, 'node_modules', ...name.split('/'))
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  // Three ways a package can ship declarations, and packages use all three:
  // a `types` field, a `types` condition in `exports`, or a bare `.d.ts` file
  // beside the entry point, which is how react-markdown does it.
  const exportsHasTypes = JSON.stringify(pkg.exports ?? {}).includes('"types"')
  const entryFile = join(pkgDir, rootEntry(pkg))
  const siblingTypes = ['.d.ts', '.d.mts', '.d.cts'].some((ext) =>
    existsSync(entryFile.replace(/\.[cm]?js$/, ext)),
  )
  return {
    version: pkg.version ?? null,
    license: typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? null),
    peerReact: pkg.peerDependencies?.react ?? null,
    peerDependencies: pkg.peerDependencies ?? {},
    shipsTypes: Boolean(pkg.types || pkg.typings || exportsHasTypes || siblingTypes),
  }
}

function measure(installDir, entry) {
  const result = esbuild.buildSync({
    ...BUILD_OPTIONS,
    stdin: { contents: entry, resolveDir: installDir, loader: 'js', sourcefile: 'entry.js' },
    outfile: join(installDir, 'bundle.js'),
  })
  const sum = (extension) =>
    result.outputFiles
      .filter((f) => f.path.endsWith(extension))
      .reduce((total, f) => total + f.contents.byteLength, 0)
  const gzipOf = (extension) => {
    const files = result.outputFiles.filter((f) => f.path.endsWith(extension))
    if (files.length === 0) return 0
    return files.reduce((total, f) => total + gzipSync(f.contents, { level: GZIP_LEVEL }).byteLength, 0)
  }
  const cssMin = sum('.css')
  return {
    minBytes: sum('.js'),
    gzipBytes: gzipOf('.js'),
    cssMinBytes: cssMin === 0 ? null : cssMin,
    cssGzipBytes: cssMin === 0 ? null : gzipOf('.css'),
  }
}

const scratch = mkdtempSync(join(tmpdir(), 'rmk-bundle-'))
const rows = []
try {
  for (const group of GROUPS) {
    const groupTargets = targets.filter((t) => t.group === group.id)
    if (groupTargets.length === 0) continue

    let installDir = null
    let installError = null
    process.stderr.write(`installing ${group.id}...\n`)
    try {
      installDir = installGroup(group, scratch)
    } catch (error) {
      installError = `install failed: ${errorText(error)}`
    }

    for (const target of groupTargets) {
      const row = {
        id: target.id,
        label: target.label,
        package: target.package,
        version: null,
        entry: target.entry,
        minBytes: null,
        gzipBytes: null,
        cssMinBytes: null,
        cssGzipBytes: null,
        license: null,
        peerReact: null,
        peerDependencies: null,
        shipsTypes: null,
        error: installError,
      }
      if (installDir) {
        try {
          Object.assign(row, metadata(installDir, target.package))
          row.alsoMeasured = (target.extraPackages ?? []).map((name) => ({
            package: name,
            version: metadata(installDir, name).version,
          }))
          if (row.alsoMeasured.length === 0) delete row.alsoMeasured
          Object.assign(row, measure(installDir, target.entry))
        } catch (error) {
          row.error = errorText(error)
        }
      }
      rows.push(row)
      const size = row.error ? row.error.slice(0, 60) : `${row.gzipBytes} B gzip`
      process.stderr.write(`  ${target.id.padEnd(20)} ${size}\n`)
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

const output = {
  measuredOn,
  generator: 'scripts/compare-bundles.mjs',
  method: {
    bundler: `esbuild ${esbuild.version}`,
    format: BUILD_OPTIONS.format,
    platform: BUILD_OPTIONS.platform,
    target: BUILD_OPTIONS.target,
    minify: true,
    treeShaking: true,
    external: EXTERNAL,
    define: BUILD_OPTIONS.define,
    gzip: `node:zlib gzipSync level ${GZIP_LEVEL}`,
    packageSource: 'npm tarball installed into a temporary directory; the kit from `npm pack` of its built dist',
    notes: [
      'Bytes are what a browser downloads for the recorded entry, not package size on disk.',
      'React and React DOM are external, so no row includes them.',
      'CSS is reported separately; JS byte counts exclude it.',
      'A row with a non-null error was not measured. No number in this file is estimated.',
    ],
  },
  results: rows,
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`)

const kb = (bytes) => (bytes === null ? '-' : `${(bytes / 1024).toFixed(1)} kB`)
const width = Math.max(...rows.map((r) => r.label.length))
console.log(`\nBundle sizes, measured ${measuredOn}, esbuild ${esbuild.version}\n`)
console.log(`${'Target'.padEnd(width)}  ${'Version'.padEnd(10)}  ${'Min'.padStart(10)}  ${'Gzip'.padStart(10)}`)
for (const row of rows) {
  const min = row.error ? 'error' : kb(row.minBytes)
  const gzip = row.error ? '' : kb(row.gzipBytes)
  console.log(
    `${row.label.padEnd(width)}  ${(row.version ?? '-').padEnd(10)}  ${min.padStart(10)}  ${gzip.padStart(10)}`,
  )
}
const failed = rows.filter((r) => r.error)
for (const row of failed) console.log(`\n${row.id}: ${row.error}`)
console.log(`\nWrote ${outFile.replace(`${root}/`, '')}`)
