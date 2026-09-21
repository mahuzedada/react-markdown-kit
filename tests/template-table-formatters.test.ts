/**
 * A formatted value inside a GFM table cell.
 *
 * GFM requires a literal pipe in a cell to be escaped, so the formatter
 * separator has to be written `\|` there. Currency in a table is the single
 * most common thing a business template does, so this has to work.
 */
import { describe, expect, it } from 'vitest'
import { defineTemplate, toMarkdown } from '../plugins/template/tests/helpers.js'
import { gfmPreset as gfmTemplatePreset } from '@react-markdown-kit/renderer/gfm'

const resolve = (source: string, data: unknown) =>
  defineTemplate({ source, preset: gfmTemplatePreset }).resolve(data as never)

const textOf = (node: unknown): string => {
  const parts: string[] = []
  const walk = (n: { type?: string; value?: string; children?: unknown[] }): void => {
    if (n.type === 'text') parts.push(n.value ?? '')
    for (const child of (n.children ?? []) as never[]) walk(child)
  }
  walk(node as never)
  return parts.join('')
}

describe('formatters inside a table cell', () => {
  it('resolves when the separator is escaped, as GFM requires', () => {
    const result = resolve('| Item | Amount |\n| --- | ---: |\n| Plan | {{amount \\| currency:"USD"}} |', {
      amount: 1234.5,
    })
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true)
    if (!result.ok) return
    expect(textOf(result.document.tree)).toContain('$1,234.50')
  })

  it('handles several formatted cells in one row', () => {
    const result = resolve(
      '| a | b | c |\n| --- | --- | --- |\n| {{x \\| currency:"EUR"}} | {{y \\| percent}} | {{z \\| number}} |',
      { x: 10, y: 0.25, z: 4096 },
    )
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true)
    if (!result.ok) return
    const text = textOf(result.document.tree)
    expect(text).toContain('€10.00')
    expect(text).toContain('25%')
    expect(text).toContain('4,096')
  })

  it('keeps the table structure intact', () => {
    const result = resolve('| a |\n| --- |\n| {{v \\| currency:"USD"}} |', { v: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.tree.children.map((c) => c.type)).toEqual(['table'])
  })

  it('still diagnoses an UNESCAPED separator, which GFM splits into two cells', () => {
    const result = resolve('| a |\n| --- |\n| {{v | currency:"USD"}} |', { v: 1 })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('TEMPLATE_PLACEHOLDER_NOT_PARSED')
  })

  it('round-trips the escape back to Markdown', () => {
    const result = resolve('| a |\n| --- |\n| {{v \\| currency:"USD"}} |', { v: 1234.5 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toMarkdown(result.document)).toContain('$1,234.50')
  })
})

describe('the escape is harmless outside a table', () => {
  it('accepts it in a paragraph too, so authors need not remember where they are', () => {
    const escaped = resolve('Total: {{v \\| currency:"USD"}}', { v: 5 })
    const plain = resolve('Total: {{v | currency:"USD"}}', { v: 5 })
    expect(escaped.ok).toBe(true)
    expect(plain.ok).toBe(true)
    if (!escaped.ok || !plain.ok) return
    expect(textOf(escaped.document.tree)).toBe(textOf(plain.document.tree))
  })
})
