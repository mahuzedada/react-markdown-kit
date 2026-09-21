import { describe, expect, it } from 'vitest'
import { defineTemplate } from '../plugins/template/tests/helpers.js'

describe('prototype pollution is blocked at resolve time', () => {
  for (const path of ['__proto__.x', 'constructor.prototype.y', 'a.__proto__.b', 'constructor']) {
    it(`blocks {{${path}}}`, () => {
      const t = defineTemplate(`Value: {{${path}}}`)
      const r = t.resolve({ a: {} } as never)
      const codes = r.diagnostics.map((d) => d.code)
      expect(codes.some((c) => /UNSAFE|INVALID|UNKNOWN/.test(c)), JSON.stringify(r.diagnostics)).toBe(true)
      if (r.ok) {
        const text = JSON.stringify(r.document.tree)
        expect(text).not.toContain('function')
        expect(text).not.toContain('[object Object]')
      }
    })
  }

  it('does not pollute Object.prototype', () => {
    const t = defineTemplate('{{__proto__.polluted}}')
    t.resolve({} as never)
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })
})

describe('markdown injection is blocked', () => {
  const cases: [string, string][] = [
    ['bold', '**Administrator**'],
    ['heading', '# Pwned'],
    ['table row', 'a | b\n--- | ---'],
    ['link', '](https://evil.com)'],
    ['html', '<script>alert(1)</script>'],
    ['fence', '```js\nevil()\n```'],
    ['list', '\n- injected\n- items'],
    ['hr', '\n---\n'],
  ]
  for (const [name, value] of cases) {
    it(`a ${name} value stays literal text`, () => {
      const t = defineTemplate('# Hello {{user.name}}')
      const r = t.resolve({ user: { name: value } } as never)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      // The whole document must remain exactly one heading.
      const top = r.document.tree.children
      expect(top).toHaveLength(1)
      expect(top[0]!.type).toBe('heading')
      // And no structural node may have been created inside it.
      const types = JSON.stringify(top[0]).match(/"type":"(\w+)"/g) ?? []
      for (const t2 of types) {
        expect(['"type":"heading"', '"type":"text"']).toContain(t2)
      }
    })
  }
})
