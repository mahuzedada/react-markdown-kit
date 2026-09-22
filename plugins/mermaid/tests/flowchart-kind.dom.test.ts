/**
 * The flowchart kind's severity contract, checked against Mermaid.js
 * (docs/MERMAID_PLATFORM.md section 4.1): a problem is `invalid` only when
 * Mermaid.js rejects the fence, and never for a fence it accepts. Every
 * input here comes from the review findings named in the test titles.
 *
 * Runs under jsdom by its `.dom.test` name, like `conformance.dom.test.ts`:
 * `mermaid.parse` only lexes and parses, so no `initialize` is needed.
 */
import mermaid from 'mermaid'
import { describe, expect, it } from 'vitest'
import { flowchart } from '../src/core/flowchart-kind.js'
import type { DiagramParse } from '../src/core/kind.js'
import type { DrawingData } from '../src/core/drawing-data.js'

const kind = flowchart()

function parsed(source: string): DiagramParse<DrawingData> {
  const result = kind.parse(source)
  if ('error' in result) throw new Error(`flowchart parse error: ${result.error}`)
  return result
}

const accepts = (text: string): Promise<unknown> => mermaid.parse(text, { suppressErrors: false })
const invalidCodes = (result: DiagramParse<DrawingData>): string[] => result.problems.filter((p) => p.severity === 'invalid').map((p) => p.code)

/** Mermaid accepts these; the kind reads them with no invalid problem, and the written output is accepted back and is a fixed point. */
const ACCEPTED: readonly [finding: string, source: string][] = [
  ['C0 pipe entity in an edge label', 'flowchart LR\n    A -->|a#124;b| B'],
  ['C0 semicolon entity in a node label', 'flowchart LR\n    A[a#59;b] --> B'],
  ['C0 semicolon in an edge label', 'flowchart LR\n    A -->|a;b| B'],
  ['C1 out-of-range entity', 'flowchart LR\n    A["#9999999999;"] --> B'],
  ['C6 out-of-range entity in a config label', 'flowchart LR\n    A@{ label: "#9999999;" }'],
  ['C22 control-character entities', 'flowchart LR\n    A["#1;#0;"] --> B'],
  ['C3 quoted title with a colon', '---\ntitle: "a: b"\n---\nflowchart LR\n    A --> B'],
  ['C8 quoted title with brackets', '---\ntitle: "[draft] flow"\n---\nflowchart LR\n    A --> B'],
  ['C7 entity-like text', 'flowchart LR\n    A["PR #35;42; merged #38;quot; #37;#37;{"] --> B'],
  ['C11 style before its node', 'flowchart LR\n    style A fill:#f9f\n    A --> B'],
  ['C16 style for a node that never appears', 'flowchart LR\n    A --> B\n    style X fill:#f00'],
  ['C11 style with an id list', 'flowchart LR\n    A --> B\n    style A,B fill:#f00'],
  ['C12 Cyrillic ids', 'flowchart TD\n    Пользователь --> Сервер'],
  ['C12 dotted id', 'flowchart TD\n    api.gateway --> db'],
  ['C12 underscore, dash, dot and colon ids', 'flowchart TD\n    svc_1 --> svc-2 --> svc.3 --> svc:4'],
  ['C13 space label', 'flowchart TD\n    A[ ] --> B'],
  ['C13 dash label with parentheses', 'flowchart TD\n    A -- ok (200) --> B'],
  ['C14 quoted label spanning lines', 'flowchart TD\n    A["First line\n    second line"] --> B'],
  ['C14 markdown string', 'flowchart LR\n    A["`**Bold** text`"] --> B'],
  ['C14 markdown string spanning lines with an edge label', 'flowchart LR\n    A("`The **cat**\n    in the _hat_`") -- "`edge *label*`" --> B'],
  ['C18 top-level direction before the first node', 'flowchart LR\n    direction TB\n    A --> B'],
  ['C23 top-level direction after a node', 'flowchart LR\n    A --> B\n    direction TB'],
  ['C24 End and END as ids', 'flowchart TD\n    start --> End --> END --> endpoint'],
  ['C24 direction and default as ids', 'flowchart TD\n    A --> direction --> default'],
  ['C25 quoted edge label holding --', 'flowchart LR\n    A -- "x -- y" --> C'],
  ['C25 quoted edge label holding |', 'flowchart LR\n    A -->|"a | b"| B'],
]

/** Mermaid rejects these; the kind reports the code named, and where the statement is still modelled the written output is valid. */
const REJECTED: readonly [finding: string, source: string, code: string, writtenIsValid: boolean][] = [
  ['C13 parentheses in a bracket label', 'flowchart TD\n    A[Compute f(x)] --> B', 'FLOWCHART_LABEL_NEEDS_QUOTES', true],
  ['C13 braces in a bracket label', 'flowchart TD\n    A[Set {x}] --> B', 'FLOWCHART_LABEL_NEEDS_QUOTES', true],
  ['C13 quotes in a bracket label', 'flowchart TD\n    A[say "hi"] --> B', 'FLOWCHART_LABEL_NEEDS_QUOTES', true],
  ['C13 pipe in a bracket label', 'flowchart TD\n    A[a | b] --> B', 'FLOWCHART_LABEL_NEEDS_QUOTES', true],
  ['C13 parentheses in a pipe label', 'flowchart TD\n    A -->|ok (200)| B', 'FLOWCHART_LABEL_NEEDS_QUOTES', true],
  ['C13 brackets in a pipe label', 'flowchart TD\n    A -->|a [b]| B', 'FLOWCHART_LABEL_NEEDS_QUOTES', true],
  ['C13 quote in a dash label', 'flowchart TD\n    A -- say "hi" --> B', 'FLOWCHART_LABEL_NEEDS_QUOTES', true],
  ['C13 empty bracket label', 'flowchart TD\n    A[] --> B', 'FLOWCHART_LABEL_EMPTY', true],
  ['C13 empty quoted label', 'flowchart TD\n    A[""] --> B', 'FLOWCHART_LABEL_EMPTY', true],
  ['C13 empty pipe label', 'flowchart TD\n    A -->|| B', 'FLOWCHART_LABEL_EMPTY', true],
  ['C13 trailing comment after a statement', 'flowchart TD\n    A --> B %% comment', 'FLOWCHART_TRAILING_COMMENT', true],
  ['C13 trailing comment after the header', 'flowchart TD %% main\n    A --> B', 'FLOWCHART_TRAILING_COMMENT', true],
  ['C17 trailing annotation comment', 'flowchart LR\n    A --> B %% rmk-layout v1 {"canvasHeight":200}', 'FLOWCHART_TRAILING_COMMENT', true],
  ['C24 end as a node id', 'flowchart TD\n    start --> end', 'FLOWCHART_RESERVED_ID', false],
  ['C24 graph as a node id', 'flowchart TD\n    A --> graph', 'FLOWCHART_RESERVED_ID', false],
  ['C24 style as a node id', 'flowchart TD\n    A --> style', 'FLOWCHART_RESERVED_ID', false],
  ['C24 click as a node id', 'flowchart TD\n    A --> click', 'FLOWCHART_RESERVED_ID', false],
  ['C15 end without a subgraph', 'flowchart LR\n    A --> B\n    end', 'FLOWCHART_UNKNOWN_STATEMENT', false],
  ['C18 lowercase direction', 'flowchart LR\n    direction tb\n    A --> B', 'FLOWCHART_UNKNOWN_STATEMENT', false],
  ['C9 unclosed config', 'flowchart LR\n    A --> B\n    A@{ shape: rect', 'FLOWCHART_UNKNOWN_STATEMENT', false],
  ['C11 style without properties', 'flowchart LR\n    A --> B\n    style A', 'FLOWCHART_UNKNOWN_STATEMENT', false],
]

describe('flowchart kind against Mermaid.js', () => {
  describe('accepted by Mermaid: no invalid problem, written output accepted and a fixed point', () => {
    for (const [finding, source] of ACCEPTED) {
      it(finding, async () => {
        await expect(accepts(source)).resolves.toBeTruthy()
        const first = parsed(source)
        expect(invalidCodes(first)).toEqual([])
        const written = kind.write!(first.model, { retained: first.retained })
        await expect(accepts(written)).resolves.toBeTruthy()
        const second = parsed(written)
        expect(second.model).toEqual(first.model)
        expect(invalidCodes(second)).toEqual([])
        expect(kind.write!(second.model, { retained: second.retained })).toBe(written)
        expect(written.split('\n').filter((line) => line.includes('%% rmk-layout'))).toHaveLength(1)
      })
    }
  })

  describe('rejected by Mermaid: the named invalid problem', () => {
    for (const [finding, source, code, writtenIsValid] of REJECTED) {
      it(finding, async () => {
        await expect(accepts(source)).rejects.toBeTruthy()
        const result = parsed(source)
        expect(invalidCodes(result)).toContain(code)
        if (writtenIsValid) {
          const written = kind.write!(result.model, { retained: result.retained })
          await expect(accepts(written)).resolves.toBeTruthy()
          expect(invalidCodes(parsed(written))).toEqual([])
        }
      })
    }
  })

  it('C28: a wrong-case direction is rejected by Mermaid and named as the cause here', async () => {
    await expect(accepts('graph td\n    A --> B')).rejects.toBeTruthy()
    expect(kind.parse('graph td\n    A --> B')).toEqual({
      error: 'Unknown direction "td" after "graph"; Mermaid directions are TB, TD, BT, LR, RL (case-sensitive).',
      line: 1,
    })
  })

  it('C3, C8: a title from a legacy payload or the canvas is written as YAML Mermaid accepts', async () => {
    for (const title of ['Login: happy path', '[draft] plan', '*', 'C# service # comment', 'say "hi"', "it's"]) {
      const written = kind.write!({ version: 3, canvasHeight: 154, title, shapes: [] }, { retained: [] })
      await expect(accepts(written)).resolves.toBeTruthy()
      expect(parsed(written).model.title).toBe(title)
    }
  })

  it('C0, C7: canvas text with |, ;, # and % is written as Mermaid accepts and read back unchanged', async () => {
    const box = (id: string, x: number, text: string): DrawingData['shapes'][number] => ({ id, type: 'rect', x, y: 32, width: 160, height: 90, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2, text })
    const model: DrawingData = {
      version: 3,
      canvasHeight: 154,
      shapes: [
        box('A', 32, 'PR #42; merged'),
        box('B', 282, 'Bug #123; fixed 100% &quot;'),
        { id: 'c3', type: 'arrow', x: 198, y: 77, width: 78, height: 0, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2, text: 'a|b; c #124;', startBinding: { id: 'A' }, endBinding: { id: 'B' } },
      ],
    }
    const written = kind.write!(model, { retained: [] })
    await expect(accepts(written)).resolves.toBeTruthy()
    const back = parsed(written)
    expect(back.problems).toEqual([])
    expect(back.model).toEqual(model)
    expect(kind.write!(back.model, { retained: back.retained })).toBe(written)
  })
})
