#!/usr/bin/env node
/**
 * Renderer benchmarks (spec 12.4).
 *
 * These are engineering gates, not marketing claims. The numbers printed here
 * are only meaningful with the methodology alongside them, which is why the
 * output includes the environment and the exact baseline version.
 *
 * Usage: node benchmarks/run.mjs [--json] [--write]
 *
 * `--write` also records the medians in docs/data/benchmarks.json, the file
 * every public figure is checked against (tests/published-figures.test.ts).
 * Rewrite the prose that quotes the old numbers in the same commit.
 */
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cpus, totalmem } from 'node:os'

const asJson = process.argv.includes('--json')
const write = process.argv.includes('--write')

// Benchmarks run against the BUILT package, the same artifact a consumer gets.
const { Markdown, compileMarkdown, defineMarkdownPreset, gfm } = await import(
  '../packages/renderer/dist/index.js'
)

let baseline = null
let baselineGfmPlugins = []
try {
  baseline = (await import('react-markdown')).default
  // The comparison must be like-for-like on DIALECT. Giving the kit GFM while
  // the baseline parses plain CommonMark makes the kit look ~2x slower purely
  // because it is doing strictly more parsing work (tables, footnotes,
  // autolinks). Both sides get GFM.
  baselineGfmPlugins = [(await import('remark-gfm')).default]
} catch {
  // Baseline is optional; the suite still reports absolute numbers without it.
}

const preset = defineMarkdownPreset({ extensions: [gfm()] })

const PARAGRAPH = `
## Section heading

Body text with **strong**, _emphasis_, \`inline code\` and a
[link](https://example.com/some/path) plus an ![image](https://example.com/a.png).

- list item one
- list item two with \`code\`
- list item three

> A blockquote with a second line.

\`\`\`ts
export function add(a: number, b: number): number {
  return a + b
}
\`\`\`

| Column A | Column B | Column C |
| --- | ---: | :---: |
| one | 1 | yes |
| two | 2 | no |
`

/** Builds a document of roughly the requested size in bytes. */
function corpus(targetBytes) {
  let out = '# Benchmark document\n'
  while (Buffer.byteLength(out) < targetBytes) out += PARAGRAPH
  return out
}

const ADVERSARIAL = {
  'deep nesting': '>'.repeat(300) + ' deep\n',
  'many emphasis runs': '*a*'.repeat(3000) + '\n',
  'unclosed emphasis': '*'.repeat(8000) + '\n',
  'long table row': '| ' + 'cell | '.repeat(400) + '\n| ' + '--- | '.repeat(400) + '\n',
  'many links': '[a](https://example.com) '.repeat(2000) + '\n',
  'backslash run': '\\'.repeat(10000) + '\n',
}

function measure(label, fn, iterations) {
  // Warm the JIT and any module-level caches. Several iterations, because the
  // first call through micromark allocates a lot of one-time state.
  for (let index = 0; index < 5; index += 1) fn()
  const samples = []
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now()
    fn()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  return {
    label,
    median: samples[Math.floor(samples.length / 2)],
    p95: samples[Math.floor(samples.length * 0.95)],
    min: samples[0],
    iterations,
  }
}

const ms = (value) => `${value.toFixed(2)} ms`
const results = { environment: {}, sizes: [], adversarial: [], compileVsRender: [] }

results.environment = {
  node: process.version,
  cpu: cpus()[0]?.model ?? 'unknown',
  cores: cpus().length,
  memoryGb: Math.round(totalmem() / 1024 ** 3),
  baseline: baseline ? 'react-markdown present' : 'react-markdown not installed',
}

if (!asJson) {
  console.log('React Markdown Kit — renderer benchmarks')
  console.log(`node ${results.environment.node} | ${results.environment.cpu} | ${results.environment.cores} cores\n`)
}

// Cold and repeated renders are measured separately (spec 12.4).
for (const [name, bytes, iterations] of [
  ['1 KB', 1024, 400],
  ['10 KB', 10 * 1024, 120],
  ['100 KB', 100 * 1024, 20],
]) {
  const source = corpus(bytes)
  const mine = measure(name, () => renderToStaticMarkup(createElement(Markdown, { preset }, source)), iterations)
  const row = { size: name, bytes: Buffer.byteLength(source), kit: mine }

  if (baseline) {
    const theirs = measure(
      name,
      () =>
        renderToStaticMarkup(
          createElement(baseline, { remarkPlugins: baselineGfmPlugins }, source),
        ),
      iterations,
    )
    row.baseline = theirs
    row.ratio = mine.median / theirs.median
  }
  results.sizes.push(row)

  if (!asJson) {
    const compare = row.ratio === undefined ? '' : `   vs baseline ${ms(row.baseline.median)} (${row.ratio.toFixed(2)}x)`
    console.log(`${name.padEnd(8)} median ${ms(mine.median).padEnd(12)} p95 ${ms(mine.p95).padEnd(12)}${compare}`)
  }
}

// Compiling once and rendering the document repeatedly should beat reparsing.
const source10k = corpus(10 * 1024)
const fromString = measure('string', () => renderToStaticMarkup(createElement(Markdown, { preset }, source10k)), 100)
const doc = compileMarkdown(source10k, { preset })
const fromDoc = measure('document', () => renderToStaticMarkup(createElement(Markdown, { preset, document: doc })), 100)
results.compileVsRender = [fromString, fromDoc]
if (!asJson) {
  console.log(
    `\nprecompiled 10 KB: ${ms(fromDoc.median)} vs ${ms(fromString.median)} from source ` +
      `(${(fromString.median / fromDoc.median).toFixed(2)}x faster to re-render)`,
  )
}

if (!asJson) console.log('\nadversarial inputs (must terminate quickly, not just be fast)')
for (const [name, source] of Object.entries(ADVERSARIAL)) {
  const result = measure(name, () => renderToStaticMarkup(createElement(Markdown, { preset }, source)), 20)
  results.adversarial.push(result)
  if (!asJson) console.log(`  ${name.padEnd(22)} median ${ms(result.median)}`)
}

if (write) {
  const round = (value) => Math.round(value * 100) / 100
  const median = (result) => ({ median: round(result.median), iterations: result.iterations })
  const data = {
    measuredOn: new Date().toISOString().slice(0, 10),
    generator: 'benchmarks/run.mjs --write',
    environment: {
      cpu: results.environment.cpu,
      cores: results.environment.cores,
      node: results.environment.node,
      baseline: 'react-markdown@10.1.0 with remark-gfm',
    },
    method: 'renderToStaticMarkup on the server, five warm-up calls, median of the iteration count, both sides parsing GFM',
    sizes: results.sizes.map((row) => ({
      size: row.size,
      kit: median(row.kit),
      baseline: row.baseline ? median(row.baseline) : null,
      ratio: row.ratio === undefined ? null : round(row.ratio),
    })),
    precompiled: {
      size: '10 KB',
      fromString: median(fromString),
      fromDocument: median(fromDoc),
      speedup: round(fromString.median / fromDoc.median),
    },
  }
  const file = new URL('../docs/data/benchmarks.json', import.meta.url)
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
  if (!asJson) console.log('\nWrote docs/data/benchmarks.json')
}

if (asJson) {
  console.log(JSON.stringify(results, null, 2))
} else {
  console.log(
    '\nMethodology: same process, JIT warmed, median of the iteration counts above,\n' +
      'renderToStaticMarkup on the server, both sides parsing GFM so the dialect\n' +
      'matches. Not published as a claim without this note.',
  )
}
