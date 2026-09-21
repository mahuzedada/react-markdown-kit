/**
 * Spec 8.11 / 11.2 — "runtime text cannot inject Markdown structure".
 *
 * The invariant every case here asserts is the same one:
 *
 *   resolving a template must not change the *shape* of the document.
 *
 * So each case compares the node types of the document resolved with hostile
 * data against the node types of the same document resolved with a harmless
 * value. If the two lists match, the data could not create structure; if the
 * text also survives verbatim, nothing was silently dropped either.
 */
import { describe, expect, it } from 'vitest'
import { compileMarkdown, gfm } from '@react-markdown-kit/renderer'
import { gfmPreset as gfmTemplatePreset } from '@react-markdown-kit/renderer/gfm'
import { defineTemplate, toMarkdown } from './helpers.js'
import { expectOk, textOf, structureOf, typesOf } from './helpers.js'

/** Values that are all Markdown/HTML punctuation and must stay inert. */
const HOSTILE: readonly [name: string, value: string][] = [
  ['strong emphasis', '**Administrator**'],
  ['emphasis', '_Administrator_'],
  ['atx heading', '# Pwned'],
  ['setext heading', 'Title\n=====\n'],
  ['table pipes', 'a | b | c'],
  ['table row', '\n| x | y |\n| --- | --- |\n| 1 | 2 |\n'],
  ['link syntax', '[click](https://evil.example)'],
  ['link tail', '](https://evil.example)'],
  ['image syntax', '![alt](https://evil.example/x.png)'],
  ['raw html', '<script>alert(1)</script>'],
  ['html attribute break', '" onmouseover="alert(1)'],
  ['fenced code', '```js\nprocess.exit(1)\n```'],
  ['inline code backticks', '`` ` ``'],
  ['list bullet', '\n- one\n- two\n'],
  ['blockquote', '\n> quoted\n'],
  ['thematic break', '\n---\n'],
  ['html comment', '<!-- hidden -->'],
  ['autolink', '<https://evil.example>'],
  ['footnote reference', '[^1]\n\n[^1]: note'],
  ['placeholder itself', '{{secret.token}}'],
  ['backslash escapes', 'C:\\path\\to\\file'],
  ['entity', '&lt;script&gt;'],
]

describe.each(HOSTILE)('a value containing %s', (name, value) => {
  // GFM on purpose: a parser that *could* build a table is the stricter
  // audience for hostile table syntax, and the re-parse below must use the
  // same dialect or it would compare two different grammars.
  const template = defineTemplate({
    source: '# Hello {{user.name}}\n\nSigned, {{user.name}}.',
    preset: gfmTemplatePreset,
  })

  it('does not change the document structure', () => {
    const hostile = expectOk(template.resolve({ user: { name: value } }))
    const benign = expectOk(template.resolve({ user: { name: 'Ada' } }))
    expect(typesOf(hostile)).toEqual(typesOf(benign))
  })

  it('keeps the value as literal text', () => {
    const document = expectOk(template.resolve({ user: { name: value } }))
    // Every newline in an inserted value becomes a space, in every inline
    // context. Not cosmetic: a block construct needs only line-start position
    // to form, so any surviving newline lets a value become structure after a
    // serialize/re-parse round trip. See interpolate.ts and
    // tests/template-serialization-safety.test.ts. Characters all survive.
    const flattened = value.replace(/\r\n?|\n/g, ' ')
    expect(textOf(document)).toBe(`Hello ${flattened}Signed, ${flattened}.`)
  })

  it(`re-escapes on serialization so a round trip stays literal (${name})`, () => {
    const document = expectOk(template.resolve({ user: { name: value } }))
    // Re-parse the serialized Markdown as plain Markdown, not as a template:
    // resolved output is data, and feeding it back through defineTemplate
    // would be asking the engine to treat data as source.
    const reparsed = { tree: compileMarkdown(toMarkdown(document), { extensions: [gfm()] }).tree }

    // The security claim: serialization did not let the value become structure.
    expect(structureOf(reparsed)).toEqual(structureOf(document))
    // And the characters survived. Whitespace is the serializer's to normalize.
    expect(squash(textOf(reparsed))).toBe(squash(textOf(document)))
  })
})

/** Collapses runs of whitespace: the serializer may re-wrap, that is its job. */
function squash(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

describe('structure-specific guarantees (spec 8.11)', () => {
  it('bold markers in a value stay characters, not a strong node', () => {
    const document = expectOk(
      defineTemplate('# Hello {{user.name}}').resolve({ user: { name: '**Administrator**' } }),
    )
    expect(typesOf(document)).toEqual(['root', 'heading', 'text'])
    expect(textOf(document)).toBe('Hello **Administrator**')
    expect(toMarkdown(document).trim()).toBe('# Hello \\*\\*Administrator\\*\\*')
  })

  it('a value cannot create a heading', () => {
    const document = expectOk(
      defineTemplate('Note: {{note}}').resolve({ note: '\n# Pwned\n' }),
    )
    expect(typesOf(document).filter((type) => type === 'heading')).toHaveLength(0)
  })

  it('a value cannot add a table row or split a cell', () => {
    const template = defineTemplate({
      source: '| Name | Plan |\n| --- | --- |\n| {{name}} | Pro |',
      preset: gfmTemplatePreset,
    })
    const document = expectOk(template.resolve({ name: 'a | b |\n| c | d' }))

    const rows = typesOf(document).filter((type) => type === 'tableRow')
    const cells = typesOf(document).filter((type) => type === 'tableCell')
    expect(rows).toHaveLength(2)
    expect(cells).toHaveLength(4)
    expect(textOf(document)).toContain('a | b |')
  })

  it('a value cannot create a link, so it cannot create a destination', () => {
    const document = expectOk(
      defineTemplate('See {{text}}').resolve({ text: '[click](javascript:alert(1))' }),
    )
    expect(typesOf(document)).not.toContain('link')
    expect(textOf(document)).toBe('See [click](javascript:alert(1))')
  })

  it('a value cannot create an HTML node', () => {
    const document = expectOk(
      defineTemplate('Bio: {{bio}}').resolve({ bio: '<img src=x onerror=alert(1)>' }),
    )
    expect(typesOf(document)).not.toContain('html')
    expect(textOf(document)).toBe('Bio: <img src=x onerror=alert(1)>')
  })

  it('a value cannot open a code fence', () => {
    const document = expectOk(
      defineTemplate('Log: {{line}}').resolve({ line: '```\nrm -rf /\n```' }),
    )
    expect(typesOf(document)).not.toContain('code')
    expect(textOf(document)).toContain('```')
  })

  it('a value cannot end a blockquote it was written inside', () => {
    const template = defineTemplate('> Quote: {{q}}')
    const document = expectOk(template.resolve({ q: '\n\nOutside the quote' }))
    expect(document.tree.children).toHaveLength(1)
    expect(document.tree.children[0]?.type).toBe('blockquote')
    expect(textOf(document)).toContain('Outside the quote')
  })

  it('a value cannot introduce a second placeholder that then resolves', () => {
    const template = defineTemplate('Hello {{user.name}}')
    const document = expectOk(
      template.resolve({ user: { name: '{{secret.token}}' }, secret: { token: 'hunter2' } }),
    )
    // One pass only. The inserted text is data, not template source.
    expect(textOf(document)).toBe('Hello {{secret.token}}')
    expect(textOf(document)).not.toContain('hunter2')
  })

  it('a value cannot escape an emphasis span it was written inside', () => {
    const template = defineTemplate('*{{v}}*')
    const document = expectOk(template.resolve({ v: '* not emphasis *' }))
    expect(typesOf(document)).toEqual(['root', 'paragraph', 'emphasis', 'text'])
  })

  it('a value cannot smuggle structure through an image alt attribute', () => {
    const template = defineTemplate('![{{alt}}](https://example.com/a.png)')
    const document = expectOk(template.resolve({ alt: '](https://evil.example)![' }))
    const image = (document.tree.children[0]?.children as unknown as
      { url: string; alt: string }[])[0]
    expect(image?.url).toBe('https://example.com/a.png')
    expect(image?.alt).toBe('](https://evil.example)![')
  })

  it('a multi-line value stays inside the block it was written into', () => {
    const template = defineTemplate('- item {{v}}')
    const document = expectOk(template.resolve({ v: '\n\n# Heading\n\n- other' }))
    expect(document.tree.children).toHaveLength(1)
    expect(document.tree.children[0]?.type).toBe('list')
    expect(typesOf(document)).not.toContain('heading')
  })
})
