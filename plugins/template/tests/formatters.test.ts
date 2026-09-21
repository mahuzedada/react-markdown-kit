/**
 * Spec 8.14 / 8.20 — "formatters honor locale/time-zone configuration".
 *
 * Two product rules get their own cases because both are easy to get wrong and
 * expensive when wrong:
 *   - currency is never inferred from a locale;
 *   - time zone is explicit and defaults to UTC, so a document does not change
 *     depending on which machine rendered it.
 */
import { describe, expect, it } from 'vitest'
import { TemplateFormatterError, TEMPLATE_DIAGNOSTIC_CODES } from '../src/index.js'
import { defineTemplate } from './helpers.js'
import { expectOk, textOf } from './helpers.js'

const resolved = (source: string, data: unknown, options?: Parameters<
  ReturnType<typeof defineTemplate>['resolve']
>[1]): string => textOf(expectOk(defineTemplate(source).resolve(data as never, options)))

/** Intl uses non-breaking and narrow spaces; tests compare the plain form. */
const plain = (value: string): string => value.replace(/[  ]/g, ' ')

describe('currency must be explicit (spec 8.14)', () => {
  it('formats with the code the author wrote', () => {
    expect(resolved('{{revenue | currency:"USD"}}', { revenue: 1234.5 })).toBe('$1,234.50')
    // Intl separates the amount from the symbol with a non-breaking space.
    expect(
      plain(resolved('{{revenue | currency:"EUR"}}', { revenue: 1234.5 }, { locale: 'de-DE' })),
    ).toBe('1.234,50 €')
  })

  it('never infers a currency from the locale', () => {
    // Same data, same *currency*, different locale: only the presentation moves.
    const us = resolved('{{revenue | currency:"USD"}}', { revenue: 1000 }, { locale: 'en-US' })
    const fr = resolved('{{revenue | currency:"USD"}}', { revenue: 1000 }, { locale: 'fr-FR' })
    expect(us).toContain('$')
    expect(fr).toContain('$US')
    expect(fr).not.toContain('€')
  })

  it('fails when the code is omitted', () => {
    const result = defineTemplate('{{revenue | currency}}').resolve({ revenue: 1 })
    expect(result.ok).toBe(false)
    const diagnostic = result.diagnostics.find(
      (d) => d.code === TEMPLATE_DIAGNOSTIC_CODES.formatterArgumentRequired,
    )
    expect(diagnostic?.message).toContain('ISO 4217')
  })

  it('fails on a code that is not three letters', () => {
    const result = defineTemplate('{{r | currency:"dollars"}}').resolve({ r: 1 })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.formatterArgumentRequired,
    )
  })

  it('fails on a non-numeric value', () => {
    const result = defineTemplate('{{r | currency:"USD"}}').resolve({ r: 'lots' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.formatterValueType,
    )
  })
})

describe('number and percent (spec 8.14)', () => {
  it('formats by locale', () => {
    expect(resolved('{{n | number}}', { n: 1234567.891 }, { locale: 'en-US' })).toBe('1,234,567.891')
    expect(resolved('{{n | number}}', { n: 1234567.891 }, { locale: 'de-DE' })).toBe('1.234.567,891')
  })

  it('accepts a fraction-digit argument', () => {
    expect(resolved('{{n | number:"2"}}', { n: 3 })).toBe('3.00')
    expect(resolved('{{n | percent:"1"}}', { n: 0.256 })).toBe('25.6%')
  })

  it('formats a fraction as a percentage', () => {
    expect(resolved('{{completion | percent}}', { completion: 0.75 })).toBe('75%')
  })
})

describe('date, time and datetime (spec 8.13, 8.14)', () => {
  const when = { createdAt: new Date('2026-03-04T15:30:00Z') }

  it('defaults to UTC so output does not depend on the host machine', () => {
    expect(resolved('{{createdAt | date:"medium"}}', when)).toBe('Mar 4, 2026')
    expect(resolved('{{createdAt | time:"short"}}', when)).toBe('3:30 PM')
  })

  it('honors an explicit time zone', () => {
    const newYork = resolved('{{createdAt | datetime:"short"}}', when, {
      timeZone: 'America/New_York',
    })
    expect(newYork).toContain('3/4/26')
    expect(newYork).toContain('10:30 AM')
  })

  it('honors the locale', () => {
    expect(resolved('{{createdAt | date:"medium"}}', when, { locale: 'fr-FR' })).toBe('4 mars 2026')
  })

  it('takes a time zone from the template config', () => {
    const template = defineTemplate({
      source: '{{createdAt | time:"short"}}',
      timeZone: 'Asia/Tokyo',
    })
    expect(textOf(expectOk(template.resolve(when)))).toBe('12:30 AM')
  })

  it('accepts an ISO string and an epoch number', () => {
    expect(resolved('{{d | date:"short"}}', { d: '2026-03-04T00:00:00Z' })).toBe('3/4/26')
    expect(resolved('{{d | date:"short"}}', { d: Date.UTC(2026, 2, 4) })).toBe('3/4/26')
  })

  it('rejects an unparseable date and an unknown style', () => {
    expect(defineTemplate('{{d | date}}').resolve({ d: 'not a date' }).ok).toBe(false)
    expect(defineTemplate('{{d | date:"cosmic"}}').resolve({ d: new Date() }).ok).toBe(false)
  })
})

describe('custom formatters (spec 8.14)', () => {
  it('registers through template config', () => {
    const template = defineTemplate({
      source: 'Status: {{status | accountStatus}}',
      formatters: {
        accountStatus: (value) => (value === 'a' ? 'Active' : 'Closed'),
      },
    })
    expect(textOf(expectOk(template.resolve({ status: 'a' })))).toBe('Status: Active')
  })

  it('can be supplied per call', () => {
    const template = defineTemplate('{{v | shout}}')
    const result = template.resolve(
      { v: 'hi' },
      { formatters: { shout: (value) => String(value).toUpperCase() } },
    )
    expect(textOf(expectOk(result))).toBe('HI')
  })

  it('receives the locale, time zone and argument', () => {
    const seen: unknown[] = []
    const template = defineTemplate({
      source: '{{v | probe:"arg"}}',
      formatters: {
        probe: (value, context) => {
          seen.push({ value, ...context })
          return 'ok'
        },
      },
    })
    template.resolve({ v: 1 }, { locale: 'fr-FR', timeZone: 'Asia/Tokyo' })
    expect(seen[0]).toEqual({
      value: 1,
      argument: 'arg',
      locale: 'fr-FR',
      timeZone: 'Asia/Tokyo',
      path: 'v',
    })
  })

  it('can override a built-in', () => {
    const template = defineTemplate({
      source: '{{n | number}}',
      formatters: { number: () => 'house style' },
    })
    expect(textOf(expectOk(template.resolve({ n: 1 })))).toBe('house style')
  })

  it('turns a thrown error into a diagnostic rather than an exception', () => {
    const template = defineTemplate({
      source: '{{v | boom}}',
      formatters: {
        boom: () => {
          throw new Error('kaboom')
        },
      },
    })
    const result = template.resolve({ v: 1 })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.formatterFailed,
    )
    // The formatter's own message is not leaked; the path is what is reported.
    expect(result.diagnostics[0]?.message).toContain('boom')
  })

  it('lets a formatter choose its diagnostic code', () => {
    const template = defineTemplate({
      source: '{{v | picky}}',
      formatters: {
        picky: () => {
          throw new TemplateFormatterError(
            TEMPLATE_DIAGNOSTIC_CODES.formatterValueType,
            'picky needs a widget',
          )
        },
      },
    })
    const result = template.resolve({ v: 1 })
    expect(result.diagnostics[0]?.code).toBe(TEMPLATE_DIAGNOSTIC_CODES.formatterValueType)
    expect(result.diagnostics[0]?.message).toBe('picky needs a widget')
  })

  it('treats formatter output as literal text, never as Markdown (spec 8.14)', () => {
    const template = defineTemplate({
      source: '# {{v | evil}}',
      formatters: { evil: () => '**bold** [link](https://evil.example)' },
    })
    const document = expectOk(template.resolve({ v: 1 }))
    expect(document.tree.children[0]?.children).toHaveLength(1)
    expect(textOf(document)).toBe('**bold** [link](https://evil.example)')
  })
})
