/**
 * Spec 8.17 / 8.7 — variables through `<Markdown>`.
 *
 * `variables({ data })` is an extension, so the renderer needs no variables
 * prop and no adapter component: `<Markdown extensions={[variables(...)]}>`
 * is the whole integration. These tests assert that route, and the one rule
 * the plugin enforces on its own: a failed resolution never renders a
 * half-filled document.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, compileMarkdown } from '@react-markdown-kit/renderer'
import { variables } from '../src/index.js'

const SOURCE = '# Hello {{user.name}}\n\nWelcome to {{company.name}}.'

/** Intl uses non-breaking and narrow spaces; tests compare the plain form. */
const plain = (value: string): string => value.replace(/[  ]/g, ' ')

function render(source: string, options: Parameters<typeof variables>[0], props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(Markdown as never, { extensions: [variables(options)], children: source, ...props } as never),
  )
}

describe('variables() inside <Markdown> (spec 8.17)', () => {
  it('renders the resolved document as HTML', () => {
    expect(render(SOURCE, { data: { user: { name: 'Chatis' }, company: { name: 'ZUI' } } })).toBe(
      '<h1>Hello Chatis</h1>\n<p>Welcome to ZUI.</p>',
    )
  })

  it('produces the same HTML as rendering the compiled document', () => {
    const data = { user: { name: 'Ada' }, company: { name: 'ZUI' } }
    const document = compileMarkdown(SOURCE, { extensions: [variables({ data })] })
    const viaDocument = renderToStaticMarkup(createElement(Markdown as never, { document } as never))
    expect(render(SOURCE, { data })).toBe(viaDocument)
  })

  it('renders a value containing Markdown as literal text (spec 8.11)', () => {
    const html = render(SOURCE, { data: { user: { name: '**Administrator**' }, company: { name: 'ZUI' } } })
    expect(html).toContain('**Administrator**')
    expect(html).not.toContain('<strong>')
  })

  it('escapes HTML in a value', () => {
    const html = render(SOURCE, { data: { user: { name: '<script>alert(1)</script>' }, company: { name: 'ZUI' } } })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('locale and formatting (spec 8.13)', () => {
  it('formats with the requested locale', () => {
    expect(render('Total: {{n | number}}', { data: { n: 1234.5 } })).toBe('<p>Total: 1,234.5</p>')
    expect(plain(render('Total : {{n | number}}', { data: { n: 1234.5 }, locale: 'fr-FR' }))).toContain('1 234,5')
  })
})

describe('failed resolution never renders a partial document (spec 8.7)', () => {
  it('renders nothing by default', () => {
    expect(render(SOURCE, { data: { user: { name: 'x' } } })).toBe('')
  })

  it('renders the fallback when given one', () => {
    expect(render(SOURCE, { data: { user: { name: 'x' } }, fallback: 'Report unavailable' })).toBe(
      '<p>Report unavailable</p>',
    )
  })

  it('reports diagnostics to the caller either way, and on the compiled document', () => {
    const onDiagnostics = vi.fn()
    render(SOURCE, { data: { user: { name: 'x' } }, onDiagnostics })
    expect(onDiagnostics).toHaveBeenCalledTimes(1)
    const [diagnostics] = onDiagnostics.mock.calls[0] as [{ code: string }[]]
    expect(diagnostics.map((d) => d.code)).toContain('VARIABLE_REQUIRED_VALUE')
    const document = compileMarkdown(SOURCE, { extensions: [variables({ data: { user: { name: 'x' } } })] })
    expect(document.diagnostics.map((d) => d.code)).toContain('VARIABLE_REQUIRED_VALUE')
    expect(document.tree.children).toEqual([])
  })
})

describe('renderer props still apply', () => {
  it('accepts component overrides and class name hooks', () => {
    const components = {
      h1: (props: { children?: ReactNode }) => createElement('h2', null, props.children),
    } as Readonly<Record<string, unknown>>
    expect(render('# {{t}}', { data: { t: 'Title' } }, { components })).toBe('<h2>Title</h2>')
    expect(render('# {{t}}', { data: { t: 'Title' } }, { classNames: { heading: 'prose' } })).toContain('prose')
  })
})
