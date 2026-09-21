/**
 * Regression: a resolved document is not the end of the story. Anything that
 * persists, emails or exports the serialized Markdown re-parses it somewhere
 * downstream, often with GFM on. A value that is inert in the tree but becomes
 * structure after a serialize/re-parse round trip is still an injection.
 */
import { describe, expect, it } from 'vitest'
import { defineTemplate, toMarkdown } from '../plugins/template/tests/helpers.js'
import { gfmPreset as gfmTemplatePreset } from '@react-markdown-kit/renderer/gfm'
import { compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

const gfmPreset = defineMarkdownPreset({ extensions: [gfm()] })
const types = (tree: { children: { type: string }[] }) => tree.children.map((c) => c.type)

/** Every construct that only needs line-start position to form. */
const LINE_START_ATTACKS: readonly [name: string, value: string][] = [
  ['table', '\n| x | y |\n| --- | --- |\n| 1 | 2 |\n'],
  ['atx heading', '\n# Pwned\n'],
  ['setext heading', '\nPwned\n=====\n'],
  ['bullet list', '\n- one\n- two\n'],
  ['ordered list', '\n1. one\n2. two\n'],
  ['thematic break', '\n---\n'],
  ['fenced code', '\n```js\nevil()\n```\n'],
  ['tilde fence', '\n~~~js\nevil()\n~~~\n'],
  ['blockquote', '\n> quoted\n'],
  ['indented code', '\n    indented\n'],
  ['html block', '\n<div>hi</div>\n'],
  ['footnote definition', '\n[^a]: note\n'],
]

for (const context of ['paragraph', 'heading', 'blockquote', 'list item', 'table cell'] as const) {
  const source =
    context === 'paragraph' ? 'Signed, {{v}}.'
    : context === 'heading' ? '# Hi {{v}}'
    : context === 'blockquote' ? '> Note: {{v}}'
    : context === 'list item' ? '- item {{v}}'
    : '| a | b |\n| --- | --- |\n| {{v}} | y |'

  describe(`a value inside a ${context}`, () => {
    for (const [name, value] of LINE_START_ATTACKS) {
      it(`cannot become a ${name} after serialize and re-parse`, () => {
        const template = defineTemplate({ source, preset: gfmTemplatePreset })
        const result = template.resolve({ v: value } as never)
        expect(result.ok).toBe(true)
        if (!result.ok) return

        const before = types(result.document.tree)
        const markdown = toMarkdown(result.document)

        // The document must survive a full round trip through Markdown text
        // with the most permissive dialect we ship.
        const after = types(compileMarkdown(markdown, { preset: gfmPreset }).tree)
        expect(after, `serialized:\n${markdown}`).toEqual(before)

        // Structural equality above is the security property. This extra
        // check catches a leak that happens to re-parse the same way, but it
        // only makes sense where the AUTHORED source has no block syntax of
        // its own: in a table or a list the author's own lines legitimately
        // begin with `|` or `-`.
        if (context === 'paragraph' || context === 'heading') {
          for (const line of markdown.split('\n').slice(1)) {
            expect(line, `line-start leak in:\n${markdown}`).not.toMatch(
              /^(\||#{1,6}\s|-\s|\d+\.\s|>|```|~~~|={3,}|-{3,}$|\[\^)/,
            )
          }
        }
      })
    }
  })
}

describe('authored structure is untouched', () => {
  it('keeps the author’s own multi-block document intact', () => {
    const template = defineTemplate({
      source: '# Title\n\nPara one.\n\n| a | b |\n| --- | --- |\n| 1 | {{v}} |\n\n- bullet\n',
      preset: gfmTemplatePreset,
    })
    const result = template.resolve({ v: 'safe' } as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(types(result.document.tree)).toEqual(['heading', 'paragraph', 'table', 'list'])
    const reparsed = compileMarkdown(toMarkdown(result.document), { preset: gfmPreset })
    expect(types(reparsed.tree)).toEqual(['heading', 'paragraph', 'table', 'list'])
  })

  it('preserves every character of the value, turning only newlines into spaces', () => {
    const template = defineTemplate({ source: 'V: {{v}}', preset: gfmTemplatePreset })
    const result = template.resolve({ v: 'a\nb\n\nc' } as never)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const markdown = toMarkdown(result.document)
    expect(markdown).toContain('a')
    expect(markdown).toContain('b')
    expect(markdown).toContain('c')
    expect(markdown.trim().split('\n')).toHaveLength(1)
  })
})
