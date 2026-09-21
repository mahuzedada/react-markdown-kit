/**
 * Proves the four styling approaches in docs/STYLING.md all work against one
 * unmodified renderer. This is the executable form of the promise that the kit
 * imposes no design system.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentPropsWithoutRef } from 'react'
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// jsdom does not give import.meta.url a file: scheme; vitest runs from the root.
const root = process.cwd()
const preset = defineMarkdownPreset({ extensions: [gfm()] })
const SOURCE = '## Title\n\nText with a [link](https://example.com) and `code`.\n\n- one\n- two'
const html = (e: React.ReactElement) => renderToStaticMarkup(e)

describe('approach 1: unstyled', () => {
  it('emits plain semantic HTML with no kit classes and no inline style', () => {
    const out = html(<Markdown preset={preset}>{SOURCE}</Markdown>)
    expect(out).not.toContain('rmk-')
    expect(out).not.toContain('class=')
    expect(out).not.toContain('style=')
    expect(out).toContain('<h2>Title</h2>')
    expect(out).toContain('<li>one</li>')
  })
})

describe('approach 2: shipped theme', () => {
  const css = readFileSync(join(root, 'packages/renderer/src/styles.css'), 'utf8')

  it('is entirely scoped to .rmk-document', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|\})([^{}@]+)\{/g)
    for (const rule of rules) {
      for (const selector of rule[2]!.split(',')) {
        const trimmed = selector.trim()
        if (trimmed === '') continue
        expect(trimmed, 'every selector must be scoped').toMatch(/^\.rmk-document\b/)
      }
    }
  })

  it('ships no reset and no !important', () => {
    expect(css).not.toContain('!important')
    expect(css).not.toMatch(/^\s*\*\s*\{/m)
    expect(css).not.toMatch(/^\s*(html|body)\s*[,{]/m)
  })

  it('routes every colour through an overridable custom property', () => {
    for (const line of css.split('\n')) {
      const declaration = line.trim()
      if (/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|color-mix)\(/.test(declaration)) {
        expect(declaration, 'colours must be retintable').toMatch(/^--rmk-/)
      }
    }
  })
})

describe('approach 3: utility classes', () => {
  it('applies consumer classes per part', () => {
    const out = html(
      <Markdown
        preset={preset}
        classNames={{ heading: 'text-xl font-bold', link: 'text-blue-600 underline', code: 'bg-slate-100' }}
      >
        {SOURCE}
      </Markdown>,
    )
    expect(out).toContain('<h2 class="text-xl font-bold">Title</h2>')
    expect(out).toContain('class="text-blue-600 underline"')
    expect(out).toContain('class="bg-slate-100"')
  })

  it('replaces rather than merges, so there is nothing to out-specify', () => {
    const out = html(<Markdown classNames={{ heading: 'only-mine' }}>{'# T'}</Markdown>)
    expect(out).toBe('<h1 class="only-mine">T</h1>')
    expect(out).not.toContain('rmk-heading')
  })

  it('leaves unnamed parts untouched', () => {
    const out = html(<Markdown classNames={{ heading: 'h' }}>{'# T\n\np'}</Markdown>)
    expect(out).toContain('<p>p</p>')
  })

  it('preserves classes a plugin already set, such as language-*', () => {
    const out = html(<Markdown classNames={{ code: 'mine' }}>{'```js\nx\n```'}</Markdown>)
    expect(out).toContain('language-js')
    expect(out).toContain('mine')
  })
})

describe('approach 4: your own components', () => {
  function Link({ href, children }: ComponentPropsWithoutRef<'a'>) {
    return <a href={href} data-design-system="anything">{children}</a>
  }
  function Table({ children }: ComponentPropsWithoutRef<'table'>) {
    return <div data-scroll><table>{children}</table></div>
  }

  it('replaces elements wholesale', () => {
    const out = html(<Markdown preset={preset} components={{ a: Link }}>{SOURCE}</Markdown>)
    expect(out).toContain('data-design-system="anything"')
  })

  it('lets a component add wrapper markup', () => {
    const out = html(
      <Markdown preset={preset} components={{ table: Table }}>{'| a |\n| - |\n| 1 |'}</Markdown>,
    )
    expect(out).toContain('<div data-scroll="true"><table>')
  })

  it('combines with a preset that already sets components, local winning', () => {
    const withComponents = defineMarkdownPreset({
      extensions: [gfm()],
      components: { a: () => <span>from-preset</span> },
    })
    const out = html(<Markdown preset={withComponents} components={{ a: Link }}>{SOURCE}</Markdown>)
    expect(out).toContain('data-design-system')
    expect(out).not.toContain('from-preset')
  })
})

describe('no design system is reachable from the rendered output', () => {
  it('renders without any provider, context or theme wrapper', () => {
    // If the kit required a provider this would throw rather than render.
    expect(() => html(<Markdown>{SOURCE}</Markdown>)).not.toThrow()
  })
})
