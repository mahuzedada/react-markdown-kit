import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { template } from '@react-markdown-kit/template'
import { slides, isSlideDirectiveNode, isSlideMarkerNode } from '../src/index.js'

const DECK = `---
title: Q3 review
---

# Welcome

Hello.

---

<!-- name: numbers -->
<!-- class: center, middle -->
<!-- background: https://example.com/bg.jpg -->

## Numbers

Intro.

--

One.

--

Two.

???

say this

---

## Close
`

/** Section 2 of the spec, three slides. Attribute order is part of the contract. */
const EXPECTED =
  '<article data-rmk-deck="" data-rmk-deck-slides="3" data-rmk-deck-aspect="16:9" data-rmk-deck-title="Q3 review">' +
  '<section data-rmk-slide="1" data-rmk-slide-title="Welcome" aria-roledescription="slide" aria-label="Welcome">' +
  '<div data-rmk-slide-body=""><h1>Welcome</h1><p>Hello.</p></div></section>' +
  '<section data-rmk-slide="2" data-rmk-slide-title="Numbers" aria-roledescription="slide" aria-label="Numbers" id="slide-numbers" data-rmk-slide-name="numbers" data-rmk-slide-class="center middle" data-rmk-slide-fragments="2">' +
  '<img data-rmk-slide-background="" src="https://example.com/bg.jpg" alt=""/>' +
  '<div data-rmk-slide-body=""><h2>Numbers</h2><p>Intro.</p><div data-rmk-fragment="1"><p>One.</p></div><div data-rmk-fragment="2"><p>Two.</p></div></div>' +
  '<aside data-rmk-slide-notes="" hidden=""><p>say this</p></aside></section>' +
  '<section data-rmk-slide="3" data-rmk-slide-title="Close" aria-roledescription="slide" aria-label="Close">' +
  '<div data-rmk-slide-body=""><h2>Close</h2></div></section></article>'

const preset = defineMarkdownPreset({ extensions: [slides()] })

/**
 * React 19 floats a `<link rel="preload" as="image">` hint ahead of any <img>
 * it renders on the server. It is not part of the deck's DOM (the repo's
 * CommonMark suite strips the same float), so tests compare without it.
 */
function withoutFloats(html: string): string {
  return html.replace(/<link\b[^>]*\brel="preload"[^>]*>/g, '')
}

function render(source: string, props: Record<string, unknown> = {}): string {
  return withoutFloats(renderToStaticMarkup(createElement(Markdown, { preset, children: source, ...props } as never)))
}

describe('slides(): renderer', () => {
  it('renders exactly the documented DOM for a three-slide deck', () => {
    expect(render(DECK)).toBe(EXPECTED)
  })

  it('emits no class, style or id beyond slide-<name>', () => {
    const html = render(DECK)
    expect(html).not.toMatch(/ class="/)
    expect(html).not.toMatch(/ style="/)
    expect(html.match(/ id="[^"]*"/g)).toEqual([' id="slide-numbers"'])
  })

  it('lands GFM footnotes after the article', () => {
    const html = renderToStaticMarkup(
      createElement(Markdown, { extensions: [gfm(), slides()], children: '# One[^1]\n\n[^1]: the note\n\n---\n\n# Two\n' }),
    )
    expect(html.indexOf('</article>')).toBeGreaterThan(0)
    expect(html.indexOf('data-footnotes')).toBeGreaterThan(html.indexOf('</article>'))
    expect(html).toContain('data-rmk-slide="2"')
  })

  it('applies the classNames hook to the deck, the slides and the notes', () => {
    const html = render(DECK, { classNames: { deck: 'my-deck', slide: 'my-slide', slideNotes: 'my-notes', heading: 'my-h' } })
    expect(html).toMatch(/<article[^>]*class="my-deck"/)
    expect(html.match(/<section[^>]*class="my-slide"/g)).toHaveLength(3)
    expect(html).toMatch(/<aside[^>]*class="my-notes"/)
    expect(html).toContain('<h2 class="my-h">Numbers</h2>')
  })

  it('omits the notes aside with notes: false', () => {
    const html = renderToStaticMarkup(createElement(Markdown, { extensions: [slides({ notes: false })], children: DECK }))
    expect(html).not.toContain('data-rmk-slide-notes')
    expect(html).not.toContain('say this')
    expect(html).toContain('data-rmk-slide-fragments="2"')
  })

  it('takes the aspect from the option, and front matter wins over it', () => {
    expect(renderToStaticMarkup(createElement(Markdown, { extensions: [slides({ aspect: '4:3' })], children: '# One\n' }))).toContain(
      'data-rmk-deck-aspect="4:3"',
    )
    expect(
      renderToStaticMarkup(createElement(Markdown, { extensions: [slides({ aspect: '4:3' })], children: '---\naspect: 16:9\n---\n\n# One\n' })),
    ).toContain('data-rmk-deck-aspect="16:9"')
  })

  it('labels a slide without a heading with slideLabel and its number', () => {
    const html = renderToStaticMarkup(createElement(Markdown, { extensions: [slides({ slideLabel: 'Folie' })], children: 'text\n\n---\n\ntext\n' }))
    expect(html).toContain('aria-label="Folie 2"')
    expect(html).not.toContain('data-rmk-slide-title')
    expect(html).not.toContain('data-rmk-deck-title')
  })

  it('runs a javascript: background through the URL policy', () => {
    const html = render('<!-- background: javascript:alert(1) -->\n\n# One\n')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('data-rmk-slide-background=""')
  })

  it('shows an unknown directive as text, like any other comment', () => {
    const html = render('# One\n\n<!-- foo: bar -->\n')
    expect(html).toContain('&lt;!-- foo: bar --&gt;')
  })

  it('renders a rule inside a slide as <hr> and never as a break', () => {
    const html = render('# One\n\n***\n\ntext\n')
    expect(html).toContain('data-rmk-deck-slides="1"')
    expect(html).toContain('<hr/>')
  })

  it('parses no front matter with frontMatter: false', () => {
    const document = compileMarkdown('---\ntitle: x\n---\n\n# One\n', { extensions: [slides({ frontMatter: false })] })
    expect(document.tree.children.some((node) => node.type === 'yaml')).toBe(false)
    const html = renderToStaticMarkup(createElement(Markdown, { extensions: [slides({ frontMatter: false })], children: '---\n\n# One\n' }))
    expect(html).not.toContain('data-rmk-deck-title="x"')
    expect(html).toContain('data-rmk-deck-slides="1"')
  })

  it('renders an empty document as a deck with no slides', () => {
    expect(render('')).toBe('<article data-rmk-deck="" data-rmk-deck-slides="0" data-rmk-deck-aspect="16:9"></article>')
  })
})

describe('slides(): extension object', () => {
  it('is named slides at version 1 and replaces an earlier one in a preset', () => {
    const merged = defineMarkdownPreset({ extensions: [slides(), slides({ notes: false })] })
    expect(merged.extensions.map((extension) => `${extension.name}@${extension.version}`)).toEqual(['slides@1'])
    const html = renderToStaticMarkup(createElement(Markdown, { preset: merged, children: DECK }))
    expect(html).not.toContain('data-rmk-slide-notes')
  })

  it('declares its node types and marks them literal for templates', () => {
    const extension = slides()
    expect(extension.contractVersion).toBe(1)
    expect(extension.capabilities?.syntax?.nodeTypes).toEqual(['slideMarker', 'slideDirective'])
    expect(extension.capabilities?.template?.literalNodeTypes).toEqual(['slideMarker', 'slideDirective'])
    expect(extension.capabilities?.editor).toBeUndefined()
  })
})

describe('slides(): template', () => {
  it('resolves a placeholder in a slide and leaves markers and directives literal', () => {
    const source = '# {{name}}\n\n--\n\n<!-- background: https://x/{{name}}.png -->\n\ntext {{name}}\n'
    const document = compileMarkdown(source, { extensions: [slides(), template({ data: { name: 'Acme' } })] })
    expect(document.diagnostics).toEqual([])
    expect(JSON.stringify(document.tree.children[0])).toContain('Acme')
    expect(document.tree.children.filter(isSlideMarkerNode)).toHaveLength(1)
    const directive = document.tree.children.find(isSlideDirectiveNode)
    expect(directive?.argument).toBe('https://x/{{name}}.png')
    const html = renderToStaticMarkup(createElement(Markdown, { document, extensions: [slides()] }))
    expect(html).toContain('<h1>Acme</h1>')
    expect(html).toContain('<p>text Acme</p>')
    expect(html).toContain('data-rmk-slide-fragments="1"')
  })
})
