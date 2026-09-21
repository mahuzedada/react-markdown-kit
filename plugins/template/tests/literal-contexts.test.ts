/**
 * Spec 8.11 — "code contexts and escaped placeholders remain literal".
 *
 * These are the contexts where `{{...}}` is documentation *about* a template
 * rather than a binding in one. Getting this wrong means a page that explains
 * templating cannot be written with the templating engine.
 */
import { describe, expect, it } from 'vitest'
import { TEMPLATE_DIAGNOSTIC_CODES } from '../src/index.js'
import { defineTemplate, toMarkdown } from './helpers.js'
import { expectOk, textOf } from './helpers.js'

const DATA = { user: { name: 'Chatis' } }

describe('code contexts are literal (spec 8.11)', () => {
  it('leaves a placeholder inside inline code alone', () => {
    const document = expectOk(defineTemplate('Write `{{user.name}}` to bind it.').resolve(DATA))
    expect(textOf(document)).toBe('Write {{user.name}} to bind it.')
    expect(textOf(document)).not.toContain('Chatis')
  })

  it('leaves a placeholder inside a fenced code block alone', () => {
    const template = defineTemplate('```txt\n{{user.name}}\n```')
    const document = expectOk(template.resolve(DATA))
    const code = document.tree.children[0]
    expect(code?.type).toBe('code')
    expect(code?.value).toBe('{{user.name}}')
  })

  it('leaves a placeholder inside an indented code block alone', () => {
    const document = expectOk(defineTemplate('    {{user.name}}').resolve(DATA))
    expect(document.tree.children[0]?.value).toBe('{{user.name}}')
  })

  it('does not require the variable to exist for a code placeholder', () => {
    // Nothing is bound, so nothing can be missing.
    const result = defineTemplate('`{{nope.at.all}}`').resolve({})
    expect(result.ok).toBe(true)
  })

  it('resolves prose in the same document as literal code', () => {
    const document = expectOk(
      defineTemplate('Hello {{user.name}}, write `{{user.name}}`.').resolve(DATA),
    )
    expect(textOf(document)).toBe('Hello Chatis, write {{user.name}}.')
  })

  it('round-trips a code placeholder unchanged', () => {
    const document = expectOk(defineTemplate('```txt\n{{user.name}}\n```').resolve(DATA))
    expect(toMarkdown(document).trim()).toBe('```txt\n{{user.name}}\n```')
  })
})

describe('escaped placeholders are literal (spec 8.11)', () => {
  it('leaves \\{{...}} unresolved', () => {
    const document = expectOk(defineTemplate('Literal: \\{{user.name}}').resolve(DATA))
    expect(textOf(document)).toBe('Literal: {{user.name}}')
  })

  it('resolves an unescaped placeholder beside an escaped one', () => {
    const document = expectOk(
      defineTemplate('a \\{{user.name}} b {{user.name}} c').resolve(DATA),
    )
    expect(textOf(document)).toBe('a {{user.name}} b Chatis c')
  })

  it('does not require an escaped variable to exist', () => {
    expect(defineTemplate('\\{{absolutely.missing}}').resolve({}).ok).toBe(true)
  })

  it('treats a doubled backslash as an escaped backslash, not an escaped brace', () => {
    // `\\{{x}}` is a literal backslash followed by a live placeholder.
    const document = expectOk(defineTemplate('\\\\{{user.name}}').resolve(DATA))
    expect(textOf(document)).toBe('\\Chatis')
  })
})

describe('raw HTML is never interpolated (spec 8.11, 11.1)', () => {
  it('leaves a placeholder inside a block HTML node literal and warns', () => {
    const template = defineTemplate('<div data-user="{{user.name}}">x</div>')
    const result = template.resolve(DATA)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.tree.children[0]?.value).toContain('{{user.name}}')
    expect(result.document.tree.children[0]?.value).not.toContain('Chatis')
    expect(result.diagnostics.map((d) => d.code)).toContain(
      TEMPLATE_DIAGNOSTIC_CODES.placeholderInHtml,
    )
  })

  it('warns rather than failing, so an existing document still resolves', () => {
    const result = defineTemplate('<table><tr><td>{{user.name}}</td></tr></table>').resolve(DATA)
    expect(result.ok).toBe(true)
    const html = result.diagnostics.find(
      (d) => d.code === TEMPLATE_DIAGNOSTIC_CODES.placeholderInHtml,
    )
    expect(html?.severity).toBe('warning')
  })

  it('still resolves a placeholder that is prose between inline HTML tags', () => {
    // `<b>` is inline HTML: the placeholder is a text node in a paragraph, not
    // inside an HTML node, so it binds like any other prose and stays text.
    const document = expectOk(defineTemplate('<b>{{user.name}}</b>').resolve(DATA))
    expect(textOf(document)).toBe('Chatis')
  })
})
