/**
 * The host fallback from `/client`, mounted in jsdom (spec 6.1): the first
 * render is the server markup, the host's SVG replaces the <pre> after the
 * effect, a static figure and a plain figure are untouched, a failing host
 * keeps the source, and the extension is the one the spec names.
 *
 * The source figure is emitted by a small stand-in handler that produces the
 * section 6 markup verbatim, so this test pins the fallback to the documented
 * figure rather than to whichever kinds `mermaid()` happens to register.
 * The parse-error path goes through the real `mermaid()`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Element } from 'hast'
import { Markdown, defineMarkdownPreset, type MarkdownExtension } from '@react-markdown-kit/renderer'
import { mount, type Mounted } from '../../../packages/editor/tests/helpers/mount.js'
import { diagramFallback } from '../src/client.js'
import { createDiagramFigure } from '../src/client/diagram-fallback.js'
import { mermaid } from '../src/index.js'
import { h, text } from '../src/svg/hast.js'

const CLASS_SOURCE = 'classDiagram\n  Animal : +int age\n  Animal : +String gender'
const CLASS_FENCE = `\`\`\`mermaid\n${CLASS_SOURCE}\n\`\`\`\n`
const FLOWCHART_FENCE = '```mermaid\nflowchart LR\n  a[Start] --> b[Stop]\n```\n'
const BROKEN_FENCE = '```diagram\n{not json\n```\n'
const HOST_SVG = '<svg viewBox="0 0 10 10"><rect width="10" height="10"></rect></svg>'

/** A stand-in for a registered-but-unsupported kind: every ```mermaid fence becomes the section 6 source figure. */
function sourceFigures(): MarkdownExtension {
  return {
    name: 'source-figures',
    version: '1',
    contractVersion: 1,
    capabilities: {
      renderer: {
        handlers: {
          code: (_state: unknown, node: { value?: string }): Element =>
            h('figure', { dataRmkDiagram: 'mermaid', dataRmkDiagramKind: 'classDiagram', dataRmkDiagramSupport: 'source' }, [
              h('pre', {}, [h('code', { className: ['language-mermaid'] }, [text(node.value ?? '')])]),
            ]),
        },
      },
    },
  }
}

/** A host renderer whose promise the test resolves by hand, so the first render can be observed before it settles. */
function deferredHost(): { render: ReturnType<typeof vi.fn>; resolve: (svg: string) => Promise<void>; reject: () => Promise<void> } {
  let settle: { resolve: (svg: string) => void; reject: (error: Error) => void } | undefined
  const render = vi.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        settle = { resolve, reject }
      }),
  )
  const flush = async (): Promise<void> => {
    await act(async () => {
      await Promise.resolve()
    })
  }
  return {
    render,
    resolve: async (svg) => {
      settle?.resolve(svg)
      await flush()
    },
    reject: async () => {
      settle?.reject(new Error('host down'))
      await flush()
    },
  }
}

const views: Mounted[] = []
function keep(view: Mounted): Mounted {
  views.push(view)
  return view
}
afterEach(() => {
  for (const view of views.splice(0)) view.unmount()
})

describe('diagramFallback(): the extension', () => {
  it('is named mermaid-fallback and contributes one renderer component, the figure', () => {
    const extension = diagramFallback({ render: async () => HOST_SVG })
    expect(extension.name).toBe('mermaid-fallback')
    expect(extension.version).toBe('1')
    expect(extension.contractVersion).toBe(1)
    expect(Object.keys(extension.capabilities ?? {})).toEqual(['renderer'])
    expect(Object.keys(extension.capabilities?.renderer?.components ?? {})).toEqual(['figure'])
  })

  it('renders a figure that is not a diagram as a plain element', () => {
    const Figure = createDiagramFigure({ render: async () => HOST_SVG })
    expect(renderToStaticMarkup(createElement(Figure, { node: {}, id: 'x' }, 'text'))).toBe('<figure id="x">text</figure>')
  })
})

describe('diagramFallback(): a source figure', () => {
  it('first renders the server markup, then swaps the pre for the host SVG after the effect', async () => {
    const host = deferredHost()
    const preset = defineMarkdownPreset({ extensions: [sourceFigures(), diagramFallback({ render: host.render })] })
    const server = renderToStaticMarkup(<Markdown preset={preset}>{CLASS_FENCE}</Markdown>)
    expect(server).toBe(
      '<figure data-rmk-diagram="mermaid" data-rmk-diagram-kind="classDiagram" data-rmk-diagram-support="source">' +
        `<pre><code class="language-mermaid">${CLASS_SOURCE}</code></pre></figure>`,
    )

    const view = keep(mount(<Markdown preset={preset}>{CLASS_FENCE}</Markdown>))
    expect(view.container.innerHTML).toBe(server)
    expect(host.render).toHaveBeenCalledTimes(1)
    expect(host.render).toHaveBeenCalledWith(CLASS_SOURCE, 'classDiagram')

    await host.resolve(HOST_SVG)
    const figure = view.container.querySelector('figure')
    expect(figure?.getAttribute('data-rmk-diagram-support')).toBe('source')
    expect(figure?.querySelector('pre')).toBeNull()
    const fallback = figure?.querySelector('div[data-rmk-diagram-fallback]')
    expect(fallback).not.toBeNull()
    expect(fallback?.innerHTML).toBe(HOST_SVG)
    expect(fallback?.querySelector('svg')).not.toBeNull()
  })

  it('hydrates the server markup without a mismatch', async () => {
    const host = deferredHost()
    const preset = defineMarkdownPreset({ extensions: [sourceFigures(), diagramFallback({ render: host.render })] })
    const element = <Markdown preset={preset}>{CLASS_FENCE}</Markdown>
    const container = document.createElement('div')
    const server = renderToStaticMarkup(element)
    container.innerHTML = server
    document.body.appendChild(container)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let root!: ReturnType<typeof hydrateRoot>
    act(() => {
      root = hydrateRoot(container, element)
    })
    expect(errors).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe(server)
    await host.resolve(HOST_SVG)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    expect(container.querySelector('div[data-rmk-diagram-fallback] svg')).not.toBeNull()
    act(() => root.unmount())
    container.remove()
  })

  it('keeps the source when the host fails', async () => {
    const host = deferredHost()
    const preset = defineMarkdownPreset({ extensions: [sourceFigures(), diagramFallback({ render: host.render })] })
    const view = keep(mount(<Markdown preset={preset}>{CLASS_FENCE}</Markdown>))
    await host.reject()
    expect(view.container.querySelector('div[data-rmk-diagram-fallback]')).toBeNull()
    expect(view.container.querySelector('pre code')?.textContent).toBe(CLASS_SOURCE)
  })

  it('also takes over a parse error figure from mermaid()', async () => {
    const host = deferredHost()
    const preset = defineMarkdownPreset({ extensions: [mermaid(), diagramFallback({ render: host.render })] })
    const view = keep(mount(<Markdown preset={preset}>{BROKEN_FENCE}</Markdown>))
    expect(view.container.querySelector('figure')?.hasAttribute('data-rmk-diagram-error')).toBe(true)
    expect(host.render).toHaveBeenCalledWith('{not json', expect.any(String))
    await host.resolve(HOST_SVG)
    expect(view.container.querySelector('figure pre')).toBeNull()
    expect(view.container.querySelector('figure div[data-rmk-diagram-fallback] svg')).not.toBeNull()
  })
})

describe('diagramFallback(): a static figure', () => {
  it('is untouched and never sent to the host', () => {
    const host = deferredHost()
    const preset = defineMarkdownPreset({ extensions: [mermaid(), diagramFallback({ render: host.render })] })
    const server = renderToStaticMarkup(<Markdown preset={preset}>{FLOWCHART_FENCE}</Markdown>)
    expect(server).toMatch(/^<figure data-rmk-diagram="mermaid"[^>]*><svg/)
    const view = keep(mount(<Markdown preset={preset}>{FLOWCHART_FENCE}</Markdown>))
    expect(view.container.innerHTML).toBe(server)
    expect(host.render).not.toHaveBeenCalled()
    expect(view.container.querySelector('div[data-rmk-diagram-fallback]')).toBeNull()
  })
})
