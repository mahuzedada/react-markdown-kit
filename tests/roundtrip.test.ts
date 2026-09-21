/**
 * Editor round-trip corpus.
 *
 * `fixtures/editor-roundtrip/corruption.json` is the audit corpus from
 * docs/AUDIT.md G4: 22 inputs that the previous line-oriented editor corrupted
 * on save. The contract asserted here is the one that matters to a user:
 *
 *   compile(source) and compile(roundTrip(source)) must be the same tree.
 *
 * Meaning must survive a save. Bytes need not: the serializer normalizes
 * (a setext heading becomes an ATX heading, a `~~~` fence becomes ```` ``` ````),
 * and normalization is not corruption. The table in the test output records
 * which cases are byte-identical anyway.
 *
 * The third assertion is the one the audit was really about: saving twice must
 * not differ from saving once. G4's complaint was that each save compounded
 * the damage, so idempotence is the property that proves it is fixed.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compileMarkdown, documentToMarkdown } from '@react-markdown-kit/renderer'
import type { MarkdownNode } from '@react-markdown-kit/renderer'

interface CorruptionCase {
  name: string
  source: string
  why: string
}

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/editor-roundtrip/corruption.json', import.meta.url), 'utf8'),
) as { cases: CorruptionCase[] }

const cases = fixture.cases

/**
 * Source positions describe where a node came from, not what it means. They
 * necessarily move when the serializer normalizes, so they are stripped before
 * comparing. Nothing else is stripped.
 */
function withoutPositions(node: MarkdownNode): unknown {
  const { position: _position, ...rest } = node as MarkdownNode & { position?: unknown }
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(rest).sort()) {
    const value = (rest as Record<string, unknown>)[key]
    result[key] =
      Array.isArray(value)
        ? value.map((entry) =>
            typeof entry === 'object' && entry !== null && 'type' in entry
              ? withoutPositions(entry as MarkdownNode)
              : entry,
          )
        : value
  }
  return result
}

const roundTrip = (source: string): Promise<string> => documentToMarkdown(compileMarkdown(source))
const meaning = (source: string): unknown => withoutPositions(compileMarkdown(source).tree)

interface Outcome {
  name: string
  semantic: boolean
  byteIdentical: boolean
  idempotent: boolean
  output: string
}

const outcomes: Outcome[] = []

/**
 * Cases whose round trip is byte-identical today. This list may grow; it must
 * not shrink, because losing byte identity is a regression even when meaning
 * survives.
 */
const BYTE_IDENTICAL = [
  'blockquote-blank-line',
  'blockquote-nested',
  'backslash-hard-break',
  'windows-path',
  'loose-list-second-paragraph',
  'reference-link',
  'reference-image',
  'image-inline',
  'image-with-title',
  'autolink',
  'html-block',
  'html-comment',
  'ordered-list-start',
  'soft-break',
]

describe('editor round trip (AUDIT G4)', () => {
  it('has the full audit corpus', () => {
    expect(cases.length).toBe(22)
    expect(new Set(cases.map((entry) => entry.name)).size).toBe(22)
  })

  describe.each(cases.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
    it('survives a round trip with its meaning intact', async () => {
      const output = await roundTrip(entry.source)
      const once = await roundTrip(output)
      const outcome: Outcome = {
        name: entry.name,
        semantic: JSON.stringify(meaning(output)) === JSON.stringify(meaning(entry.source)),
        byteIdentical: output === entry.source,
        idempotent: once === output,
        output,
      }
      outcomes.push(outcome)

      expect(
        meaning(output),
        `${entry.name}: ${entry.why}\n  in:  ${JSON.stringify(entry.source)}\n  out: ${JSON.stringify(output)}`,
      ).toEqual(meaning(entry.source))
    })

    it('is idempotent, so a second save cannot compound the change', async () => {
      const once = await roundTrip(entry.source)
      const twice = await roundTrip(once)
      expect(twice, `${entry.name}: saving twice differs from saving once`).toBe(once)
    })
  })

  it('reports byte identity and never loses it', () => {
    expect(outcomes.length, 'round-trip cases must run first').toBe(cases.length)
    const byName = new Map(outcomes.map((outcome) => [outcome.name, outcome]))

    const width = Math.max(...cases.map((entry) => entry.name.length))
    const lines = [
      '',
      '  Editor round trip — 22 audit cases',
      `  ${'case'.padEnd(width)}  semantic  byte-identical  idempotent`,
      '  ' + '-'.repeat(width + 38),
    ]
    for (const entry of cases) {
      const outcome = byName.get(entry.name)!
      lines.push(
        `  ${entry.name.padEnd(width)}  ${(outcome.semantic ? 'yes' : 'NO').padEnd(8)}  ${(outcome.byteIdentical ? 'yes' : 'no').padEnd(14)}  ${outcome.idempotent ? 'yes' : 'NO'}`,
      )
    }
    const identical = outcomes.filter((outcome) => outcome.byteIdentical)
    lines.push(
      '',
      `  semantic stability: ${outcomes.filter((outcome) => outcome.semantic).length}/${outcomes.length}`,
      `  byte identity:      ${identical.length}/${outcomes.length}`,
      `  idempotent:         ${outcomes.filter((outcome) => outcome.idempotent).length}/${outcomes.length}`,
      '',
      '  normalized (meaning preserved, bytes changed):',
    )
    for (const outcome of outcomes.filter((entry) => !entry.byteIdentical)) {
      lines.push(`    ${outcome.name.padEnd(width)}  ${JSON.stringify(outcome.output)}`)
    }
    lines.push('')
    // eslint-disable-next-line no-console -- the table is the deliverable
    console.log(lines.join('\n'))

    const lost = BYTE_IDENTICAL.filter((name) => !byName.get(name)?.byteIdentical)
    expect(lost, 'these used to round-trip byte-identically and no longer do').toEqual([])
  })
})
