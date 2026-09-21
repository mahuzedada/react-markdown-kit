/**
 * Spec 8.5 / 8.20 — "at least two Standard Schema-compatible validators pass
 * integration tests".
 *
 * Both validators here are hand-rolled: the package must consume the
 * `~standard` interface *structurally*, with no runtime dependency on Zod,
 * Valibot, ArkType or `@standard-schema/spec`. Two different vendors with
 * different issue shapes prove the coupling really is to the interface.
 */
import { describe, expect, it } from 'vitest'
import { template, TEMPLATE_DIAGNOSTIC_CODES, type StandardSchema } from '../src/index.js'
import { isStandardSchema } from '../src/engine/standard-schema.js'
import { defineTemplate } from './helpers.js'
import { textOf } from './helpers.js'

type ReportData = { customer: { name: string }; revenue: number }

/** Vendor one: reports issues with an array-of-keys path, like Zod. */
const strictReport: StandardSchema<unknown, ReportData> = {
  '~standard': {
    version: 1,
    vendor: 'test-strict',
    validate(value) {
      const issues: { message: string; path: string[] }[] = []
      const data = value as Partial<ReportData>
      if (typeof data?.customer?.name !== 'string') {
        issues.push({ message: 'customer.name must be a string', path: ['customer', 'name'] })
      }
      if (typeof data?.revenue !== 'number') {
        issues.push({ message: 'revenue must be a number', path: ['revenue'] })
      }
      return issues.length > 0 ? { issues } : { value: value as ReportData }
    },
  },
}

/** Vendor two: object-shaped path segments, and it coerces, like Valibot. */
const coercingReport: StandardSchema<unknown, ReportData> = {
  '~standard': {
    version: 1,
    vendor: 'test-coercing',
    validate(value) {
      const data = value as { customer?: { name?: unknown }; revenue?: unknown }
      if (typeof data?.customer?.name !== 'string') {
        return { issues: [{ message: 'missing customer name', path: [{ key: 'customer' }] }] }
      }
      const revenue = Number(data.revenue)
      if (Number.isNaN(revenue)) {
        return { issues: [{ message: 'revenue is not numeric', path: [{ key: 'revenue' }] }] }
      }
      // Coerced output is what resolution must use, not the original input.
      return { value: { customer: { name: data.customer.name }, revenue } }
    },
  },
}

const SOURCE = '# {{customer.name}}\n\nRevenue: {{revenue | currency:"USD"}}'

describe.each([
  ['array-path vendor', strictReport],
  ['object-path vendor', coercingReport],
])('%s', (_name, schema) => {
  const report = defineTemplate({ source: SOURCE, schema })

  it('resolves valid data', () => {
    const result = report.resolve({ customer: { name: 'Acme' }, revenue: 50_000 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(textOf(result.document)).toContain('Acme')
    expect(textOf(result.document)).toContain('$50,000.00')
  })

  it('rejects invalid data before resolving anything', () => {
    const result = report.resolve({ customer: {}, revenue: 'lots' } as never)
    expect(result.ok).toBe(false)
    expect(result.document).toBeUndefined()
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.schemaInvalid,
    )
  })

  it('maps validator issue paths onto diagnostic paths', () => {
    const result = report.resolve({ customer: {}, revenue: 1 } as never)
    expect(result.ok).toBe(false)
    const paths = result.diagnostics.map((d) => d.path)
    expect(paths.some((path) => path?.startsWith('customer'))).toBe(true)
  })
})

describe('schema integration details (spec 8.5)', () => {
  it('resolves against the validator output, not the raw input', () => {
    const report = defineTemplate({ source: 'Revenue: {{revenue}}', schema: coercingReport })
    const result = report.resolve({ customer: { name: 'Acme' }, revenue: '42' } as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // '42' went in, the coerced number came out.
    expect(textOf(result.document)).toBe('Revenue: 42')
  })

  it('stays optional: a template with no schema still works (spec 17.4)', () => {
    expect(defineTemplate('Hello {{user.name}}').resolve({ user: { name: 'x' } }).ok).toBe(true)
  })

  it('detects a validator structurally', () => {
    expect(isStandardSchema(strictReport)).toBe(true)
    expect(isStandardSchema(coercingReport)).toBe(true)
    expect(isStandardSchema({})).toBe(false)
    expect(isStandardSchema({ '~standard': {} })).toBe(false)
    expect(isStandardSchema(null)).toBe(false)
  })

  it('rejects a non-validator when the extension is built', () => {
    expect(() => template({ data: {}, schema: { parse: () => 1 } as never })).toThrow(/Standard Schema/)
  })

  it('diagnoses an async validator instead of silently awaiting it (spec 17.6)', () => {
    const asyncSchema: StandardSchema<unknown, ReportData> = {
      '~standard': {
        version: 1,
        vendor: 'test-async',
        validate: async (value) => ({ value: value as ReportData }),
      },
    }
    const result = defineTemplate({ source: 'x', schema: asyncSchema }).resolve({} as never)
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(TEMPLATE_DIAGNOSTIC_CODES.schemaAsync)
  })

  it('a schema does not replace missing-variable diagnostics', () => {
    // The schema allows it; the template still binds a path that has no value.
    const permissive: StandardSchema<unknown, Record<string, unknown>> = {
      '~standard': {
        version: 1,
        vendor: 'test-permissive',
        validate: (value) => ({ value: value as Record<string, unknown> }),
      },
    }
    const result = defineTemplate({ source: '{{a.b}}', schema: permissive }).resolve({})
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.requiredValue,
    )
  })
})
