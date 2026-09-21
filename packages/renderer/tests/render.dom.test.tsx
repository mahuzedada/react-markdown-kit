import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown, { Markdown as Named, compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import type { Element, Root } from 'hast'
import { applyClassNames } from '../src/class-names.js'

const html = (element: React.ReactElement): string => renderToStaticMarkup(element)

describe('Markdown', () => {
  it('renders CommonMark from a string with no configuration', () => {
    expect(html(<Markdown>{'# Title\n\nSome *em* text.'}</Markdown>)).toBe(
      '<h1>Title</h1>\n<p>Some <em>em</em> text.</p>',
    )
  })

  it('exports the same component as default and named (RENDER-02)', () => {
    expect(Named).toBe(Markdown)
  })

  it('renders an equivalent result from a compiled document (RENDER-03)', () => {
    const source = '## Heading\n\n- a\n- b'
    const fromString = html(<Markdown>{source}</Markdown>)
    const fromDocument = html(<Markdown document={compileMarkdown(source)} />)
    expect(fromDocument).toBe(fromString)
  })

  it('does not mutate a document it is handed', () => {
    const document = compileMarkdown('# Hi')
    const before = JSON.stringify(document.tree)
    html(<Markdown document={document} />)
    expect(JSON.stringify(document.tree)).toBe(before)
  })

  it('supports GFM through a native extension', () => {
    const preset = defineMarkdownPreset({ extensions: [gfm()] })
    const out = html(<Markdown preset={preset}>{'| a | b |\n| - | - |\n| 1 | 2 |'}</Markdown>)
    expect(out).toContain('<table>')
    expect(out).toContain('<td>1</td>')
    expect(preset.profile).toBe('gfm')
  })

  it('leaves tables as text without GFM', () => {
    expect(html(<Markdown>{'| a | b |\n| - | - |'}</Markdown>)).not.toContain('<table>')
  })

  it('maps components', () => {
    const out = html(
      <Markdown components={{ a: ({ children }: never) => <span data-link>{children}</span> }}>
        {'[hi](https://example.com)'}
      </Markdown>,
    )
    expect(out).toContain('<span data-link="true">hi</span>')
  })
})

describe('security (RENDER-08)', () => {
  it('does not execute raw HTML by default', () => {
    // The default renders raw HTML as visible ESCAPED TEXT (matching
    // react-markdown), so the safety property is "never becomes markup", not
    // "the substring is absent". Escaped text is inert.
    const out = html(<Markdown>{'<img src=x onerror="alert(1)">\n\ntext'}</Markdown>)
    // The real property: the raw HTML produces no ELEMENT. `onerror` survives
    // only as characters inside a text node, where it cannot fire. Assert on
    // the set of tags actually emitted rather than on substrings.
    const tags = [...out.matchAll(/<\/?([a-zA-Z][\w-]*)/g)].map((m) => m[1])
    expect(tags).toEqual(['p', 'p'])
    expect(out).toContain('&lt;img')
    expect(out).toContain('&quot;')
  })

  it('escapes a script tag rather than emitting one', () => {
    const out = html(<Markdown>{'<script>alert(1)</script>'}</Markdown>)
    expect(out).not.toContain('<script')
    expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('removes raw HTML entirely when skipHtml is set', () => {
    const out = html(<Markdown skipHtml>{'<img src=x onerror="alert(1)">\n\ntext'}</Markdown>)
    expect(out.trim()).toBe('<p>text</p>')
  })

  it('blocks javascript: urls', () => {
    const out = html(<Markdown>{'[x](javascript:alert(1))'}</Markdown>)
    expect(out).not.toContain('javascript:')
  })

  it('blocks obfuscated protocols', () => {
    // A newline inside a destination means it is not a link at all, so the
    // safety property is "never emits a dangerous href", not "never emits the
    // substring". Inert text is fine.
    for (const url of ['java\nscript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'vbscript:x', 'data:text/html,<script>']) {
      const out = html(<Markdown>{`[x](${url})`}</Markdown>)
      expect(out).not.toMatch(/href="\s*(javascript|vbscript|data):/i)
    }
  })

  it('blocks dangerous image sources', () => {
    const preset = defineMarkdownPreset({ extensions: [gfm()] })
    const out = html(<Markdown preset={preset}>{'![a](javascript:alert(1))'}</Markdown>)
    expect(out).not.toMatch(/src="\s*javascript:/i)
  })

  it('keeps relative and anchor urls', () => {
    expect(html(<Markdown>{'[a](/docs/x) [b](#frag) [c](./y.md)'}</Markdown>)).toContain('href="/docs/x"')
  })

  it('applies policy to a precompiled document too (not a bypass)', () => {
    const document = compileMarkdown('[x](javascript:alert(1))')
    expect(html(<Markdown document={document} />)).not.toContain('javascript:')
  })

  it('honours allowedElements', () => {
    // Removing an element leaves the surrounding whitespace text node, which
    // is what react-markdown does; compatibility matters more than tidiness.
    const out = html(<Markdown allowedElements={['p']}>{'# H\n\ntext'}</Markdown>)
    expect(out.trim()).toBe('<p>text</p>')
    expect(out).not.toContain('<h1>')
  })
})

describe('styling independence', () => {
  it('emits no kit classes by default', () => {
    expect(html(<Markdown>{'# Title\n\ntext'}</Markdown>)).not.toContain('rmk-')
  })

  it('applies opt-in classNames when asked', () => {
    const out = html(<Markdown classNames={{ heading: 'text-2xl font-bold' }}>{'# Title'}</Markdown>)
    expect(out).toBe('<h1 class="text-2xl font-bold">Title</h1>')
  })

  it('names the deck, slide and notes parts an extension marks with data attributes', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'article',
          properties: { dataRmkDeck: '' },
          children: [
            {
              type: 'element',
              tagName: 'section',
              properties: { dataRmkSlide: '1' },
              children: [{ type: 'element', tagName: 'aside', properties: { dataRmkSlideNotes: '' }, children: [] }],
            },
            // Unmarked elements of the same tags stay untouched.
            { type: 'element', tagName: 'section', properties: {}, children: [] },
          ],
        },
      ],
    }
    applyClassNames(tree, { deck: 'my-deck', slide: 'my-slide', slideNotes: 'my-notes' })
    const article = tree.children[0] as Element
    const [slide, plain] = article.children as Element[]
    expect(article.properties['className']).toEqual(['my-deck'])
    expect(slide!.properties['className']).toEqual(['my-slide'])
    expect((slide!.children[0] as Element).properties['className']).toEqual(['my-notes'])
    expect(plain!.properties['className']).toBeUndefined()
  })
})
