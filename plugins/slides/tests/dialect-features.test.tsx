import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { includeDeckFiles, slides } from '../src/index.js'
import { readCodeSteps } from '../src/deck/code-steps.js'

const preset = defineMarkdownPreset({ extensions: [gfm(), slides()] })

function html(source: string): string {
  return renderToStaticMarkup(createElement(Markdown, { preset, children: source }))
}

function codes(source: string): string[] {
  return compileMarkdown(source, { preset }).diagnostics.map((problem) => problem.code)
}

describe('layouts and columns', () => {
  it('splits the body at ::right:: and marks the layout', () => {
    const out = html('<!-- layout: two-cols -->\n\n# Left\n\n::right::\n\nRight.\n')
    expect(out).toContain('data-rmk-slide-layout="two-cols"')
    expect(out).toContain(
      '<div data-rmk-slide-body="" data-rmk-slide-columns="2"><div data-rmk-slide-column="1"><h1>Left</h1></div><div data-rmk-slide-column="2"><p>Right.</p></div></div>',
    )
  })

  it('keeps one fragment number for a group that spans the column marker', () => {
    const out = html('A\n\n--\n\nB\n\n::right::\n\nC\n\n--\n\nD\n')
    expect(out).toContain('<div data-rmk-slide-column="1"><p>A</p><div data-rmk-fragment="1"><p>B</p></div></div>')
    expect(out).toContain('<div data-rmk-slide-column="2"><div data-rmk-fragment="1"><p>C</p></div><div data-rmk-fragment="2"><p>D</p></div></div>')
    expect(out).toContain('data-rmk-slide-fragments="2"')
  })

  it('places the image directive as its own picture', () => {
    const out = html('<!-- layout: image-right -->\n<!-- image: https://example.com/a.png -->\n\n# Side\n')
    expect(out).toContain('<img data-rmk-slide-image="" src="https://example.com/a.png" alt=""/>')
  })

  it('reports a second column marker and an unknown layout', () => {
    expect(codes('A\n\n::right::\n\nB\n\n::right::\n\nC\n')).toContain('SLIDES_MARKER_MISPLACED')
    expect(codes('<!-- layout: sideways -->\n\nA\n')).toContain('SLIDES_DIRECTIVE_INVALID')
  })

  it('writes ::right:: back as it was', () => {
    const document = compileMarkdown('A\n\n::right::\n\nB\n', { preset })
    expect(document.tree.children.map((node) => node.type)).toEqual(['paragraph', 'slideMarker', 'paragraph'])
  })
})

describe('front matter defaults', () => {
  it('applies deck-wide keys to every slide, and a slide directive wins', () => {
    const out = html('---\nfooter: ACME\npaginate: true\ntransition: fade\n---\n\n# One\n\n---\n\n<!-- transition: slide -->\n<!-- paginate: false -->\n\n# Two\n')
    const [one, two] = out.split('<section').slice(1)
    expect(one).toContain('data-rmk-slide-transition="fade"')
    expect(one).toContain('<footer data-rmk-slide-footer=""><span data-rmk-slide-footer-text="">ACME</span><span data-rmk-slide-number="">1</span></footer>')
    expect(two).toContain('data-rmk-slide-transition="slide"')
    expect(two).toContain('<footer data-rmk-slide-footer=""><span data-rmk-slide-footer-text="">ACME</span></footer>')
  })

  it('ignores a slide-only key in front matter and reports a bad deck-wide value', () => {
    expect(html('---\nname: nope\n---\n\n# One\n')).not.toContain('data-rmk-slide-name')
    expect(codes('---\ntransition: spin\n---\n\n# One\n')).toContain('SLIDES_DIRECTIVE_INVALID')
  })
})

describe('incremental lists', () => {
  it('numbers each root-level item after the fragment groups before it', () => {
    const out = html('<!-- incremental: true -->\n\n- a\n- b\n\n--\n\nAfter.\n')
    expect(out).toContain('<li data-rmk-fragment="1">a</li>')
    expect(out).toContain('<li data-rmk-fragment="2">b</li>')
    expect(out).toContain('<div data-rmk-fragment="3"><p>After.</p></div>')
    expect(out).toContain('data-rmk-slide-fragments="3"')
  })

  it('leaves lists alone without the directive', () => {
    expect(html('- a\n- b\n')).not.toContain('data-rmk-fragment')
  })
})

describe('code steps', () => {
  it('reads steps, ranges and all', () => {
    expect(readCodeSteps('{1|3-4,6|all}')).toEqual([[[1, 1]], [[3, 4], [6, 6]], 'all'])
    expect(readCodeSteps('title="x"')).toBeUndefined()
    expect(readCodeSteps('{a}')).toBe('invalid')
  })

  it('splits the code into lines and takes a reveal step per extra highlight step', () => {
    const out = html('```ts {1|2}\nconst a = 1\nconst b = 2\n```\n')
    expect(out).toContain('<pre data-rmk-code-steps="0 1">')
    expect(out).toContain('<span data-rmk-code-line="1" data-rmk-code-focus="0" data-rmk-code-line-state="focus">const a = 1</span>\n')
    expect(out).toContain('<span data-rmk-code-line="2" data-rmk-code-focus="1" data-rmk-code-line-state="dim">const b = 2</span>')
    expect(out).toContain('data-rmk-slide-fragments="1"')
  })

  it('reports braces it cannot read and renders the code plainly', () => {
    const source = '```ts {one}\nx\n```\n'
    expect(codes(source)).toContain('SLIDES_CODE_STEPS_INVALID')
    expect(html(source)).not.toContain('data-rmk-code-line')
  })
})

describe('streaming', () => {
  it('renders nothing for a comment still being written at the end', () => {
    const out = html('# One\n\n<!-- class: cen')
    expect(out).not.toContain('&lt;!--')
    expect(out).toContain('<h1>One</h1>')
  })
})

describe('includeDeckFiles', () => {
  const files: Record<string, string> = {
    'intro.md': '---\ntitle: ignored\n---\n\n# Intro\n\n<!-- src: nested.md -->\n',
    'nested.md': '## Nested\n',
    'loop.md': '<!-- src: loop.md -->\n',
  }
  const read = (path: string): string | undefined => files[path]

  it('inlines files, drops their front matter and follows nesting', () => {
    const out = includeDeckFiles('# Main\n\n---\n\n<!-- src: intro.md -->\n', read)
    expect(out).toContain('# Intro')
    expect(out).toContain('## Nested')
    expect(out).not.toContain('ignored')
  })

  it('leaves includes inside fences, unknown paths and cycles alone', () => {
    expect(includeDeckFiles('```\n<!-- src: intro.md -->\n```\n', read)).toBe('```\n<!-- src: intro.md -->\n```\n')
    expect(includeDeckFiles('<!-- src: missing.md -->', read)).toBe('<!-- src: missing.md -->')
    expect(includeDeckFiles('<!-- src: loop.md -->', read)).toContain('<!-- src: loop.md -->')
  })

  it('reports an include that reached the renderer', () => {
    expect(codes('<!-- src: missing.md -->\n\n# A\n')).toContain('SLIDES_INCLUDE_UNRESOLVED')
  })
})

describe('streaming front matter', () => {
  it('renders nothing for front matter the source ends inside', () => {
    for (const prefix of ['---\nti', '---\ntitle: Q3', '---\ntitle: Q3\nfooter: ACME\n', '---\ntitle: Q3\n--']) {
      const out = html(prefix)
      expect(out).not.toContain('title')
      expect(out).not.toContain('<p>')
      expect(out).not.toContain('<h2>')
      expect(out).toContain('data-rmk-deck-slides="0"')
      expect(codes(prefix)).not.toContain('SLIDES_PROPERTY_BARE')
    }
    // A saved file that never closes its front matter still hears about it.
    expect(codes('---\ntitle: Q3\n')).toContain('SLIDES_FRONT_MATTER_INVALID')
  })

  it('still reports front matter that never closes before content', () => {
    expect(codes('---\ntitle: Q3\n\n# Hello\n')).toContain('SLIDES_FRONT_MATTER_INVALID')
  })
})

describe('includeDeckFiles with resolved ids', () => {
  const files: Record<string, string> = {
    'sub/a.md': '# A\n\n<!-- src: b.md -->\n',
    'sub/b.md': '# B\n\n<!-- src: ./a.md -->\n',
  }
  const resolve = (path: string, from: string | undefined): string => {
    const base = from === undefined ? '' : from.slice(0, from.lastIndexOf('/') + 1)
    return `${base}${path.replace(/^\.\//, '')}`
  }
  const read = (path: string, from: string | undefined) => {
    const id = resolve(path, from)
    const source = files[id]
    return source === undefined ? undefined : { id, source }
  }

  it('asks for nested files relative to their parent and stops cycles by id', () => {
    const out = includeDeckFiles('<!-- src: sub/a.md -->', read)
    expect(out).toContain('# A')
    expect(out).toContain('# B')
    expect(out).toContain('<!-- src: ./a.md -->')
  })

  it('does not close a fence on a line that has an info string', () => {
    expect(includeDeckFiles('```md\n```js\n<!-- src: sub/a.md -->\n```\n', read)).not.toContain('# A')
  })
})
