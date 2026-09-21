/**
 * Spec 11.2 — "runtime data must not gain template-language privileges".
 *
 * Prototype traversal is blocked in two independent places, and both are
 * tested, because they fail differently:
 *
 *   1. `parsePath` rejects a forbidden segment, so a placeholder naming one is
 *      a diagnostic and `ok:false`.
 *   2. `lookupPath` reads own properties only, so even if (1) were bypassed
 *      there is no inherited value to reach.
 *
 * A third case is subtler: `{{__proto__.x}}` is dissolved by CommonMark itself
 * (`__ ... __` is strong emphasis) before any template code sees it. That used
 * to produce silently mangled output; it is now an explicit diagnostic from
 * the source audit. Every forbidden-segment case below asserts both the
 * diagnostic and that `Object.prototype` is untouched.
 */
import { describe, expect, it } from 'vitest'
import { TEMPLATE_DIAGNOSTIC_CODES } from '../src/index.js'
import { defineTemplate } from './helpers.js'
import { lookupPath, parsePath } from '../src/engine/path.js'

const UNSAFE_CODES: readonly string[] = [
  TEMPLATE_DIAGNOSTIC_CODES.unsafePath,
  TEMPLATE_DIAGNOSTIC_CODES.placeholderNotParsed,
]

/** Every shape of prototype-traversal attempt, including the dissolved ones. */
const FORBIDDEN_PATHS = [
  '__proto__.x',
  'a.__proto__.b',
  ' __proto__ ',
  '__proto__',
  'constructor',
  'a.constructor',
  'constructor.prototype.y',
  'a.constructor.prototype.z',
  'a.prototype.b',
] as const

describe.each(FORBIDDEN_PATHS)('the path %s', (path) => {
  it('never resolves and is always diagnosed', () => {
    const before = Object.keys(Object.prototype).length
    const template = defineTemplate(`Value: {{${path}}}`)
    const result = template.resolve({ a: {}, user: { name: 'ok' } })

    expect(result.ok).toBe(false)
    expect(result.document).toBeUndefined()

    const codes = result.diagnostics.map((d) => d.code)
    expect(
      codes.some((code) => UNSAFE_CODES.includes(code)),
      `expected an unsafe-path diagnostic, got ${JSON.stringify(result.diagnostics)}`,
    ).toBe(true)

    // Nothing from the prototype chain leaked into the output or the runtime.
    expect(JSON.stringify(result.diagnostics)).not.toContain('[object Object]')
    expect(Object.keys(Object.prototype)).toHaveLength(before)
  })

  it('does not pollute Object.prototype', () => {
    defineTemplate(`{{${path}}}`).resolve({ a: {} })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(({} as Record<string, unknown>).x).toBeUndefined()
    expect(({} as Record<string, unknown>).y).toBeUndefined()
  })
})

describe('placeholders Markdown dissolves (spec 8.10)', () => {
  it('diagnoses {{__proto__.x}} instead of emitting mangled text', () => {
    const result = defineTemplate('Value: {{__proto__.x}}').resolve({})
    expect(result.ok).toBe(false)
    const codes = result.diagnostics.map((d) => d.code)
    // CommonMark ate the `__ __` pair, so the audit is what catches it.
    expect(codes).toContain(TEMPLATE_DIAGNOSTIC_CODES.unsafePath)
  })

  it('diagnoses a valid path that emphasis dissolved', () => {
    const result = defineTemplate('Value: {{user._first_name_}}').resolve({ user: {} })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.placeholderNotParsed,
    )
  })

  it('does not diagnose a placeholder that is literal by design', () => {
    // Inside code it is documentation, not a binding (spec 8.11).
    const result = defineTemplate('Use `{{__proto__.x}}` carefully.').resolve({})
    expect(result.ok).toBe(true)
  })

  it('does not diagnose an escaped placeholder', () => {
    const result = defineTemplate('Literal: \\{{user.name}}').resolve({})
    expect(result.ok).toBe(true)
  })
})

describe('lookupPath reads own properties only (spec 11.2)', () => {
  it('does not find inherited members', () => {
    expect(lookupPath({}, ['toString']).found).toBe(false)
    expect(lookupPath({}, ['hasOwnProperty']).found).toBe(false)
    expect(lookupPath({}, ['constructor']).found).toBe(false)
  })

  it('refuses forbidden segments even when called directly', () => {
    expect(lookupPath({ a: 1 }, ['__proto__']).found).toBe(false)
    expect(lookupPath({ a: 1 }, ['constructor']).found).toBe(false)
    expect(lookupPath({ a: 1 }, ['prototype']).found).toBe(false)
  })

  it('does not read through a non-object', () => {
    expect(lookupPath({ a: 'text' }, ['a', 'length']).found).toBe(false)
    expect(lookupPath({ a: 5 }, ['a', 'toFixed']).found).toBe(false)
  })

  it('reads own nested values and array indices', () => {
    expect(lookupPath({ a: { b: 1 } }, ['a', 'b'])).toEqual({ found: true, value: 1 })
    expect(lookupPath({ items: ['x'] }, ['items', '0'])).toEqual({ found: true, value: 'x' })
  })

  it('finds an own property even when it shadows a forbidden-looking name', () => {
    // `own` is fine; only the three prototype-chain names are refused.
    expect(lookupPath({ proto: 'ok' }, ['proto'])).toEqual({ found: true, value: 'ok' })
  })
})

describe('parsePath (spec 8.10)', () => {
  it('accepts dotted identifiers, including leading underscores', () => {
    expect(parsePath('customer.name')).toEqual({ ok: true, segments: ['customer', 'name'] })
    expect(parsePath('_private.value')).toEqual({ ok: true, segments: ['_private', 'value'] })
    expect(parsePath('items.0.name')).toEqual({ ok: true, segments: ['items', '0', 'name'] })
  })

  it('rejects the three prototype-chain segments wherever they appear', () => {
    for (const path of ['__proto__', 'a.__proto__', 'constructor', 'a.b.prototype']) {
      const parsed = parsePath(path)
      expect(parsed.ok).toBe(false)
      if (parsed.ok) return
      expect(parsed.problem.code).toBe(TEMPLATE_DIAGNOSTIC_CODES.unsafePath)
    }
  })

  it('rejects anything that is not a plain path', () => {
    for (const path of ['a()', 'a[0]', 'a b', '1 + 1', 'a.b()', '', '  ', 'a-b']) {
      expect(parsePath(path).ok, path).toBe(false)
    }
  })
})

describe('no arbitrary execution (spec 8.10, 11.2)', () => {
  it('never calls a function found in the data', () => {
    let called = false
    const template = defineTemplate('{{run}}')
    const result = template.resolve({
      run: () => {
        called = true
        return 'executed'
      },
    })
    expect(called).toBe(false)
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.valueNotScalar,
    )
  })

  it('does not invoke a getter reached through a prototype', () => {
    let read = false
    class Model {
      get secret(): string {
        read = true
        return 'leaked'
      }
    }
    const result = defineTemplate('{{model.secret}}').resolve({ model: new Model() })
    expect(read).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('does read an own getter, which is ordinary application data', () => {
    const data = { customer: {} }
    Object.defineProperty(data.customer, 'name', { get: () => 'Acme', enumerable: true })
    const result = defineTemplate('{{customer.name}}').resolve(data)
    expect(result.ok).toBe(true)
  })
})
