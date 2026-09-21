#!/usr/bin/env node
/**
 * Fetches third-party conformance fixtures that are too large (and not ours)
 * to vendor into git. `fixtures/commonmark/spec.json` is gitignored, so CI
 * runs this before `vitest run`.
 *
 *   node scripts/fetch-fixtures.mjs
 *   node scripts/fetch-fixtures.mjs --force   # re-download even if present
 */
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const force = process.argv.includes('--force')

/** Pinned versions: a conformance suite that silently re-baselines is useless. */
const FIXTURES = [
  {
    url: 'https://spec.commonmark.org/0.31.2/spec.json',
    target: 'fixtures/commonmark/spec.json',
    describe: 'CommonMark 0.31.2 spec examples',
    verify: (text) => {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed) || parsed.length < 600) {
        throw new Error(`expected an array of 600+ examples, got ${parsed?.length}`)
      }
      for (const example of parsed) {
        if (typeof example.markdown !== 'string' || typeof example.html !== 'string') {
          throw new Error('example missing markdown/html')
        }
      }
      return parsed.length
    },
  },
]

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

let failed = false
for (const fixture of FIXTURES) {
  const target = resolve(root, fixture.target)
  if (!force && (await exists(target))) {
    console.log(`= ${fixture.target} (already present, --force to refresh)`)
    continue
  }
  process.stdout.write(`↓ ${fixture.describe} … `)
  try {
    const response = await fetch(fixture.url)
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
    const text = await response.text()
    const detail = fixture.verify(text)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, text)
    console.log(`ok (${detail} examples) -> ${fixture.target}`)
  } catch (error) {
    failed = true
    console.log(`FAILED: ${error.message}`)
  }
}

if (failed) process.exitCode = 1
