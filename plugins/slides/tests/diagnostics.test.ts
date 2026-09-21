import { describe, expect, it } from 'vitest'
import { compileMarkdown } from '@react-markdown-kit/renderer'
import type { MarkdownDiagnostic } from '@internal/diagnostics/index.js'
import type { MarkdownRoot } from '@internal/document-contracts/index.js'
import { slides, SLIDES_DIAGNOSTIC_CODES } from '../src/index.js'

const preset = { extensions: [slides()] }

function codes(source: string): string[] {
  return compileMarkdown(source, preset).diagnostics.map((d) => d.code)
}

function only(source: string, code: string): MarkdownDiagnostic {
  const diagnostics = compileMarkdown(source, preset).diagnostics
  expect(diagnostics.map((d) => d.code)).toEqual([code])
  return diagnostics[0]!
}

describe('slides(): diagnostics', () => {
  it('exports every code', () => {
    expect(Object.values(SLIDES_DIAGNOSTIC_CODES).sort()).toEqual([
      'SLIDES_DIRECTIVE_INVALID',
      'SLIDES_DIRECTIVE_UNKNOWN',
      'SLIDES_FRONT_MATTER_INVALID',
      'SLIDES_MARKER_ATTACHED',
      'SLIDES_MARKER_MISPLACED',
      'SLIDES_NAME_DUPLICATE',
      'SLIDES_PROPERTY_BARE',
      'SLIDES_SETEXT_HEADING',
      'SLIDES_SLIDE_EMPTY',
    ])
  })

  it('SLIDES_SETEXT_HEADING: dashes glued under text made a heading', () => {
    const d = only('# One\n\nText\n---\n\n# Two\n', 'SLIDES_SETEXT_HEADING')
    expect(d.severity).toBe('info')
    expect(d.range?.start.line).toBe(3)
  })

  it('SLIDES_SLIDE_EMPTY: a slide with no content, kept', () => {
    const d = only('# One\n\n---\n\n---\n\n# Three\n', 'SLIDES_SLIDE_EMPTY')
    expect(d.severity).toBe('info')
    expect(d.range).toBeDefined()
  })

  it('SLIDES_FRONT_MATTER_INVALID: key lines under the opening --- with no closing fence', () => {
    const d = only('---\ntitle: x\n\n- a\n- b\n', 'SLIDES_FRONT_MATTER_INVALID')
    expect(d.severity).toBe('warning')
    expect(d.range?.start.offset).toBe(0)
    // A non-key line before the closing fence: the block is prose under a setext underline, and both are reported.
    expect(codes('---\ntitle: x\nprose\n---\n\n# One\n')).toEqual(['SLIDES_FRONT_MATTER_INVALID', 'SLIDES_SETEXT_HEADING'])
    // A leading break followed by a paragraph that happens to start with `word:` is content.
    expect(codes('---\n\nNote: the first slide\n')).toEqual([])
    expect(codes('---\n\n# One\n')).toEqual([])
  })

  it('reads no front matter, and reports nothing, when the transform runs without the source', () => {
    const extension = slides()
    const transform = extension.capabilities!.syntax!.transform!
    const tree = compileMarkdown('---\ntitle: x\n---\n\n# One\n', { extensions: [slides({ frontMatter: false })] }).tree
    const reported: MarkdownDiagnostic[] = []
    const out = transform(tree, { profile: 'commonmark', report: (d) => reported.push(d), extensions: [extension] })
    expect(reported).toEqual([])
    expect(out.children.map((node) => node.type)).toEqual(['thematicBreak', 'heading', 'heading'])
  })

  it('SLIDES_DIRECTIVE_INVALID: a known key with a bad value, in a comment or front matter', () => {
    const d = only('<!-- name: not ok -->\n\n# One\n', 'SLIDES_DIRECTIVE_INVALID')
    expect(d.severity).toBe('warning')
    expect(d.range?.start.line).toBe(1)
    expect(codes('<!-- class: -->\n\n# One\n')).toEqual(['SLIDES_DIRECTIVE_INVALID'])
    expect(codes('<!-- background: two words -->\n\n# One\n')).toEqual(['SLIDES_DIRECTIVE_INVALID'])
    expect(codes('---\naspect: 3:2\n---\n\n# One\n')).toEqual(['SLIDES_DIRECTIVE_INVALID'])
  })

  it('SLIDES_DIRECTIVE_UNKNOWN: a comment shaped like a directive with an unknown key', () => {
    const d = only('# One\n\n<!-- foo: bar -->\n', 'SLIDES_DIRECTIVE_UNKNOWN')
    expect(d.severity).toBe('warning')
    expect(d.range?.start.line).toBe(3)
  })

  it('SLIDES_NAME_DUPLICATE: two slides with the same name, reported at the duplicate directive', () => {
    const d = only('<!-- name: a -->\n\n# One\n\n---\n\n<!-- name: a -->\n\n# Two\n', 'SLIDES_NAME_DUPLICATE')
    expect(d.severity).toBe('warning')
    expect(d.range?.start.line).toBe(7)
    const later = only('# One\n\n<!-- name: a -->\n\n---\n\n# Two\n\n<!-- name: a -->\n', 'SLIDES_NAME_DUPLICATE')
    expect(later.range?.start.line).toBe(9)
  })

  it('SLIDES_MARKER_MISPLACED: a second ??? or a -- after ???', () => {
    const d = only('# One\n\n???\n\nnotes\n\n--\n\nmore\n', 'SLIDES_MARKER_MISPLACED')
    expect(d.severity).toBe('warning')
    expect(d.range?.start.line).toBe(7)
    expect(codes('# One\n\n???\n\nnotes\n\n???\n')).toEqual(['SLIDES_MARKER_MISPLACED'])
  })

  it('SLIDES_MARKER_ATTACHED: a ??? on the line right after text', () => {
    const d = only('# One\n\nText\n???\n', 'SLIDES_MARKER_ATTACHED')
    expect(d.severity).toBe('warning')
    expect(d.range?.start.line).toBe(3)
  })

  it('SLIDES_MARKER_ATTACHED: a marker lazily continuing a list item or a block quote', () => {
    const list = only('- a\n- b\n???\n\nnotes\n', 'SLIDES_MARKER_ATTACHED')
    expect(list.range?.start.line).toBe(2)
    expect(only('> q\n???\n\nnotes\n', 'SLIDES_MARKER_ATTACHED').range?.start.line).toBe(1)
    expect(only('- a\n- b\n--\n\nmore\n', 'SLIDES_MARKER_ATTACHED').range?.start.line).toBe(2)
    expect(only('- a\n  - nested\n???\n', 'SLIDES_MARKER_ATTACHED').range?.start.line).toBe(2)
    expect(codes('- a\n- b\n\n???\n\nnotes\n')).toEqual([])
  })

  it('SLIDES_PROPERTY_BARE: a slide opening with remark-style property lines', () => {
    const d = only('# One\n\n---\n\nclass: center, middle\nbackground: https://x/bg.png\n\n# Two\n', 'SLIDES_PROPERTY_BARE')
    expect(d.severity).toBe('info')
    expect(d.range?.start.line).toBe(5)
  })

  it('reports nothing on a clean deck', () => {
    const clean =
      '---\ntitle: Clean\naspect: 16:9\n---\n\n<!-- name: one -->\n<!-- class: center -->\n\n# One\n\ntext\n\n***\n\n--\n\nmore\n\n???\n\nnotes\n\n---\n\n<!-- background: https://x/bg.png -->\n\n# Two\n\n- a\n- b\n'
    expect(codes(clean)).toEqual([])
    expect(codes('')).toEqual([])
    expect(codes('just a paragraph\n')).toEqual([])
  })
})
