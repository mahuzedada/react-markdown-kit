/**
 * Conformance against Mermaid's own documentation examples and against
 * Mermaid.js (docs/MERMAID_PLATFORM.md section 10.2).
 *
 * `tests/corpus/<kind>/*.mmd` holds the examples verbatim, one directory
 * per kind named after the kind. For every file the kind's `parse` returns
 * a model with no `invalid` problem, and for kinds with `write` the written
 * source parses to an equal model and contains every retained line. Then
 * Mermaid.js itself (the root devDependency, never a package dependency)
 * must accept every file and every `write` output, which is what makes the
 * problem severities and the written output trustworthy.
 *
 * This file runs under jsdom by its `.dom.test` name. Mermaid 11 imports
 * and parses under jsdom with no setup: `mermaid.parse` only lexes and
 * parses, it touches no DOM, so no `initialize` call is needed. The test
 * never skips: a corpus directory that names no kind, an empty directory
 * or an import failure is a failure.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mermaid from 'mermaid'
import { describe, expect, it } from 'vitest'
import { defaultKinds } from '../src/core/kinds.js'
import type { DiagramKind, DiagramParse } from '../src/core/kind.js'

// A path from the module URL string: under jsdom `new URL()` is jsdom's class, which Node's fileURLToPath rejects.
const CORPUS = join(dirname(fileURLToPath(import.meta.url)), 'corpus')

const kinds = defaultKinds()
const directories = readdirSync(CORPUS)
  .filter((name) => statSync(join(CORPUS, name)).isDirectory())
  .sort()

function parsed(kind: DiagramKind, source: string): DiagramParse<unknown> {
  const result = kind.parse(source)
  if ('error' in result) throw new Error(`${kind.name} parse error: ${result.error}`)
  return result
}

describe('corpus', () => {
  it('has one directory per kind with examples in it', () => {
    expect(directories.length).toBeGreaterThan(0)
    for (const directory of directories) {
      expect(kinds.map((k) => k.name), `corpus/${directory} names no registered kind`).toContain(directory)
      expect(readdirSync(join(CORPUS, directory)).filter((f) => f.endsWith('.mmd')).length, `corpus/${directory} is empty`).toBeGreaterThan(0)
    }
  })

  for (const directory of directories) {
    const kind = kinds.find((k) => k.name === directory)
    if (kind === undefined) continue
    const files = readdirSync(join(CORPUS, directory))
      .filter((f) => f.endsWith('.mmd'))
      .sort()

    describe(kind.name, () => {
      for (const file of files) {
        const source = readFileSync(join(CORPUS, directory, file), 'utf8')

        it(`${file}: parses with no invalid problem`, () => {
          const result = parsed(kind, source)
          expect(result.problems.filter((p) => p.severity === 'invalid')).toEqual([])
        })

        if (kind.write !== undefined) {
          it(`${file}: write(parse(x)) parses to the same model and keeps every retained line`, () => {
            const first = parsed(kind, source)
            const written = kind.write!(first.model, { retained: first.retained })
            const second = parsed(kind, written)
            expect(second.model).toEqual(first.model)
            for (const line of first.retained) expect(written).toContain(line.text)
            expect(kind.write!(second.model, { retained: second.retained })).toBe(written)
          })
        }

        it(`${file}: Mermaid.js accepts it`, async () => {
          await expect(mermaid.parse(source, { suppressErrors: false })).resolves.toBeTruthy()
        })

        if (kind.write !== undefined) {
          it(`${file}: Mermaid.js accepts the written output`, async () => {
            const first = parsed(kind, source)
            const written = kind.write!(first.model, { retained: first.retained })
            await expect(mermaid.parse(written, { suppressErrors: false })).resolves.toBeTruthy()
          })
        }
      }
    })
  }
})
