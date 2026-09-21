#!/usr/bin/env node
/**
 * DX-03 — local comparison runner.
 *
 * Renders a project's own Markdown corpus through both `react-markdown` and
 * `@react-markdown-kit/renderer` and reports where the output differs, so a
 * team can decide from their real content instead of from our claims.
 *
 * Nothing leaves the machine. There is no service, no upload, no telemetry
 * (spec 13.3).
 *
 * Usage:
 *   npx rmk-compare 'content/<glob>.md'
 *   npx rmk-compare 'content/<glob>.md' --gfm --json
 */
import { readFileSync, globSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const useGfm = args.includes('--gfm')
const showDiff = args.includes('--diff')
const patterns = args.filter((a) => !a.startsWith('--'))

if (patterns.length === 0) {
  console.error("usage: rmk-compare '<glob>' [--gfm] [--json] [--diff]")
  process.exit(1)
}

const require = createRequire(`${process.cwd()}/`)
let React, renderToStaticMarkup, baseline, kit, remarkGfm

try {
  React = require('react')
  renderToStaticMarkup = require('react-dom/server').renderToStaticMarkup
  baseline = interop(require('react-markdown'))
  kit = require('@react-markdown-kit/renderer')
  if (useGfm) remarkGfm = interop(require('remark-gfm'))
} catch (error) {
  console.error('Could not load both renderers from this project.')
  console.error('Install them first:\n  npm i -D react-markdown @react-markdown-kit/renderer' + (useGfm ? ' remark-gfm' : ''))
  console.error(`\n(${error.message})`)
  process.exit(1)
}

function interop(mod) {
  return mod?.default ?? mod
}

/**
 * Normalizes HTML so the comparison reports meaningful differences rather than
 * formatting noise: attributes sorted, whitespace collapsed between block
 * boundaries, React 19's hoisted resource-preload floats removed (both
 * renderers emit them identically, so they are not a difference).
 */
function normalize(html) {
  return html
    .replace(/<link[^>]*rel="preload"[^>]*>/g, '')
    .replace(/<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>/g, (_, tag, attrs, close) => {
      const pairs = [...attrs.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)]
        .map((m) => (m[2] === undefined ? m[1] : `${m[1]}="${m[2]}"`))
        .sort()
      return `<${tag}${pairs.length ? ' ' + pairs.join(' ') : ''}${close}>`
    })
    .replace(/>\s+</g, '><')
    .trim()
}

const preset = useGfm ? kit.defineMarkdownPreset({ extensions: [kit.gfm()] }) : undefined
const baseProps = useGfm ? { remarkPlugins: [remarkGfm] } : {}

let files = []
for (const pattern of patterns) {
  try {
    files.push(...globSync(pattern))
  } catch {
    files.push(pattern)
  }
}
files = [...new Set(files)].filter((f) => /\.mdx?$|\.markdown$|\.txt$/.test(f))

const results = { matching: [], differing: [], errors: [], total: 0 }

for (const file of files) {
  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  results.total += 1

  let theirs, ours
  try {
    theirs = renderToStaticMarkup(React.createElement(baseline, baseProps, source))
  } catch (error) {
    results.errors.push({ file, side: 'react-markdown', message: error.message })
    continue
  }
  try {
    ours = renderToStaticMarkup(
      React.createElement(kit.Markdown, preset ? { preset } : {}, source),
    )
  } catch (error) {
    results.errors.push({ file, side: 'react-markdown-kit', message: error.message })
    continue
  }

  const a = normalize(theirs)
  const b = normalize(ours)
  if (a === b) {
    results.matching.push(file)
  } else {
    results.differing.push({ file, bytes: source.length, baseline: a, kit: b, at: firstDifference(a, b) })
  }
}

function firstDifference(a, b) {
  let index = 0
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1
  const window = 60
  return {
    index,
    baseline: a.slice(Math.max(0, index - 20), index + window),
    kit: b.slice(Math.max(0, index - 20), index + window),
  }
}

if (asJson) {
  console.log(JSON.stringify(results, null, 2))
  process.exit(results.differing.length > 0 ? 1 : 0)
}

const pct = results.total === 0 ? 0 : Math.round((results.matching.length / results.total) * 100)
console.log('rmk-compare — local corpus comparison')
console.log(`dialect: ${useGfm ? 'GFM on both sides' : 'CommonMark on both sides'}`)
console.log(`baseline: react-markdown ${safeVersion('react-markdown')}\n`)
console.log(`${results.total} document(s) compared`)
console.log(`  matching   ${results.matching.length} (${pct}%)`)
console.log(`  differing  ${results.differing.length}`)
console.log(`  errors     ${results.errors.length}\n`)

if (results.differing.length > 0) {
  console.log('Differences:')
  for (const item of results.differing) {
    console.log(`  ${item.file}  (first difference at character ${item.at.index})`)
    if (showDiff) {
      console.log(`    react-markdown: ${JSON.stringify(item.at.baseline)}`)
      console.log(`    this renderer : ${JSON.stringify(item.at.kit)}`)
    }
  }
  if (!showDiff) console.log('\n  Pass --diff to see the differing output inline.')
  console.log()
}

if (results.errors.length > 0) {
  console.log('Errors:')
  for (const item of results.errors) console.log(`  ${item.file} [${item.side}] ${item.message}`)
  console.log()
}

console.log('Nothing was uploaded. This ran entirely on this machine.')
if (results.differing.length > 0) {
  console.log('See docs/COMPATIBILITY.md for the known, classified differences.')
  process.exit(1)
}

/**
 * Reads a dependency's version. `require('<pkg>/package.json')` is blocked by
 * many packages' exports maps, so fall back to resolving the entry and walking
 * up to the nearest manifest.
 */
function safeVersion(name) {
  try {
    return require(`${name}/package.json`).version
  } catch {
    try {
      let dir = dirname(require.resolve(name))
      for (let up = 0; up < 6; up += 1) {
        const candidate = join(dir, 'package.json')
        if (existsSync(candidate)) {
          const pkg = JSON.parse(readFileSync(candidate, 'utf8'))
          if (pkg.name === name) return pkg.version
        }
        dir = dirname(dir)
      }
    } catch {
      /* fall through */
    }
    return 'unknown'
  }
}
