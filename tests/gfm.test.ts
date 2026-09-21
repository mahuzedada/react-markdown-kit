/**
 * RENDER-07 — GitHub Flavored Markdown conformance.
 *
 * Cases live in `fixtures/gfm/cases.json` and are derived from the GFM spec
 * (https://github.github.com/gfm/). Each case is asserted three ways:
 *
 *   1. the native `gfm()` extension produces the expected markup
 *   2. the `remark-gfm` plugin route produces byte-identical markup, because
 *      spec 6.5 says the two routes must agree and a kit that quietly renders
 *      plain CommonMark when you pass `remarkPlugins={[remarkGfm]}` is worse
 *      than one that refuses
 *   3. plain CommonMark (no GFM at all) does *not* produce the GFM markup, so
 *      an "expected" assertion that would pass without the extension cannot
 *      silently sit in the corpus
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import remarkGfm from 'remark-gfm'
import { normalizeHtml } from './helpers/html.js'

interface GfmCase {
  name: string
  category: string
  spec: string
  source: string
  expectedHtmlContains: string[]
  expectedHtmlNotContains: string[]
}

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/gfm/cases.json', import.meta.url), 'utf8'),
) as { cases: GfmCase[] }

const cases = fixture.cases
const nativePreset = defineMarkdownPreset({ extensions: [gfm()] })

const renderNative = (source: string): string =>
  renderToStaticMarkup(createElement(Markdown, { preset: nativePreset } as never, source))
const renderPlugin = (source: string): string =>
  renderToStaticMarkup(createElement(Markdown, { remarkPlugins: [remarkGfm] } as never, source))
const renderPlain = (source: string): string =>
  renderToStaticMarkup(createElement(Markdown, null, source))

describe('GFM conformance (RENDER-07)', () => {
  it('carries a corpus large enough to be worth trusting', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40)
    expect(new Set(cases.map((entry) => entry.name)).size).toBe(cases.length)
    for (const entry of cases) {
      expect(entry.expectedHtmlContains.length + entry.expectedHtmlNotContains.length, entry.name)
        .toBeGreaterThan(0)
    }
  })

  const categories = [...new Set(cases.map((entry) => entry.category))]
  describe.each(categories)('%s', (category) => {
    const scoped = cases.filter((entry) => entry.category === category)

    it.each(scoped.map((entry) => [entry.name, entry] as const))(
      '%s — native gfm()',
      (_name, entry) => {
        const html = renderNative(entry.source)
        for (const needle of entry.expectedHtmlContains) {
          expect(html, `GFM ${entry.spec}: expected to contain ${JSON.stringify(needle)}\n  got: ${html}`)
            .toContain(needle)
        }
        for (const needle of entry.expectedHtmlNotContains) {
          expect(html, `GFM ${entry.spec}: expected NOT to contain ${JSON.stringify(needle)}\n  got: ${html}`)
            .not.toContain(needle)
        }
      },
    )

    it.each(scoped.map((entry) => [entry.name, entry] as const))(
      '%s — remark-gfm route agrees with native (spec 6.5)',
      (_name, entry) => {
        expect(normalizeHtml(renderPlugin(entry.source)), entry.name).toBe(
          normalizeHtml(renderNative(entry.source)),
        )
      },
    )
  })

  it('every case actually depends on GFM being enabled', () => {
    // Guards the corpus against assertions that would hold for plain
    // CommonMark too, which would make a regression in gfm() invisible.
    const inert: string[] = []
    for (const entry of cases) {
      const plain = renderPlain(entry.source)
      const holds =
        entry.expectedHtmlContains.every((needle) => plain.includes(needle)) &&
        entry.expectedHtmlNotContains.every((needle) => !plain.includes(needle))
      if (holds) inert.push(entry.name)
    }
    // A handful of cases assert that something is *not* GFM (an unterminated
    // table, a bare domain). Those legitimately hold without GFM; they are
    // named so the exemption cannot spread unnoticed.
    const negativeCases = cases
      .filter((entry) => /-not-|-is-not-|cannot-|needs-|must-|undefined-|without-reference/.test(entry.name))
      .map((entry) => entry.name)
    expect(inert.filter((name) => !negativeCases.includes(name))).toEqual([])
  })

  it('reports corpus coverage', () => {
    const byCategory = new Map<string, number>()
    for (const entry of cases) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + 1)
    const lines = [
      '',
      `  GFM corpus — ${cases.length} cases, each run through gfm() and remark-gfm`,
      ...[...byCategory].map(([category, count]) => `    ${category.padEnd(16)}${String(count).padStart(4)}`),
      '',
    ]
    // eslint-disable-next-line no-console -- coverage summary is the point
    console.log(lines.join('\n'))
    expect(byCategory.size).toBeGreaterThanOrEqual(5)
  })
})
