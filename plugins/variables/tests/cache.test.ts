/**
 * Spec 11.3 / 8.20 — "customer-specific resolved outputs cannot leak through
 * incorrectly keyed caches".
 *
 * The plugin keeps no state between compilations. These tests pin that down
 * from the outside: resolve the same source repeatedly for different
 * customers and assert no state carries.
 */
import { describe, expect, it } from 'vitest'
import { defineDocument, expectOk, textOf, toMarkdown } from './helpers.js'

describe('resolved output is never cached (spec 11.3)', () => {
  const report = defineDocument('# Report for {{customer.name}}\n\nBalance: {{customer.balance}}')

  it('gives each customer their own document', () => {
    const acme = expectOk(report.resolve({ customer: { name: 'Acme', balance: 1 } }))
    const globex = expectOk(report.resolve({ customer: { name: 'Globex', balance: 2 } }))

    expect(textOf(acme)).toContain('Acme')
    expect(textOf(acme)).not.toContain('Globex')
    expect(textOf(globex)).toContain('Globex')
    expect(textOf(globex)).not.toContain('Acme')
  })

  it('does not let an earlier resolution mutate a later one', () => {
    const first = expectOk(report.resolve({ customer: { name: 'Acme', balance: 1 } }))
    const before = toMarkdown(first)
    report.resolve({ customer: { name: 'Globex', balance: 2 } })
    // The first document is still exactly what it was.
    expect(toMarkdown(first)).toBe(before)
  })

  it('returns a fresh tree each time, sharing no node objects', () => {
    const a = expectOk(report.resolve({ customer: { name: 'Acme', balance: 1 } }))
    const b = expectOk(report.resolve({ customer: { name: 'Acme', balance: 1 } }))
    expect(a.tree).not.toBe(b.tree)
    expect(a.tree.children[0]).not.toBe(b.tree.children[0])
    expect(toMarkdown(a)).toBe(toMarkdown(b))
  })

  it('survives a failed resolution without poisoning the next one', () => {
    expect(report.resolve({ customer: { name: 'Acme' } }).ok).toBe(false)
    const after = expectOk(report.resolve({ customer: { name: 'Acme', balance: 5 } }))
    expect(textOf(after)).toContain('Balance: 5')
  })

  it('does not accumulate diagnostics across resolutions', () => {
    report.resolve({})
    report.resolve({})
    const result = expectOk(report.resolve({ customer: { name: 'Acme', balance: 1 } }))
    expect(result.diagnostics).toEqual([])
  })
})

describe('the document stays JSON-serializable (spec 4.1, 8.16)', () => {
  it('survives structuredClone and JSON round trips', () => {
    const document = expectOk(defineDocument('# {{a}}').resolve({ a: 'x' }))
    expect(structuredClone(document)).toEqual(document)
    expect(JSON.parse(JSON.stringify(document))).toEqual(document)
  })

  it('carries no methods, which is why toMarkdown is a utility (spec 8.16)', () => {
    const document = expectOk(defineDocument('# {{a}}').resolve({ a: 'x' }))
    expect((document as unknown as { toMarkdown?: unknown }).toMarkdown).toBeUndefined()
    for (const value of Object.values(document)) expect(typeof value).not.toBe('function')
  })

  it('omits the authored source by default so tree and source cannot disagree', () => {
    const document = expectOk(defineDocument('# {{a}}').resolve({ a: 'x' }))
    expect(document.source).toBeUndefined()
  })

  it('retains the authored source on request', () => {
    const document = expectOk(
      defineDocument('# {{a}}').resolve({ a: 'x' }, { retainSource: true }),
    )
    expect(document.source).toBe('# {{a}}')
  })
})
