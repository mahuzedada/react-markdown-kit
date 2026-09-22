/**
 * Which diagram kind a fence body declares (docs/MERMAID_PLATFORM.md
 * section 3). Mirrors Mermaid's `detectType`: front matter, `%%{ … }%%`
 * directives and `%%` comment lines are skipped, and the first word of what
 * remains decides. Registered kinds are tried first, in registry order, then
 * the keywords Mermaid itself knows, so a `classDiagram` fence is named even
 * though nothing here renders it. Matching is case-sensitive like Mermaid's;
 * a case slip is reported as a hint with the expected spelling instead of
 * being guessed, because Mermaid.js would reject the fence.
 */
import { splitFrontMatter } from './front-matter.js'
import type { DiagramKind } from './kind.js'

/** Mermaid diagram keywords no built-in kind renders. Detection names them, support level `source`. */
export const MERMAID_KEYWORDS: readonly string[] = [
  'classDiagram',
  'classDiagram-v2',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'quadrantChart',
  'requirementDiagram',
  'requirement',
  'gitGraph',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
  'mindmap',
  'timeline',
  'zenuml',
  'sankey-beta',
  'sankey',
  'xychart-beta',
  'xychart',
  'block-beta',
  'block',
  'packet-beta',
  'packet',
  'kanban',
  'architecture-beta',
  'architecture',
  'radar-beta',
  'treemap-beta',
  'treemap',
  'info',
]

export interface DiagramDetection {
  /** Kind name, a `MERMAID_KEYWORDS` entry, or 'unknown'. */
  readonly kind: string
  readonly support: 'static' | 'source'
  /** The registered kind that matched, when one did. */
  readonly registered?: DiagramKind
  /** The correct spelling when the word matched a keyword case-insensitively only. */
  readonly hint?: string
}

/** A `%%{ … }%%` directive, closed or running to the end of the text as in Mermaid. */
const DIRECTIVE = /%%\{(?:(?!\}%%)[\s\S])*(?:\}%%)?/g
/** A line that is a `%%` comment. */
const COMMENT_LINE = /^[^\S\r\n]*%%.*(?:\r?\n|$)/gm
const LEADING_WORD = /^\s*([A-Za-z][A-Za-z0-9-]*)/

export function detectDiagramKind(source: string, kinds: readonly DiagramKind[]): DiagramDetection {
  const { body } = splitFrontMatter(source)
  const stripped = body.replace(DIRECTIVE, '').replace(COMMENT_LINE, '')
  const word = LEADING_WORD.exec(stripped)?.[1]
  if (word === undefined) return { kind: 'unknown', support: 'source' }

  const registered = kinds.find((kind) => kind.keywords.some((keyword) => matchesKeyword(word, keyword)))
  if (registered !== undefined) {
    return { kind: registered.name, support: registered.render === undefined ? 'source' : 'static', registered }
  }
  if (MERMAID_KEYWORDS.includes(word)) return { kind: word, support: 'source' }

  const hint = spellingHint(word, kinds)
  return hint === undefined ? { kind: 'unknown', support: 'source' } : { kind: 'unknown', support: 'source', hint }
}

/** `flowchart` matches `flowchart` and `flowchart-elk`, never `flowchartX` or `flowchart-`. */
function matchesKeyword(word: string, keyword: string): boolean {
  return word === keyword || (word.startsWith(`${keyword}-`) && word.length > keyword.length + 1)
}

function spellingHint(word: string, kinds: readonly DiagramKind[]): string | undefined {
  const lower = word.toLowerCase()
  const candidates = [...kinds.flatMap((kind) => kind.keywords), ...MERMAID_KEYWORDS]
  return candidates.find((keyword) => keyword.toLowerCase() === lower)
}
