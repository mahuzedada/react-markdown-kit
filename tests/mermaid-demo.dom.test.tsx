/**
 * The Mermaid demo's own pieces (public-sites/mermaid-demo/src): every sample
 * compiles with no diagnostic and sits in one of the two groups, the status
 * chip reads the lifted node with the labels docs/MERMAID_PLATFORM.md section
 * 11 fixes, the block the demo's preset mounts on the right is the flowchart
 * canvas, the sequence canvas or the source pre by kind, the highlighter
 * never changes the text it colours and switches its keyword set with the
 * kind, a mermaid.live hash pointed at this host opens, the link the other
 * way carries the editor state mermaid.live reads, and the export helpers
 * produce a self-contained SVG for every static kind.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { inflateSync } from 'node:zlib'
import { compileMarkdown } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { flowchart, sequenceDiagram, type DiagramKind } from '@react-markdown-kit/mermaid'
import { mount, type Mounted } from '../packages/editor/tests/helpers/mount.js'
import { DEFAULT_CODE, SAMPLES, SAMPLE_GROUPS } from '../public-sites/mermaid-demo/src/samples'
import { KINDS, preset } from '../public-sites/mermaid-demo/src/preset'
import { tokenize, tokenizeLine } from '../public-sites/mermaid-demo/src/highlight'
import { mermaidLiveUrl, sourceFromShared } from '../public-sites/mermaid-demo/src/share'
import { diagramFileName, diagramSvg } from '../public-sites/mermaid-demo/src/export'
import { diagramStatus, kindLabel } from '../public-sites/mermaid-demo/src/status'

const kinds = KINDS
const wrap = (code: string): string => `\`\`\`mermaid\n${code}\n\`\`\`\n`
const status = (code: string, registry: readonly DiagramKind[] = kinds) => diagramStatus(compileMarkdown(wrap(code), { preset }), registry)

/** A kind that parses and renders but does not write, so the block edits it as text (spec 9.2). */
function sourceOnly(kind: DiagramKind): DiagramKind {
  return Object.fromEntries(Object.entries(kind).filter(([key]) => key !== 'write')) as unknown as DiagramKind
}

const sequenceSample = SAMPLES.find((sample) => sample.id === 'signin')?.code ?? ''
const CLASS_DIAGRAM = 'classDiagram\n    Animal <|-- Duck'

describe('samples', () => {
  it('start with the default diagram and have distinct ids and labels', () => {
    expect(SAMPLES[0].code).toBe(DEFAULT_CODE)
    expect(new Set(SAMPLES.map((sample) => sample.id)).size).toBe(SAMPLES.length)
    expect(new Set(SAMPLES.map((sample) => sample.label)).size).toBe(SAMPLES.length)
  })

  it('are grouped as flowcharts and sequence diagrams, each sample in the group its header names', () => {
    expect(SAMPLE_GROUPS.map((group) => group.label)).toEqual(['Flowcharts', 'Sequence diagrams'])
    expect(SAMPLE_GROUPS.flatMap((group) => group.samples)).toEqual(SAMPLES)
    for (const sample of SAMPLE_GROUPS[0].samples) expect(status(sample.code).kind, sample.id).toBe('flowchart')
    expect(SAMPLE_GROUPS[1].samples).toHaveLength(4)
    for (const sample of SAMPLE_GROUPS[1].samples) expect(status(sample.code).kind, sample.id).toBe('sequenceDiagram')
  })

  it('carry no raw semicolon, which would end a statement inside message text', () => {
    for (const sample of SAMPLES) expect(sample.code, sample.id).not.toContain(';')
  })

  for (const sample of SAMPLES) {
    it(`"${sample.label}" compiles to a diagram node without a diagnostic`, () => {
      const document = compileMarkdown(wrap(sample.code), { preset })
      expect(document.diagnostics).toEqual([])
      expect(document.tree.children?.[0]?.type).toBe('diagram')
      expect(status(sample.code).tone).toBe('ok')
    })
  }
})

describe('status chip', () => {
  it('names a flowchart by its layout', () => {
    expect(status(DEFAULT_CODE)).toMatchObject({ tone: 'ok', label: 'Flowchart · auto layout', kind: 'flowchart' })
    const laidOut = status(`flowchart LR\n    a --> b\n%% rmk-layout v1 {"nodes":{"a":{"x":10,"y":10}}}`)
    expect(laidOut.label).toBe('Flowchart · rmk-layout v1')
  })

  it('names a sequence diagram as canvas, and as static when its kind does not write', () => {
    expect(status(sequenceSample)).toMatchObject({ tone: 'ok', label: 'Sequence diagram · canvas', kind: 'sequenceDiagram' })
    const textOnly = status(sequenceSample, [flowchart(), sourceOnly(sequenceDiagram())])
    expect(textOnly).toMatchObject({ tone: 'ok', label: 'Sequence diagram · static', kind: 'sequenceDiagram' })
  })

  it('names a Mermaid type nothing renders as source only', () => {
    const chip = status(CLASS_DIAGRAM)
    expect(chip).toMatchObject({ tone: 'warn', label: 'Class diagram · source only', kind: 'classDiagram' })
    expect(chip.message).toContain('shown as source')
    expect(kindLabel('gantt', kinds)).toBe('Gantt chart')
    expect(kindLabel('flowchart', kinds)).toBe('Flowchart')
    expect(kindLabel('somethingElse', kinds)).toBe('somethingElse')
  })

  it('says Not Mermaid for text without a keyword, with the case hint as its message', () => {
    expect(status('hello world')).toMatchObject({ tone: 'warn', label: 'Not Mermaid', kind: 'unknown' })
    const slipped = status('SequenceDiagram\n    A->>B: hi')
    expect(slipped.label).toBe('Not Mermaid')
    expect(slipped.message).toContain('expected `sequenceDiagram`')
  })

  it('reports the first statement Mermaid itself would reject with its line', () => {
    const chip = status('sequenceDiagram\n    A->>B: hi\n    end')
    expect(chip.tone).toBe('warn')
    expect(chip.label).toBe('Mermaid rejects line 3')
    expect(chip.message).toBeDefined()
    expect(status('flowchart LR\n    a --> b\n    this is not a statement').label).toBe('Mermaid rejects line 3')
  })
})

describe('the block', () => {
  const views: Mounted[] = []
  afterEach(() => {
    for (const view of views.splice(0)) view.unmount()
  })

  /** The demo's right pane: the same preset, the same props, the sample's fence as the whole document. */
  function open(code: string): HTMLElement {
    const view = mount(<MarkdownEditor preset={preset} value={wrap(code)} toolbar={false} aria-label="Diagram block" />)
    views.push(view)
    return view.container
  }

  const block = (container: HTMLElement): Element => {
    const found = container.querySelector('.rmk-diagram-block')
    if (found === null) throw new Error('No diagram block.')
    return found
  }

  it('mounts the sequence canvas, editable with its tool row, for every sequence sample', () => {
    for (const sample of SAMPLE_GROUPS[1].samples) {
      const container = open(sample.code)
      const canvas = block(container).querySelector('.rmk-diagram-canvas.rmk-sequence-canvas')
      expect(canvas, sample.id).not.toBeNull()
      expect(canvas?.classList.contains('is-editable'), sample.id).toBe(true)
      expect(canvas?.querySelector('.rmk-diagram-toolbar'), sample.id).not.toBeNull()
      expect(canvas?.querySelector('.rmk-sequence-viewport .rmk-sequence-picture svg[role="img"]'), sample.id).not.toBeNull()
      expect(canvas?.querySelector('.rmk-sequence-layer'), sample.id).not.toBeNull()
      expect(block(container).querySelector('.rmk-diagram-source'), sample.id).toBeNull()
    }
  })

  it('mounts the flowchart canvas for every flowchart sample', () => {
    for (const sample of SAMPLE_GROUPS[0].samples) {
      const container = open(sample.code)
      expect(block(container).querySelector('.rmk-diagram-canvas .rmk-diagram-surface'), sample.id).not.toBeNull()
      expect(block(container).querySelector('.rmk-sequence-canvas'), sample.id).toBeNull()
    }
  })

  it('shows the source under the unsupported notice, with no textarea, for a Mermaid type nothing renders', () => {
    const container = open(CLASS_DIAGRAM)
    expect(block(container).querySelector('.rmk-diagram-canvas')).toBeNull()
    expect(block(container).querySelector('.rmk-diagram-notice')).not.toBeNull()
    expect(block(container).querySelector('.rmk-diagram-source-pre')?.textContent).toContain('Animal <|-- Duck')
    // The code pane on the left is the demo's source editor for every kind.
    expect(block(container).querySelector('.rmk-diagram-source-input')).toBeNull()
  })

  it('offers the Text/Canvas toggle for both canvas kinds', () => {
    for (const code of [DEFAULT_CODE, sequenceSample]) {
      const mode = block(open(code)).querySelector('.rmk-diagram-mode')
      expect(mode, code.split('\n')[0]).not.toBeNull()
    }
    expect(block(open(CLASS_DIAGRAM)).querySelector('.rmk-diagram-mode')).toBeNull()
  })
})

describe('highlight', () => {
  it('covers every character of every line, in order, with the keyword set of its kind', () => {
    for (const sample of SAMPLES) {
      const lines = tokenize(sample.code, status(sample.code).kind)
      expect(lines.map((tokens) => tokens.map((token) => token.text).join('')).join('\n')).toBe(sample.code)
    }
  })

  it('names the parts of a flowchart line', () => {
    const kinds = tokenizeLine('    a[Start] -->|go| b{Done?} %% note').filter((token) => token.kind !== 'plain').map((token) => token.kind)
    expect(kinds).toEqual(['bracket', 'bracket', 'edge', 'label', 'bracket', 'bracket', 'comment'])
    expect(tokenizeLine('flowchart LR').map((token) => token.kind)).toEqual(['keyword', 'plain', 'direction'])
    expect(tokenizeLine('style a fill:#a5d8ff').filter((token) => token.kind === 'color')[0]?.text).toBe('#a5d8ff')
  })

  it('names the parts of a sequence diagram line', () => {
    const kindsOf = (line: string) => tokenizeLine(line, 'sequenceDiagram').map((token) => token.kind)
    expect(kindsOf('sequenceDiagram')).toEqual(['keyword'])
    expect(kindsOf('    Alice->>+Bob: Hello Bob')).toEqual(['plain', 'edge', 'plain', 'string'])
    expect(tokenizeLine('    Alice->>+Bob: Hello Bob', 'sequenceDiagram').find((token) => token.kind === 'edge')?.text).toBe('->>+')
    expect(kindsOf('    Note over Alice,Bob: a note')).toEqual(['plain', 'keyword', 'plain', 'keyword', 'plain', 'string'])
    expect(kindsOf('    alt credentials valid')).toEqual(['plain', 'keyword', 'plain'])
    expect(kindsOf('    participant A as Alice')).toEqual(['plain', 'keyword', 'plain', 'keyword', 'plain'])
    expect(kindsOf('    %% a comment')).toEqual(['comment'])
    // A flowchart keyword is plain text in a sequence diagram, and the other way round.
    expect(kindsOf('    subgraph x')).toEqual(['plain'])
    expect(tokenizeLine('    participant A').map((token) => token.kind)).toEqual(['plain'])
  })

  it('keeps a trailing newline as an empty last line, as the textarea shows it', () => {
    expect(tokenize('a\n')).toHaveLength(2)
    expect(tokenize('')).toEqual([[]])
    expect(tokenize('', 'sequenceDiagram')).toEqual([[]])
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
  const selfContained = (svg: string | undefined): void => {
    expect(svg).toBeDefined()
    expect(svg?.startsWith('<svg')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).not.toContain('var(--')
    expect(svg).not.toContain('<foreignObject')
    const parsed = new DOMParser().parseFromString(svg ?? '', 'image/svg+xml')
    expect(parsed.querySelector('parsererror')?.textContent).toBeUndefined()
    expect(parsed.documentElement.tagName).toBe('svg')
  }

  it('renders a flowchart as one self-contained SVG document', () => {
    selfContained(diagramSvg(wrap(DEFAULT_CODE), preset))
  })

  it('exports an SVG for the sequence sample', () => {
    const svg = diagramSvg(wrap(sequenceSample), preset)
    selfContained(svg)
    // The theme tokens are inlined to their Mermaid fallbacks, so the file looks like Mermaid.
    expect(svg).toMatch(/fill="#[0-9a-f]{6}"/)
  })

  it('has nothing to export for a Mermaid type shown as source', () => {
    expect(diagramSvg(wrap(CLASS_DIAGRAM), preset)).toBeUndefined()
  })

  it('names the file after the front-matter title when there is one', () => {
    expect(diagramFileName(DEFAULT_CODE, 'svg')).toBe('diagram.svg')
    expect(diagramFileName('---\ntitle: Order flow (v2)\n---\nflowchart LR\n    a --> b', 'png')).toBe('order-flow-v2.png')
  })
})
