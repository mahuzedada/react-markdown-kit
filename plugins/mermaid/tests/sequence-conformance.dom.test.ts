/**
 * The sequence parser's severities against Mermaid.js itself
 * (docs/MERMAID_PLATFORM.md section 4.1): a problem is `invalid` only when
 * Mermaid.js rejects the fence, and a fence Mermaid.js accepts never gets
 * one. Every input here is the exact repro of a review finding (C2, C10,
 * C19, C26, C27, C29) or a boundary the fix relies on, run through
 * `mermaid.parse` (the root devDependency) and through the kind's parser.
 * The corpus covers the accepted documentation examples; this file holds
 * the rejected inputs and the accepted edge cases that are not examples.
 *
 * Runs under jsdom by its `.dom.test` name; `mermaid.parse` only lexes and
 * parses and needs no `initialize`.
 */
import mermaid from 'mermaid'
import { describe, expect, it } from 'vitest'
import { sequenceDiagram } from '../src/core/sequence/index.js'

const kind = sequenceDiagram()

/** Invalid problem codes, with line, for a source the kind must parse without error. */
function invalid(source: string): string[] {
  const parsed = kind.parse(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.problems.filter((p) => p.severity === 'invalid').map((p) => `${p.code}@${p.line}`)
}

const accepted: Record<string, string> = {
  'C2: multi-line directive before the header': '%%{\n  init: { "theme": "dark" }\n}%%\nsequenceDiagram\n    A->>B: hi',
  'C2: multi-line directive after the header': 'sequenceDiagram\n%%{\n  init: { "theme": "dark" }\n}%%\n    A->>B: hi',
  'C2: indented multi-line directive after the header': 'sequenceDiagram\n    %%{\n      init: { "theme": "dark" }\n    }%%\n    A->>B: hi',
  'C2: unclosed directive after the header runs to the end': 'sequenceDiagram\n    A->>B: hi\n%%{\n  init: { "theme": "dark" }',
  'C10: comment after the header': 'sequenceDiagram %% login\n    A->>B: x',
  'C10: comment after a ;': 'sequenceDiagram; %% c\n    A->>B: x; %% d\n    loop l\n    end %% e',
  'C10: %% inside message text': 'sequenceDiagram\n    A->>B: hi %% c',
  'C27: header and first statement on one line': 'sequenceDiagram A->>B: hi',
  'C27: header and a participant on one line': 'sequenceDiagram participant A',
  'C19: parentheses in the from actor': 'sequenceDiagram\n    A(1)->>B: hi',
  'C19: parentheses in the to actor': 'sequenceDiagram\n    A->>B(2): hi',
  'C19: parentheses with activation shorthand': 'sequenceDiagram\n    A(1)->>+B(2): hi\n    B(2)-->>-A(1): yo',
  'C26: reserved id declared but never used in a message': 'sequenceDiagram\n    participant end as Endpoint',
  'C26: reserved ids in activate and box declarations': 'sequenceDiagram\n    participant end\n    actor loop\n    activate end\n    deactivate end\n    box G\n    participant note\n    end',
  'C26: keyword prefixes and title without a following space': 'sequenceDiagram\n    A->>endpoint: x\n    A->>title:x\n    title->>B: x\n    A->>as: x\n    A->>left: x\n    A->>wrap: x\n    Andy->>Office: x\n    accTitle->>B: x',
}

const rejected: Record<string, { source: string; problems: string[] }> = {
  'C27: header without a word boundary': { source: 'sequenceDiagramA->>B: hi', problems: ['error'] },
  'C19: to starting with (': { source: 'sequenceDiagram\n    A->>(B): hi', problems: ['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@2'] },
  'C26: end declared and used': { source: 'sequenceDiagram\n    participant end as Endpoint\n    A->>end: hi', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@3'] },
  'C26: loop declared and used': { source: 'sequenceDiagram\n    participant loop as Loop Service\n    A->>loop: x', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@3'] },
  'C26: Note as the from actor': { source: 'sequenceDiagram\n    Note->>A: x', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@2'] },
  'C26: end as the from actor': { source: 'sequenceDiagram\n    end->>A: x', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@2'] },
  'C26: keyword case and word boundary': { source: 'sequenceDiagram\n    A->>End: x', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@2'] },
  'C26: keyword followed by a space': { source: 'sequenceDiagram\n    A->>end point: x', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@2'] },
  'C26: keyword followed by a hyphen': { source: 'sequenceDiagram\n    A->>end-point: x', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@2'] },
  'C26: title followed by colon and space': { source: 'sequenceDiagram\n    A->>title: x', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@2'] },
  'C26: note target': { source: 'sequenceDiagram\n    Note over end: x', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@2'] },
  'C26: second note target': { source: 'sequenceDiagram\n    Note over A, end: x', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@2'] },
  'C26: created participant used': { source: 'sequenceDiagram\n    A->>B: x\n    create participant end\n    B->>end: y', problems: ['SEQUENCE_DIAGRAM_RESERVED_ID@4'] },
  'C26: end with trailing text': { source: 'sequenceDiagram\n    loop x\n    end foo', problems: ['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@3'] },
  'C29: HTML entities split at ;': {
    source: 'sequenceDiagram\n    participant W as Workstation\n    participant F as \\\\fileserver\\share\n    W->>F: copy C:\\Users\\jdoe\\report.docx\n    F-->>W: &lt;done&gt; &amp; 100%',
    problems: ['SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT@5'],
  },
}

const KEYWORDS = ['end', 'loop', 'alt', 'else', 'opt', 'par', 'par_over', 'and', 'critical', 'option', 'break', 'rect', 'note', 'box', 'participant', 'actor', 'activate', 'deactivate', 'autonumber', 'links', 'link', 'properties', 'details', 'create', 'destroy', 'over', 'off', 'sequenceDiagram', 'accTitle', 'accDescr']

describe('sequenceDiagram severities against Mermaid.js', () => {
  for (const [name, source] of Object.entries(accepted)) {
    it(`${name}: Mermaid.js accepts it and the kind reports nothing invalid`, async () => {
      await expect(mermaid.parse(source, { suppressErrors: false })).resolves.toBeTruthy()
      expect(invalid(source)).toEqual([])
    })
  }

  for (const [name, { source, problems }] of Object.entries(rejected)) {
    it(`${name}: Mermaid.js rejects it and the kind reports it invalid`, async () => {
      await expect(mermaid.parse(source, { suppressErrors: false })).rejects.toThrow()
      if (problems[0] === 'error') expect(kind.parse(source)).toHaveProperty('error')
      else expect(invalid(source)).toEqual(problems)
    })
  }

  it('every reserved keyword as a message end: Mermaid.js rejects it and the kind reports SEQUENCE_DIAGRAM_RESERVED_ID', async () => {
    for (const keyword of KEYWORDS) {
      const source = `sequenceDiagram\n    A->>${keyword}: x`
      await expect(mermaid.parse(source, { suppressErrors: false }), keyword).rejects.toThrow()
      expect(invalid(source), keyword).toEqual(['SEQUENCE_DIAGRAM_RESERVED_ID@2'])
    }
  })
})
