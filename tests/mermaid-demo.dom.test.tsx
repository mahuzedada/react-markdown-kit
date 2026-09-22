/**
 * The Mermaid demo's own pieces (public-sites/mermaid-demo/src): every sample
 * is a flowchart the canvas opens, the highlighter never changes the text it
 * colours, a mermaid.live hash pointed at this host opens, the link the other
 * way carries the editor state mermaid.live reads, and the export helpers
 * produce a self-contained SVG.
 */
import { describe, expect, it } from 'vitest'
import { inflateSync } from 'node:zlib'
import { compileMarkdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { mermaid } from '@react-markdown-kit/mermaid'
import { DEFAULT_CODE, SAMPLES } from '../public-sites/mermaid-demo/src/samples'
import { tokenize, tokenizeLine } from '../public-sites/mermaid-demo/src/highlight'
import { mermaidLiveUrl, sourceFromShared } from '../public-sites/mermaid-demo/src/share'
import { diagramFileName, diagramSvg } from '../public-sites/mermaid-demo/src/export'

const preset = defineMarkdownPreset({ extensions: [mermaid()] })
const wrap = (code: string): string => `\`\`\`mermaid\n${code}\n\`\`\`\n`

describe('samples', () => {
  it('start with the default diagram and have distinct ids and labels', () => {
    expect(SAMPLES[0].code).toBe(DEFAULT_CODE)
    expect(new Set(SAMPLES.map((sample) => sample.id)).size).toBe(SAMPLES.length)
    expect(new Set(SAMPLES.map((sample) => sample.label)).size).toBe(SAMPLES.length)
  })

  for (const sample of SAMPLES) {
    it(`"${sample.label}" is a flowchart the canvas opens without a diagnostic`, () => {
      const document = compileMarkdown(wrap(sample.code), { preset })
      expect(document.diagnostics).toEqual([])
      expect(document.tree.children?.[0]?.type).toBe('diagram')
    })
  }
})

describe('highlight', () => {
  it('covers every character of every line, in order', () => {
    for (const sample of SAMPLES) {
      const lines = tokenize(sample.code)
      expect(lines.map((tokens) => tokens.map((token) => token.text).join('')).join('\n')).toBe(sample.code)
    }
  })

  it('names the parts of a flowchart line', () => {
    const kinds = tokenizeLine('    a[Start] -->|go| b{Done?} %% note').filter((token) => token.kind !== 'plain').map((token) => token.kind)
    expect(kinds).toEqual(['bracket', 'bracket', 'edge', 'label', 'bracket', 'bracket', 'comment'])
    expect(tokenizeLine('flowchart LR').map((token) => token.kind)).toEqual(['keyword', 'plain', 'direction'])
    expect(tokenizeLine('style a fill:#a5d8ff').filter((token) => token.kind === 'color')[0]?.text).toBe('#a5d8ff')
  })

  it('keeps a trailing newline as an empty last line, as the textarea shows it', () => {
    expect(tokenize('a\n')).toHaveLength(2)
    expect(tokenize('')).toEqual([[]])
  })
})

describe('mermaid.live interop', () => {
  it('lifts the code out of a mermaid.live editor state and passes bare source through', () => {
    const state = JSON.stringify({ code: 'flowchart LR\n    a --> b', mermaid: '{"theme":"default"}', autoSync: true })
    expect(sourceFromShared(state)).toBe('flowchart LR\n    a --> b')
    expect(sourceFromShared('flowchart LR\n    a --> b')).toBe('flowchart LR\n    a --> b')
    expect(sourceFromShared('{ not json')).toBe('{ not json')
    expect(sourceFromShared('{"other": 1}')).toBe('{"other": 1}')
  })

  it('links to mermaid.live with the state its editor reads', async () => {
    const url = await mermaidLiveUrl(DEFAULT_CODE)
    expect(url.startsWith('https://mermaid.live/edit#pako:')).toBe(true)
    const payload = url.slice('https://mermaid.live/edit#pako:'.length).replace(/-/g, '+').replace(/_/g, '/')
    const state = JSON.parse(inflateSync(Buffer.from(payload, 'base64')).toString('utf8')) as { code: string; mermaid: string }
    expect(state.code).toBe(DEFAULT_CODE)
    expect(JSON.parse(state.mermaid)).toEqual({ theme: 'default' })
  })
})

describe('export', () => {
  it('renders a flowchart as one self-contained SVG document', () => {
    const svg = diagramSvg(wrap(DEFAULT_CODE), preset)
    expect(svg).toBeDefined()
    expect(svg?.startsWith('<svg')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).not.toContain('var(--')
    expect(svg).not.toContain('<foreignObject')
    const parsed = new DOMParser().parseFromString(svg ?? '', 'image/svg+xml')
    expect(parsed.querySelector('parsererror')?.textContent).toBeUndefined()
    expect(parsed.documentElement.tagName).toBe('svg')
  })

  it('has nothing to export for a diagram type the canvas does not open', () => {
    expect(diagramSvg(wrap('sequenceDiagram\n    A->>B: hi'), preset)).toBeUndefined()
  })

  it('names the file after the front-matter title when there is one', () => {
    expect(diagramFileName(DEFAULT_CODE, 'svg')).toBe('diagram.svg')
    expect(diagramFileName('---\ntitle: Order flow (v2)\n---\nflowchart LR\n    a --> b', 'png')).toBe('order-flow-v2.png')
  })
})
