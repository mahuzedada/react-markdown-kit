/**
 * Spec 8.16 — headless source output.
 *
 * The utility form was chosen over `document.toMarkdown()` so the document
 * stays a plain JSON object (spec 4.1). `cache.test.ts` asserts the document
 * half of that decision; this file asserts the utility half.
 */
import { describe, expect, it } from 'vitest'
import { createMarkdownDocument, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { defineTemplate, toMarkdown } from './helpers.js'
import { expectOk } from './helpers.js'

describe('toMarkdown (spec 8.16)', () => {
  it('serializes a resolved document', () => {
    const document = expectOk(
      defineTemplate('# {{title}}\n\n{{body}}').resolve({ title: 'Report', body: 'All good.' }),
    )
    expect(toMarkdown(document).trim()).toBe('# Report\n\nAll good.')
  })

  it('escapes a value so the text keeps its literal reading (spec 8.11)', () => {
    const document = expectOk(defineTemplate('# {{t}}').resolve({ t: '**not bold**' }))
    expect(toMarkdown(document).trim()).toBe('# \\*\\*not bold\\*\\*')
  })

  it('serializes GFM constructs by default', () => {
    const source = '| A | B |\n| - | - |\n| {{a}} | b |'
    const document = expectOk(defineTemplate(source).resolve({ a: 'x' }))
    const markdown = toMarkdown(document)
    expect(markdown).toContain('| x')
    // A delimiter row at all means the table survived as a table.
    expect(markdown).toMatch(/\|\s*-+\s*\|/)
  })

  it('uses the preset a caller passes', () => {
    const preset = defineMarkdownPreset({ extensions: [gfm()] })
    const document = expectOk(defineTemplate({ source: '~~gone~~', preset }).resolve({}))
    expect(toMarkdown(document, { preset }).trim()).toBe('~~gone~~')
  })

  it('serializes a hand-built document, not only a resolved one', () => {
    const document = createMarkdownDocument({
      profile: 'gfm',
      tree: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'hi' }] }] },
    })
    expect(toMarkdown(document).trim()).toBe('hi')
  })

  it('is a fixed point: serializing twice changes nothing', () => {
    const document = expectOk(
      defineTemplate('# {{t}}\n\n- a\n- b\n\n> quote').resolve({ t: 'T' }),
    )
    const once = toMarkdown(document)
    const twice = toMarkdown(
      expectOk(defineTemplate(once).resolve({})),
    )
    expect(twice).toBe(once)
  })
})
