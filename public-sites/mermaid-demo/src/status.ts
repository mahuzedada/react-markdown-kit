import type { MarkdownDocument } from '@react-markdown-kit/renderer'
import type { DiagramKind, DiagramNode } from '@react-markdown-kit/mermaid'

/*
 * The status chip in the code card's head, read from the lifted `diagram`
 * node rather than from the diagnostics alone: which kind the plugin
 * detected, whether it renders it, and the first thing Mermaid itself would
 * reject. Pure, so the labels are pinned by tests/mermaid-demo.dom.test.tsx.
 */

export interface DiagramStatus {
  /** `ok` is green, `warn` amber. */
  readonly tone: 'ok' | 'warn'
  readonly label: string
  /** Shown under the code pane when there is something to say. */
  readonly message?: string | undefined
  /** The detected kind, for the code pane's keyword set. */
  readonly kind: string
}

/** Human labels for the Mermaid types no built-in kind renders; the kind name itself otherwise. */
const KEYWORD_LABELS: Readonly<Record<string, string>> = {
  classDiagram: 'Class diagram',
  'classDiagram-v2': 'Class diagram',
  stateDiagram: 'State diagram',
  'stateDiagram-v2': 'State diagram',
  erDiagram: 'ER diagram',
  journey: 'User journey',
  gantt: 'Gantt chart',
  pie: 'Pie chart',
  quadrantChart: 'Quadrant chart',
  requirementDiagram: 'Requirement diagram',
  requirement: 'Requirement diagram',
  gitGraph: 'Git graph',
  C4Context: 'C4 context',
  C4Container: 'C4 container',
  C4Component: 'C4 component',
  C4Dynamic: 'C4 dynamic',
  C4Deployment: 'C4 deployment',
  mindmap: 'Mind map',
  timeline: 'Timeline',
  zenuml: 'ZenUML',
  'sankey-beta': 'Sankey',
  sankey: 'Sankey',
  'xychart-beta': 'XY chart',
  xychart: 'XY chart',
  'block-beta': 'Block diagram',
  block: 'Block diagram',
  'packet-beta': 'Packet diagram',
  packet: 'Packet diagram',
  kanban: 'Kanban',
  'architecture-beta': 'Architecture',
  architecture: 'Architecture',
  'radar-beta': 'Radar chart',
  'treemap-beta': 'Treemap',
  treemap: 'Treemap',
  info: 'Info',
}

/** The registered kind's label, else the Mermaid type's, else the name as written. */
export function kindLabel(kind: string, kinds: readonly DiagramKind[]): string {
  return kinds.find((candidate) => candidate.name === kind)?.label ?? KEYWORD_LABELS[kind] ?? kind
}

const isDiagram = (node: { readonly type: string } | undefined): node is DiagramNode => node?.type === 'diagram'

const LAYOUT_LINE = /^\s*%%\s+rmk-layout\s/m

export function diagramStatus(document: MarkdownDocument, kinds: readonly DiagramKind[]): DiagramStatus {
  const node = document.tree.children?.[0]
  const find = (code: string): string | undefined => document.diagnostics.find((diagnostic) => diagnostic.code === code)?.message
  if (!isDiagram(node)) return { tone: 'warn', label: 'Not Mermaid', message: find('DIAGRAM_KIND_UNKNOWN'), kind: 'unknown' }
  const { kind } = node
  if (kind === 'unknown') return { tone: 'warn', label: 'Not Mermaid', message: find('DIAGRAM_KIND_UNKNOWN'), kind }
  const label = kindLabel(kind, kinds)
  const invalid = find('DIAGRAM_INVALID')
  if (invalid !== undefined) return { tone: 'warn', label: 'Syntax error', message: invalid, kind }
  const rejected = node.problems?.find((problem) => problem.severity === 'invalid' && problem.code !== 'FLOWCHART_LAYOUT_INVALID')
  if (rejected !== undefined) {
    const where = rejected.line === undefined ? '' : ` line ${rejected.line}`
    return { tone: 'warn', label: `Mermaid rejects${where}`, message: rejected.message, kind }
  }
  const layoutInvalid = find('DIAGRAM_LAYOUT_INVALID')
  if (layoutInvalid !== undefined) return { tone: 'warn', label: 'Layout rejected', message: layoutInvalid, kind }
  if (node.support === 'source') return { tone: 'warn', label: `${label} · source only`, message: find('DIAGRAM_KIND_UNSUPPORTED'), kind }
  if (kind === 'flowchart') return { tone: 'ok', label: LAYOUT_LINE.test(node.value) ? 'Flowchart · rmk-layout v1' : 'Flowchart · auto layout', kind }
  return { tone: 'ok', label: `${label} · static`, kind }
}
