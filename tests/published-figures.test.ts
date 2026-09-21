/**
 * Every measured figure on the public surface comes from a committed data
 * file (docs/SEO_WORKPLAN.md section 0, the claims policy):
 *
 * - `docs/data/benchmarks.json`: render medians, ratios, the precompiled speedup
 * - `docs/data/bundle-sizes.json`: gzipped and minified bytes per import
 * - `docs/data/mermaid-size.json`: the Mermaid plugin against Mermaid.js
 *
 * Prose cannot import JSON, so this test scans the published sources for every
 * decimal figure with a unit (`1.21x`, `16.80 ms`, `36.8 KB`) and fails on any
 * value the data does not produce. After `node benchmarks/run.mjs --write` or
 * `pnpm size:bundles`, it lists every sentence still quoting the old numbers.
 * Whole numbers are not checked: they are document sizes ("a 10 KB document").
 */
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import benchmarks from '../docs/data/benchmarks.json'
import bundles from '../docs/data/bundle-sizes.json'
import mermaidSize from '../docs/data/mermaid-size.json'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** Everything a visitor, an npm reader or a model reads. */
const PUBLISHED = [
  'public-sites/*/src/*',
  'public-sites/docs/docs/*',
  'public-sites/shared/llms/*',
  'packages/*/README.md',
  'plugins/*/README.md',
  'examples/*/README.md',
  'README.md',
  'benchmarks/README.md',
]

/** Figures that describe no measurement in the data files, with the reason. */
const EXEMPT: Readonly<Record<string, string>> = {
  '12.4 ms': 'sample Markdown a live example renders ("Cold render | 12.4 ms | 9.1 ms")',
  '9.1 ms': 'the same sample table',
  '2.2x': "benchmarks/README.md's note on an earlier, mismatched-dialect harness",
}

type Unit = 'x' | 'ms' | 'KB'

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`

function allowedFigures(): Set<string> {
  const allowed = new Set<string>()
  const ms = (median: number): void => void allowed.add(`${median.toFixed(2)} ms`)
  const ratio = (value: number, digits: number): void => void allowed.add(`${value.toFixed(digits)}x`)

  for (const row of benchmarks.sizes) {
    ms(row.kit.median)
    if (row.baseline !== null) ms(row.baseline.median)
    if (row.ratio !== null) ratio(row.ratio, 2)
  }
  ms(benchmarks.precompiled.fromString.median)
  ms(benchmarks.precompiled.fromDocument.median)
  ratio(benchmarks.precompiled.speedup, 1)
  ratio(benchmarks.precompiled.speedup, 2)

  const measured = bundles.results.filter((row) => row.error === null)
  for (const row of measured) {
    allowed.add(kb(row.gzipBytes))
    allowed.add(kb(row.minBytes))
    // Differences between two rows, as CompareTable's gzipDifference prints them.
    for (const other of measured) allowed.add(kb(Math.abs(row.gzipBytes - other.gzipBytes)))
  }

  const { plugin, mermaid } = mermaidSize
  for (const bytes of [plugin.minified, plugin.gzipped]) allowed.add(kb(bytes))
  for (const part of [mermaid.entry, mermaid.flowchart, mermaid.all]) {
    allowed.add(kb(part.minified))
    allowed.add(kb(part.gzipped))
  }
  return allowed
}

function bytes(id: string): number {
  const row = bundles.results.find((result) => result.id === id)
  if (row?.gzipBytes == null) throw new Error(`No measured bundle-size row ${id}`)
  return row.gzipBytes
}
const gzip = (id: string): string => kb(bytes(id))

const unit = (raw: string): Unit => (raw === 'x' ? 'x' : raw === 'ms' ? 'ms' : 'KB')
const format = (value: string, raw: string): string => (unit(raw) === 'x' ? `${value}x` : `${value} ${unit(raw)}`)

function publishedFiles(): string[] {
  return execFileSync('git', ['ls-files', '--', ...PUBLISHED], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((file) => /\.(md|mdx|ts|tsx|txt)$/.test(file))
}

describe('published figures', () => {
  const allowed = allowedFigures()
  const files = publishedFiles()

  it('scans the public surface', () => {
    expect(files).toContain('public-sites/shared/llms/llms.txt')
    expect(files).toContain('public-sites/home/src/Landing.tsx')
    expect(files.length).toBeGreaterThan(50)
  })

  it('quotes only figures the committed data produces', () => {
    const stale: string[] = []
    for (const file of files) {
      const lines = readFileSync(join(root, file), 'utf8').split('\n')
      lines.forEach((line, index) => {
        for (const match of line.matchAll(/(?<![\w.])(\d+\.\d+)\s?(x|ms|KB|kB|KiB)(?!\w)/g)) {
          const figure = format(match[1], match[2])
          if (!allowed.has(figure) && !(figure in EXEMPT)) stale.push(`${file}:${index + 1}: ${figure}`)
        }
      })
    }
    expect(stale).toEqual([])
  })
})

describe('llms.txt', () => {
  const VERSIONS: Record<string, string> = {
    'react-markdown': 'react-markdown',
    'markdown-to-jsx': 'markdown-to-jsx',
    Streamdown: 'streamdown',
    MDXEditor: 'mdxeditor',
    Milkdown: 'milkdown',
  }

  for (const file of ['llms.txt', 'llms-full.txt']) {
    const text = readFileSync(join(root, 'public-sites/shared/llms', file), 'utf8')

    it(`${file} names the competitor versions that were measured`, () => {
      const named = [...text.matchAll(/^- Against (\S+) (\d+\.\d+\.\d+):/gm)]
      expect(named.map((match) => match[1]).sort()).toEqual(Object.keys(VERSIONS).sort())
      for (const [, name, version] of named) {
        const row = bundles.results.find((result) => result.id === VERSIONS[name])
        expect(version, name).toBe(row?.version)
      }
    })

    it(`${file} states the date and bundler of the measurement`, () => {
      expect(text).toContain(`on ${bundles.measuredOn} with ${bundles.method.bundler}`)
    })

    it(`${file} quotes each competitor's measured size in its own sentence`, () => {
      const line = (name: string): string => text.split('\n').find((candidate) => candidate.startsWith(`- Against ${name} `)) ?? ''
      expect(line('react-markdown')).toContain(
        `${gzip('kit-renderer')} gzipped against ${gzip('react-markdown')} (${gzip('kit-renderer-gfm')} against ${gzip('react-markdown-gfm')} with GFM)`,
      )
      expect(line('markdown-to-jsx')).toContain(`${gzip('markdown-to-jsx')} gzipped against ${gzip('kit-renderer')}`)
      expect(line('Streamdown')).toContain(`${gzip('kit-renderer-gfm')} gzipped against ${gzip('streamdown')}`)
      expect(line('MDXEditor')).toContain(`${gzip('kit-editor')} gzipped against ${gzip('mdxeditor')}`)
      expect(line('Milkdown')).toContain(`${gzip('milkdown')} gzipped against ${gzip('kit-editor')}`)
    })

    it(`${file} says which import is smaller the way the data does`, () => {
      // Both sentences call the competitor "the smaller import".
      expect(bytes('markdown-to-jsx')).toBeLessThan(bytes('kit-renderer'))
      expect(bytes('milkdown')).toBeLessThan(bytes('kit-editor'))
    })

    it(`${file} quotes the benchmark ratios`, () => {
      const [small, medium, large] = benchmarks.sizes
      expect(Math.abs((medium.ratio ?? 0) - 1), 'the text says "at parity at 10 KB"').toBeLessThanOrEqual(0.05)
      expect(text).toContain(
        `It is ${small.ratio?.toFixed(2)}x slower than react-markdown on a 1 KB document, at parity at 10 KB, ` +
          `${large.ratio?.toFixed(2)}x at 100 KB, and a precompiled document re-renders ` +
          `${benchmarks.precompiled.speedup.toFixed(1)}x faster than parsing again`,
      )
    })
  }
})
