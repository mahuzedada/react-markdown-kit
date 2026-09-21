/**
 * RENDER-05 — CommonMark 0.31.2 conformance.
 *
 * Every example from the official spec is rendered through `<Markdown>` with
 * no configuration and compared to the spec's expected HTML using the tolerant
 * comparison in `tests/helpers/html.ts`.
 *
 * Two escape hatches exist, and both are deliberately narrow:
 *
 *   html-by-design — the source parses to raw `html` mdast nodes, which the
 *     content policy (RENDER-08) never turns into markup: it renders them as
 *     escaped text, or removes them under `skipHtml`. The renderer is not a
 *     browser and does not execute HTML unless the application opts in, so
 *     these cannot pass and are not defects. Tracked as a separate,
 *     non-growing set.
 *
 *   knownFailures — real gaps, each with a one-line reason. The set may only
 *     shrink: a new failure fails the suite, and an entry that starts passing
 *     also fails the suite so the list cannot rot.
 *
 * Fixtures come from `pnpm fixtures` (scripts/fetch-fixtures.mjs); spec.json is
 * gitignored because it is not ours to vendor.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Markdown, { compileMarkdown } from '@react-markdown-kit/renderer'
import type { MarkdownNode } from '@react-markdown-kit/renderer'
import { describeDifference, normalizeHtml } from './helpers/html.js'

interface SpecExample {
  markdown: string
  html: string
  example: number
  section: string
}

type Cause = 'react-resource-preload' | 'url-policy'

interface KnownFailures {
  htmlByDesign: { criterion: string; examples: number[] }
  causes: Record<Cause, string>
  knownFailures: Record<string, { cause: Cause; reason: string }>
}

const specPath = new URL('../fixtures/commonmark/spec.json', import.meta.url)
const allowlistPath = new URL('../fixtures/commonmark/known-failures.json', import.meta.url)

function loadSpec(): SpecExample[] {
  try {
    return JSON.parse(readFileSync(specPath, 'utf8')) as SpecExample[]
  } catch {
    throw new Error(
      'fixtures/commonmark/spec.json is missing. Run `pnpm fixtures` (scripts/fetch-fixtures.mjs) first; it is gitignored on purpose.',
    )
  }
}

const examples = loadSpec()
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8')) as KnownFailures
const htmlByDesign = new Set(allowlist.htmlByDesign.examples)

/** True when the document contains raw HTML the default policy will drop. */
function containsRawHtml(source: string): boolean {
  let found = false
  const walk = (node: MarkdownNode): void => {
    if (found) return
    if (node.type === 'html') {
      found = true
      return
    }
    for (const child of node.children ?? []) walk(child)
  }
  walk(compileMarkdown(source).tree)
  return found
}

interface Result {
  example: SpecExample
  passed: boolean
  actual: string
  rawHtml: boolean
}

const results: Result[] = examples.map((example) => {
  let actual: string
  try {
    actual = renderToStaticMarkup(createElement(Markdown, null, example.markdown))
  } catch (error) {
    actual = `<!-- threw: ${(error as Error).message} -->`
  }
  const passed = normalizeHtml(actual) === normalizeHtml(example.html)
  return { example, passed, actual, rawHtml: passed ? false : containsRawHtml(example.markdown) }
})

const passing = results.filter((result) => result.passed)
const failing = results.filter((result) => !result.passed)
const byDesign = failing.filter((result) => result.rawHtml)
const realFailures = failing.filter((result) => !result.rawHtml)

const sections = [...new Set(examples.map((example) => example.section))]

describe('CommonMark 0.31.2 conformance (RENDER-05)', () => {
  describe.each(sections)('%s', (section) => {
    const sectionResults = results.filter((result) => result.example.section === section)
    it(`renders ${sectionResults.length} examples`, () => {
      const unexpected = sectionResults.filter(
        (result) =>
          !result.passed &&
          !(result.rawHtml && htmlByDesign.has(result.example.example)) &&
          allowlist.knownFailures[String(result.example.example)] === undefined,
      )
      const report = unexpected
        .map(
          (result) =>
            `example ${result.example.example}\n  source:   ${JSON.stringify(result.example.markdown)}\n${describeDifference(result.actual, result.example.html)}`,
        )
        .join('\n\n')
      expect(report, `unexpected CommonMark failures in "${section}"`).toBe('')
    })
  })

  it('reports the pass rate and never grows the allowlist', () => {
    const rate = ((passing.length / results.length) * 100).toFixed(2)
    const strictRate = (((passing.length + byDesign.length) / results.length) * 100).toFixed(2)

    const bySection = new Map<string, { total: number; failed: number[]; design: number[] }>()
    for (const result of results) {
      const entry = bySection.get(result.example.section) ?? { total: 0, failed: [], design: [] }
      entry.total += 1
      if (!result.passed) (result.rawHtml ? entry.design : entry.failed).push(result.example.example)
      bySection.set(result.example.section, entry)
    }

    const lines = [
      '',
      '  CommonMark 0.31.2 — PASS RATE',
      `  ${passing.length}/${results.length} examples match (${rate}%)`,
      `  ${strictRate}% counting the ${byDesign.length} raw-HTML examples the content policy never executes`,
      `  ${realFailures.length} real failures, all allowlisted`,
      '',
      '  section                                total   pass   html-by-design   failing',
      '  ' + '-'.repeat(76),
    ]
    for (const [section, entry] of bySection) {
      const pass = entry.total - entry.failed.length - entry.design.length
      lines.push(
        `  ${section.padEnd(38)}${String(entry.total).padStart(5)}${String(pass).padStart(7)}${String(entry.design.length).padStart(17)}${String(entry.failed.length).padStart(10)}`,
      )
    }
    lines.push('')
    for (const [section, entry] of bySection) {
      if (entry.failed.length === 0) continue
      lines.push(`  ${section}:`)
      for (const number of entry.failed) {
        const entryFor = allowlist.knownFailures[String(number)]
        lines.push(`    ${number}: [${entryFor?.cause ?? 'UNTRIAGED'}] ${entryFor?.reason ?? ''}`)
      }
    }
    // eslint-disable-next-line no-console -- the pass rate is the point of this suite
    console.log(lines.join('\n'))

    // The allowlist may shrink, never grow.
    const untriaged = realFailures
      .map((result) => result.example.example)
      .filter((number) => allowlist.knownFailures[String(number)] === undefined)
    expect(untriaged, 'new CommonMark failures — triage them, do not widen the normalizer').toEqual([])
    expect(realFailures.length).toBeLessThanOrEqual(Object.keys(allowlist.knownFailures).length)

    const stale = Object.keys(allowlist.knownFailures)
      .map(Number)
      .filter((number) => !realFailures.some((result) => result.example.example === number))
    expect(stale, 'these now pass — delete them from fixtures/commonmark/known-failures.json').toEqual([])

    const designStale = [...htmlByDesign].filter(
      (number) => !byDesign.some((result) => result.example.example === number),
    )
    expect(designStale, 'these no longer need the html-by-design exemption').toEqual([])
    expect(byDesign.length).toBeLessThanOrEqual(htmlByDesign.size)
  })

  it('proves every "react-resource-preload" failure is only a hoisted preload float', () => {
    // An allowlist entry is only honest if the stated cause fully accounts for
    // the difference. Removing React's resource floats must make the example
    // match exactly — if anything else differs, this fails.
    const entries = realFailures.filter(
      (result) => allowlist.knownFailures[String(result.example.example)]?.cause === 'react-resource-preload',
    )
    expect(entries.length).toBeGreaterThan(0)
    for (const result of entries) {
      const withoutFloats = result.actual.replace(/<link\b[^>]*\brel="preload"[^>]*>/g, '')
      expect(normalizeHtml(withoutFloats), `example ${result.example.example}`).toBe(
        normalizeHtml(result.example.html),
      )
    }
  })

  it('proves every "url-policy" failure is only the default URL policy', () => {
    const entries = realFailures.filter(
      (result) => allowlist.knownFailures[String(result.example.example)]?.cause === 'url-policy',
    )
    expect(entries.length).toBeGreaterThan(0)
    for (const result of entries) {
      const permissive = renderToStaticMarkup(
        // `children` passed as createElement's third argument cannot satisfy
        // the string/document union at the type level, so the props object is
        // widened here. The runtime call is identical.
        createElement(
          Markdown as never,
          { urlTransform: (url: string) => url, children: result.example.markdown },
        ),
      )
      expect(normalizeHtml(permissive), `example ${result.example.example}`).toBe(
        normalizeHtml(result.example.html),
      )
    }
  })

  it('proves every html-by-design example really does contain raw HTML', () => {
    for (const number of htmlByDesign) {
      const example = examples.find((candidate) => candidate.example === number)
      expect(example, `example ${number} is not in the spec`).toBeDefined()
      expect(containsRawHtml(example!.markdown), `example ${number}`).toBe(true)
    }
  })

  it('renders a compiled document identically to the source string', () => {
    // Spot-check that the document route (RENDER-03) is conformant too, rather
    // than running all 652 examples twice.
    const sample = results.filter((result) => result.passed).slice(0, 120)
    for (const { example } of sample) {
      const fromDocument = renderToStaticMarkup(
        createElement(Markdown, { document: compileMarkdown(example.markdown) }),
      )
      expect(normalizeHtml(fromDocument), `example ${example.example}`).toBe(normalizeHtml(example.html))
    }
  })
})
