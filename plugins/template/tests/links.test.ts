/**
 * Spec 8.12 / 8.20 — "complete URL bindings are validated".
 *
 * A destination binding is the one place a value lands somewhere other than a
 * text node, so it gets its own rules: the placeholder must be the *entire*
 * destination, and the resolved value still passes protocol policy.
 */
import { describe, expect, it } from 'vitest'
import { TEMPLATE_DIAGNOSTIC_CODES } from '../src/index.js'
import { isSafeDestination } from '../src/engine/url-policy.js'
import { defineTemplate } from './helpers.js'
import { expectOk } from './helpers.js'

const linkOf = (tree: { children: unknown[] }): Record<string, unknown> =>
  ((tree.children[0] as { children: unknown[] }).children[0] as Record<string, unknown>)

describe('complete destination bindings (spec 8.12)', () => {
  it('binds a whole link destination', () => {
    const template = defineTemplate('[Open account]({{links.accountUrl}})')
    const document = expectOk(
      template.resolve({ links: { accountUrl: 'https://app.example/a/1' } }),
    )
    const link = linkOf(document.tree)
    expect(link.type).toBe('link')
    expect(link.url).toBe('https://app.example/a/1')
  })

  it('binds a whole image destination and its alt text', () => {
    const template = defineTemplate('![{{brand.logoAlt}}]({{brand.logoUrl}})')
    const document = expectOk(
      template.resolve({
        brand: { logoAlt: 'Acme logo', logoUrl: 'https://cdn.example/logo.png' },
      }),
    )
    const image = linkOf(document.tree)
    expect(image.type).toBe('image')
    expect(image.url).toBe('https://cdn.example/logo.png')
    expect(image.alt).toBe('Acme logo')
  })

  it('binds a link title', () => {
    const template = defineTemplate('[x]({{u}} "{{t}}")')
    const document = expectOk(template.resolve({ u: 'https://example.com', t: 'Tooltip' }))
    expect(linkOf(document.tree).title).toBe('Tooltip')
  })

  it('binds a reference definition destination', () => {
    const template = defineTemplate('[x][ref]\n\n[ref]: {{u}}')
    const document = expectOk(template.resolve({ u: 'https://example.com' }))
    const definition = document.tree.children[1] as Record<string, unknown>
    expect(definition.type).toBe('definition')
    expect(definition.url).toBe('https://example.com')
  })

  it('fails when the bound destination has no value', () => {
    const result = defineTemplate('[x]({{u}})').resolve({})
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.requiredValue,
    )
  })

  it('fails when the bound destination is not a string', () => {
    const result = defineTemplate('[x]({{u}})').resolve({ u: { href: 'x' } })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.valueNotScalar,
    )
  })
})

describe('partial URL interpolation is out of scope for v1 (spec 8.12)', () => {
  it('diagnoses a placeholder that is only part of a destination', () => {
    const result = defineTemplate('[x](https://example.com/users/{{user.id}})').resolve({
      user: { id: '1' },
    })
    expect(result.ok).toBe(false)
    const diagnostic = result.diagnostics.find(
      (d) => d.code === TEMPLATE_DIAGNOSTIC_CODES.partialUrl,
    )
    expect(diagnostic?.severity).toBe('error')
    expect(diagnostic?.message).toContain('complete destination')
  })

  it('diagnoses two placeholders in one destination', () => {
    const result = defineTemplate('[x]({{a}}/{{b}})').resolve({ a: 'https://x', b: 'y' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(TEMPLATE_DIAGNOSTIC_CODES.partialUrl)
  })

  it('leaves an untouched destination alone', () => {
    const document = expectOk(defineTemplate('[x](https://example.com/a)').resolve({}))
    expect(linkOf(document.tree).url).toBe('https://example.com/a')
  })
})

describe('destination policy (spec 8.12, 11.1)', () => {
  const unsafe = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
    'java\nscript:alert(1)',
    'javascript\t:alert(1)',
  ]

  it.each(unsafe)('rejects a value resolving to %s', (url) => {
    const result = defineTemplate('[x]({{u}})').resolve({ u: url })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(TEMPLATE_DIAGNOSTIC_CODES.unsafeUrl)
  })

  it('names the path but never the rejected value (spec 11.4)', () => {
    const result = defineTemplate('[x]({{u}})').resolve({ u: 'javascript:alert(document.cookie)' })
    const diagnostic = result.diagnostics.find(
      (d) => d.code === TEMPLATE_DIAGNOSTIC_CODES.unsafeUrl,
    )
    expect(diagnostic?.path).toBe('u')
    expect(diagnostic?.message).not.toContain('cookie')
  })

  const safe = [
    'https://example.com/a?b=c#d',
    'http://example.com',
    'mailto:a@example.com',
    'tel:+15551234567',
    '/relative/path',
    '#anchor',
    '../sibling',
    'path/with:colon/after/slash',
  ]

  it.each(safe)('accepts %s', (url) => {
    const document = expectOk(defineTemplate('[x]({{u}})').resolve({ u: url }))
    expect(linkOf(document.tree).url).toBe(url)
  })

  it('exposes the policy as a predicate', () => {
    expect(isSafeDestination('https://example.com')).toBe(true)
    expect(isSafeDestination('javascript:alert(1)')).toBe(false)
    expect(isSafeDestination('/a/b')).toBe(true)
  })
})
