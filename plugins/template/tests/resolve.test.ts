/**
 * Spec 8.2 – 8.9: the template object, its overloads, and the resolution
 * result. The gate this file covers: "simple no-schema API works", "generic
 * typing works", "malformed/missing values yield structured diagnostics".
 */
import { describe, expect, it } from 'vitest'
import { TEMPLATE_DIAGNOSTIC_CODES } from '../src/index.js'
import { defineTemplate, toMarkdown } from './helpers.js'
import { textOf } from './helpers.js'

describe('minimal API (spec 8.3)', () => {
  it('resolves a string template with no schema and no config', () => {
    const greeting = defineTemplate('# Hello {{user.name}}')
    const result = greeting.resolve({ user: { name: 'Chatis' } })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(textOf(result.document)).toBe('Hello Chatis')
    expect(result.document.contractVersion).toBe(1)
    expect(result.document.tree.children[0]?.type).toBe('heading')
  })

  it('resolves several placeholders across several blocks', () => {
    const template = defineTemplate('# Hello {{user.name}}\n\nWelcome to {{company.name}}.')
    const result = template.resolve({ user: { name: 'Ada' }, company: { name: 'ZUI' } })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toMarkdown(result.document).trim()).toBe('# Hello Ada\n\nWelcome to ZUI.')
  })

  it('leaves a document with no placeholders untouched', () => {
    const template = defineTemplate('# Static\n\nNothing to fill.')
    const result = template.resolve({})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toMarkdown(result.document).trim()).toBe('# Static\n\nNothing to fill.')
  })
})

describe('generic typing (spec 8.4)', () => {
  it('accepts an explicit data type parameter', () => {
    type ReportData = { customer: { name: string }; revenue: number }
    const data: ReportData = { customer: { name: 'Acme' }, revenue: 50_000 }
    const result = defineTemplate('# {{customer.name}}\n\nRevenue: {{revenue}}').resolve(data)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toMarkdown(result.document)).toContain('Revenue: 50000')
  })
})

describe('missing values (spec 8.7)', () => {
  it('fails rather than producing a publishable-looking document', () => {
    const report = defineTemplate('# {{customer.name}}\n\nAccount {{customer.accountNumber}}')
    const result = report.resolve({ customer: { name: 'Acme' } })

    expect(result.ok).toBe(false)
    expect(result.document).toBeUndefined()
    const codes = result.diagnostics.map((d) => d.code)
    expect(codes).toContain(TEMPLATE_DIAGNOSTIC_CODES.requiredValue)
  })

  it('reports the path and never the surrounding runtime values (spec 11.4)', () => {
    const report = defineTemplate('{{customer.accountNumber}} for {{customer.name}}')
    const result = report.resolve({ customer: { name: 'Very Secret Corp' } })

    expect(result.ok).toBe(false)
    const missing = result.diagnostics.find(
      (d) => d.code === TEMPLATE_DIAGNOSTIC_CODES.requiredValue,
    )
    expect(missing?.path).toBe('customer.accountNumber')
    expect(missing?.message).toBe('Missing required variable: customer.accountNumber')
    expect(missing?.severity).toBe('error')
    for (const d of result.diagnostics) expect(d.message).not.toContain('Very Secret Corp')
  })

  it('treats null like missing', () => {
    const template = defineTemplate('Hello {{user.name}}')
    expect(template.resolve({ user: { name: null } }).ok).toBe(false)
  })

  it('resolves a declared-optional variable to empty text with an info diagnostic', () => {
    const template = defineTemplate({
      source: 'Hello {{user.nickname}}!',
      variables: { 'user.nickname': { required: false } },
    })
    const result = template.resolve({ user: {} })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(textOf(result.document)).toBe('Hello !')
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.optionalValueMissing,
    )
  })

  it('uses a declared default when the value is absent', () => {
    const template = defineTemplate({
      source: 'Hello {{user.name}}',
      variables: { 'user.name': { default: 'there' } },
    })
    const result = template.resolve({})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(textOf(result.document)).toBe('Hello there')
  })

  it('rejects an object value: there is nothing sensible to print', () => {
    const template = defineTemplate('Hello {{user}}')
    const result = template.resolve({ user: { name: 'Ada' } })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.valueNotScalar,
    )
  })

  it('writes numbers, booleans and dates without a formatter', () => {
    const template = defineTemplate('{{n}} {{b}} {{d}}')
    const result = template.resolve({ n: 42, b: true, d: new Date('2026-01-02T03:04:05Z') })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(textOf(result.document)).toBe('42 true 2026-01-02T03:04:05.000Z')
  })
})

describe('unknown formatter and malformed syntax (spec 8.10)', () => {
  it('diagnoses an unknown formatter', () => {
    const template = defineTemplate('{{revenue | bananas}}')
    const result = template.resolve({ revenue: 1 })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.unknownFormatter,
    )
  })

  it('diagnoses a path the grammar does not accept', () => {
    const template = defineTemplate('{{user.name()}}')
    const result = template.resolve({ user: { name: 'x' } })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(TEMPLATE_DIAGNOSTIC_CODES.invalidPath)
  })

  it('has no expression language: arithmetic is not a path', () => {
    const template = defineTemplate('{{1 + 1}}')
    const result = template.resolve({})
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(TEMPLATE_DIAGNOSTIC_CODES.invalidPath)
  })
})
