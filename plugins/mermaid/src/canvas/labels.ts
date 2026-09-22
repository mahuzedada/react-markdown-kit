/**
 * Ported from @zuilib/text-editor (MIT). The diagram block's UI strings
 * (canvas, header row, source editor, notices), with defaults, overridable
 * through the editor's flat `labels` map under `diagram.<key>` (functions
 * keep their defaults).
 */
import { useMemo } from 'react'
import { useLexicalEditor } from '@react-markdown-kit/editor/lexical'

export interface DiagramLabels {
  /** `aria-label` of a canvas without a title */
  readonly canvas: string
  readonly tools: string
  readonly select: string
  readonly rect: string
  readonly ellipse: string
  readonly diamond: string
  readonly arrow: string
  readonly line: string
  readonly text: string
  readonly note: string
  readonly cylinder: string
  readonly cloud: string
  readonly queue: string
  readonly actor: string
  readonly moreShapes: string
  readonly copyMermaid: string
  readonly copiedMermaid: string
  /** `aria-label` of the swatch group */
  readonly colors: string
  readonly color: (name: string) => string
  readonly connectorRouting: string
  readonly straight: string
  readonly elbow: string
  readonly arrowDirection: string
  readonly oneWay: string
  readonly twoWay: string
  readonly deleteShape: string
  readonly deleteShapes: (count: number) => string
  readonly resize: string
  readonly waypoint: string
  readonly addWaypoint: string
  readonly elbowHandle: string
  readonly labelPlaceholder: string
  readonly textPlaceholder: string
  readonly footerPlaceholder: string
  /** Hint shown on an editable, empty canvas */
  readonly empty: string
  readonly layoutCompact: string
  readonly layoutComfortable: string
  readonly layoutFull: string
  /** `aria-label` of the block's header row */
  readonly header: string
  /** Kind label shown when the source starts with no Mermaid keyword */
  readonly unknownKind: string
  /** Support badge: a registered kind renders the block */
  readonly staticBadge: string
  /** Support badge: the block is shown as source */
  readonly sourceBadge: string
  /** Header toggle: edit the flowchart on the canvas */
  readonly canvasMode: string
  /** Header toggle: edit the flowchart as text */
  readonly textMode: string
  /** Lead-in of the notice listing what a canvas edit cannot keep */
  readonly lossyNotice: string
  readonly editOnCanvas: string
  readonly editAsText: string
  /** `aria-label` of the source textarea */
  readonly source: string
  /** `aria-label` of the live preview */
  readonly preview: string
  /** `aria-label` of the problems list */
  readonly problems: string
  /** Prefix of a problem Mermaid.js itself would reject */
  readonly rejects: string
  readonly problemLine: (line: number) => string
  /** Notice for a kind that is shown as source */
  readonly unsupported: (label: string) => string
  /** Notice for a block whose leading word is no Mermaid keyword */
  readonly notMermaid: string
  /** Case-slip hint, with the expected spelling */
  readonly keywordHint: (keyword: string) => string
}

/** Keys of `DiagramLabels` whose value is a plain string. */
export type DiagramLabelKey = {
  [K in keyof DiagramLabels]: DiagramLabels[K] extends string ? K : never
}[keyof DiagramLabels]

export const DIAGRAM_LABELS: DiagramLabels = {
  canvas: 'Drawing',
  tools: 'Drawing tools',
  select: 'Select',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  diamond: 'Diamond',
  arrow: 'Arrow',
  line: 'Line',
  text: 'Text',
  note: 'Note',
  cylinder: 'Database',
  cloud: 'Cloud',
  queue: 'Queue',
  actor: 'Actor',
  moreShapes: 'More shapes',
  copyMermaid: 'Copy as Mermaid',
  copiedMermaid: 'Copied Mermaid to clipboard',
  colors: 'Color',
  color: (name) => `Color ${name}`,
  connectorRouting: 'Connector routing',
  straight: 'Straight connector',
  elbow: 'Elbow connector (auto-routed)',
  arrowDirection: 'Arrow direction',
  oneWay: 'One-way arrow',
  twoWay: 'Two-way arrow',
  deleteShape: 'Delete shape',
  deleteShapes: (count) => `Delete ${count} shapes`,
  resize: 'Drag to resize the canvas',
  waypoint: 'Drag to move, double-click to remove',
  addWaypoint: 'Drag to add a bend',
  elbowHandle: 'Slide the middle segment',
  labelPlaceholder: 'Label',
  textPlaceholder: 'Text',
  footerPlaceholder: 'Footer',
  empty: 'Pick a shape above, then click or drag on the canvas',
  layoutCompact: 'Compact (shrink to content)',
  layoutComfortable: 'Comfortable (text width)',
  layoutFull: 'Full width',
  header: 'Diagram block',
  unknownKind: 'Not Mermaid',
  staticBadge: 'Static',
  sourceBadge: 'Source only',
  canvasMode: 'Canvas',
  textMode: 'Text',
  lossyNotice: 'Editing on the canvas cannot keep:',
  editOnCanvas: 'Edit on canvas',
  editAsText: 'Edit as text',
  source: 'Diagram source',
  preview: 'Preview',
  problems: 'Problems',
  rejects: 'Mermaid rejects:',
  problemLine: (line) => `Line ${line}`,
  unsupported: (label) => `${label} diagrams are shown as source.`,
  notMermaid: 'The block does not start with a Mermaid diagram keyword.',
  keywordHint: (keyword) => `Mermaid keywords are case-sensitive; expected \`${keyword}\`.`,
}

/** Prefix of the canvas's keys in the editor's flat `labels` map. */
export const DIAGRAM_LABEL_PREFIX = 'diagram.'

/** `DIAGRAM_LABELS` with every `diagram.<key>` string in `labels` applied. */
export function resolveDiagramLabels(
  labels: Readonly<Partial<Record<string, string>>> | undefined,
): DiagramLabels {
  if (labels === undefined) return DIAGRAM_LABELS
  const out: Record<string, unknown> = { ...DIAGRAM_LABELS }
  for (const key of Object.keys(DIAGRAM_LABELS)) {
    if (typeof out[key] !== 'string') continue
    const override = labels[`${DIAGRAM_LABEL_PREFIX}${key}`]
    if (typeof override === 'string') out[key] = override
  }
  return out as unknown as DiagramLabels
}

export function useDiagramLabels(): DiagramLabels {
  const { labels } = useLexicalEditor()
  return useMemo(() => resolveDiagramLabels(labels), [labels])
}
