/**
 * Detection (docs/MERMAID_PLATFORM.md section 3) and the kind registry
 * (section 4.2): the first word after front matter, directives and comments
 * decides, case-sensitively, and a case slip is a hint, not a guess.
 */
import { describe, expect, it } from 'vitest'
import { MarkdownConfigurationError } from '@internal/diagnostics/index.js'
import { MERMAID_KEYWORDS, detectDiagramKind } from '../src/core/detect.js'
import { defaultKinds, validateKinds } from '../src/core/kinds.js'
import { flowchart } from '../src/core/flowchart-kind.js'
import { sequenceDiagram } from '../src/core/sequence/index.js'
import type { DiagramKind } from '../src/core/kind.js'

const kinds = defaultKinds()
const detect = (source: string) => detectDiagramKind(source, kinds)

const FRONT_MATTER = '---\ntitle: Example\nconfig:\n  theme: base\n---\n'
const DIRECTIVE = '%%{init: { "theme": "forest" }}%%\n'
const COMMENT = '%% a comment\n'

describe('detectDiagramKind: registered kinds', () => {
  it('names a flowchart by either header keyword, support static', () => {
    for (const header of ['flowchart LR', 'graph TD', 'flowchart', 'graph']) {
      const result = detect(`${header}\n  A --> B`)
      expect(result.kind).toBe('flowchart')
      expect(result.support).toBe('static')
      expect(result.registered?.name).toBe('flowchart')
    }
  })

  it('accepts flowchart-elk as the flowchart keyword followed by a dash and more', () => {
    expect(detect('flowchart-elk TD\n  A --> B').kind).toBe('flowchart')
    expect(detect('flowchart-\n  A --> B').kind).toBe('unknown')
  })

  it('does not read graphTD as graph', () => {
    const result = detect('graphTD\n  A --> B')
    expect(result.kind).toBe('unknown')
    expect(result.hint).toBeUndefined()
  })

  it('names a sequenceDiagram, support static because the kind renders', () => {
    const result = detect('sequenceDiagram\n  A->>B: hi')
    expect(result.kind).toBe('sequenceDiagram')
    expect(result.support).toBe('static')
    expect(result.registered?.name).toBe('sequenceDiagram')
  })

  it('reports a registered kind without render as support source', () => {
    const { render: _render, ...sourceOnly } = sequenceDiagram()
    const result = detectDiagramKind('sequenceDiagram\n  A->>B: hi', [flowchart(), sourceOnly])
    expect(result.kind).toBe('sequenceDiagram')
    expect(result.support).toBe('source')
    expect(result.registered?.name).toBe('sequenceDiagram')
  })

  it('tries kinds in registry order', () => {
    const shadow: DiagramKind = { ...sequenceDiagram(), name: 'shadow', keywords: ['flowchart'] }
    expect(detectDiagramKind('flowchart LR', [shadow, flowchart()]).kind).toBe('shadow')
    expect(detectDiagramKind('flowchart LR', [flowchart(), shadow]).kind).toBe('flowchart')
  })

  it('ignores leading whitespace before the keyword', () => {
    expect(detect('\n\n   flowchart LR\n A').kind).toBe('flowchart')
  })
})

describe('detectDiagramKind: Mermaid keywords no kind renders', () => {
  const registeredKeywords = kinds.flatMap((kind) => kind.keywords)
  const unregistered = MERMAID_KEYWORDS.filter((keyword) => !registeredKeywords.some((k) => keyword === k || keyword.startsWith(`${k}-`)))

  it('lists the built-in kinds first, so a trimmed registry still names their fences', () => {
    expect(MERMAID_KEYWORDS.slice(0, 4)).toEqual(['flowchart', 'graph', 'flowchart-elk', 'sequenceDiagram'])
    expect(unregistered).not.toContain('sequenceDiagram')
    expect(detectDiagramKind('sequenceDiagram\n  A->>B: hi', [flowchart()])).toEqual({ kind: 'sequenceDiagram', support: 'source' })
    expect(detectDiagramKind('flowchart-elk TD\n  A --> B', [sequenceDiagram()])).toEqual({ kind: 'flowchart-elk', support: 'source' })
    expect(detectDiagramKind('graph TD\n  A --> B', [])).toEqual({ kind: 'graph', support: 'source' })
    expect(detectDiagramKind('Sequencediagram\n  A->>B: hi', [flowchart()])).toEqual({ kind: 'unknown', support: 'source', hint: 'sequenceDiagram' })
  })

  for (const keyword of unregistered) {
    it(`${keyword}: source, with and without front matter, directives and comments`, () => {
      for (const prefix of ['', FRONT_MATTER, DIRECTIVE, COMMENT, FRONT_MATTER + DIRECTIVE + COMMENT, COMMENT + DIRECTIVE]) {
        const result = detect(`${prefix}${keyword}\n  x`)
        expect(result, prefix).toEqual({ kind: keyword, support: 'source' })
      }
    })
  }

  it('matches the keyword list exactly, so pieChart and information are unknown', () => {
    expect(detect('pieChart\n').kind).toBe('unknown')
    expect(detect('information\n').kind).toBe('unknown')
  })
})

describe('detectDiagramKind: preamble', () => {
  it('skips front matter, directives and comment lines before a registered kind', () => {
    expect(detect(`${FRONT_MATTER}flowchart LR\n A`).kind).toBe('flowchart')
    expect(detect(`${DIRECTIVE}flowchart LR\n A`).kind).toBe('flowchart')
    expect(detect(`${COMMENT}${COMMENT}flowchart LR\n A`).kind).toBe('flowchart')
    expect(detect(`${FRONT_MATTER}${COMMENT}${DIRECTIVE}\n  sequenceDiagram\n A->>B: x`).kind).toBe('sequenceDiagram')
  })

  it('skips a multi-line directive', () => {
    expect(detect('%%{\n  init: { "theme": "dark" }\n}%%\nflowchart LR\n A').kind).toBe('flowchart')
  })

  it('never fails on an unclosed directive: the text after it is consumed, as in Mermaid', () => {
    expect(detect('%%{init: {\nflowchart LR').kind).toBe('unknown')
  })

  it('is unknown for malformed front matter that still starts with ---', () => {
    expect(detect('---\ntitle: x\nflowchart LR\n A')).toEqual({ kind: 'unknown', support: 'source' })
    expect(detect('  ---\ntitle: x\n---\nflowchart LR')).toEqual({ kind: 'unknown', support: 'source' })
  })

  it('is unknown for an empty fence, a comment-only fence and prose', () => {
    expect(detect('')).toEqual({ kind: 'unknown', support: 'source' })
    expect(detect('%% only a comment')).toEqual({ kind: 'unknown', support: 'source' })
    expect(detect('Hello world')).toEqual({ kind: 'unknown', support: 'source' })
    expect(detect('123 flowchart')).toEqual({ kind: 'unknown', support: 'source' })
  })
})

describe('detectDiagramKind: case hints', () => {
  it('hints the registered spelling for a case slip', () => {
    expect(detect('Flowchart LR\n A')).toEqual({ kind: 'unknown', support: 'source', hint: 'flowchart' })
    expect(detect('SequenceDiagram\n A->>B: x')).toEqual({ kind: 'unknown', support: 'source', hint: 'sequenceDiagram' })
    expect(detect('GRAPH TD')).toEqual({ kind: 'unknown', support: 'source', hint: 'graph' })
  })

  it('hints the Mermaid spelling for an unrendered keyword', () => {
    expect(detect('classdiagram\n A')).toEqual({ kind: 'unknown', support: 'source', hint: 'classDiagram' })
    expect(detect('c4context\n')).toEqual({ kind: 'unknown', support: 'source', hint: 'C4Context' })
    expect(detect('statediagram-v2\n')).toEqual({ kind: 'unknown', support: 'source', hint: 'stateDiagram-v2' })
  })

  it('gives no hint when nothing matches case-insensitively', () => {
    expect(detect('flowchartLR\n A').hint).toBeUndefined()
    expect(detect('diagram\n A').hint).toBeUndefined()
  })
})

describe('validateKinds', () => {
  it('accepts the default registry', () => {
    expect(() => validateKinds(defaultKinds())).not.toThrow()
    expect(defaultKinds().map((kind) => kind.name)).toEqual(['flowchart', 'sequenceDiagram'])
  })

  it('throws DIAGRAM_KINDS_INVALID when two kinds claim one keyword', () => {
    const other: DiagramKind = { ...sequenceDiagram(), name: 'other', keywords: ['graph'] }
    let thrown: unknown
    try {
      validateKinds([flowchart(), other])
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(MarkdownConfigurationError)
    expect((thrown as MarkdownConfigurationError).code).toBe('DIAGRAM_KINDS_INVALID')
    expect((thrown as MarkdownConfigurationError).message).toBe('Diagram kinds "flowchart" and "other" both claim keyword "graph".')
  })

  it('throws DIAGRAM_KINDS_INVALID when two kinds share a name', () => {
    const twin: DiagramKind = { ...sequenceDiagram(), keywords: ['seq'] }
    expect(() => validateKinds([sequenceDiagram(), twin])).toThrow(MarkdownConfigurationError)
    expect(() => validateKinds([sequenceDiagram(), twin])).toThrow('Two diagram kinds are named "sequenceDiagram".')
  })
})
