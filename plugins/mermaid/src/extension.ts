/**
 * `mermaid()` — the headless extension.
 *
 * One object, four capabilities, no React and no Lexical:
 *
 *   syntax    a ```diagram or ```drawing fence becomes a `diagram` node with
 *             its payload parsed once, and serializes back to the same fence;
 *   renderer  the node becomes a <figure> holding a static SVG;
 *   template  the payload is literal, so `{{...}}` inside it is never data;
 *   editor    absent here. `@react-markdown-kit/editor/diagrams` adds the
 *             canvas, and only that entry needs Lexical.
 *
 * The fence formats are the ones `@zuilib/text-editor` writes, documented in
 * DRAWING_FORMAT.md, so a document moves between the two without change.
 */
import type { Element } from 'hast'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import { diagnostic, type MarkdownDiagnostic } from '@internal/diagnostics/index.js'
import { deserializeDrawingData, normalizeDrawingData, type DrawingData } from './core/drawing-data.js'
import { parseDrawingSkeleton } from './core/skeleton.js'
import { isMermaidFlowchart, parseMermaidFlowchart } from './core/mermaid-parse.js'
import type { LayoutProblem } from './core/layout-annotation.js'
import { renderDrawingSvg } from './svg/render.js'
import { h, text } from './svg/hast.js'

/** The mdast node type this extension introduces. */
export const DIAGRAM_NODE = 'diagram'

/** `mermaid` is what the editor writes; the two JSON fences are read for compatibility. */
export type DiagramFormat = 'mermaid' | 'diagram' | 'drawing'

export interface DiagramNode extends MarkdownNode {
  readonly type: typeof DIAGRAM_NODE
  /** Which fence it came from. Written back as the same fence. */
  readonly format: DiagramFormat
  /** The fence body, byte for byte. This is what serializes. */
  readonly value: string
  /** The rest of the fence info string, if any. */
  readonly meta?: string
  /** The parsed, normalized drawing. Absent when the payload did not parse. */
  readonly data?: DrawingData
  /** Why `data` is absent. */
  readonly error?: string
}

export interface MermaidPluginOptions {
  /** Accessible name for a drawing whose payload has no `title`. Default "Diagram". */
  readonly fallbackTitle?: string
}

const FORMATS: ReadonlySet<string> = new Set<DiagramFormat>(['mermaid', 'diagram', 'drawing'])

export function mermaid(options: MermaidPluginOptions = {}): MarkdownExtension {
  const fallbackTitle = options.fallbackTitle ?? 'Diagram'
  return {
    name: 'mermaid',
    version: '1',
    contractVersion: 1,
    capabilities: {
      syntax: {
        nodeTypes: [DIAGRAM_NODE],
        transform: (tree, { report }) => liftFences(tree, report),
        toMarkdownExtensions: [{ handlers: { [DIAGRAM_NODE]: toFence } }],
      },
      renderer: {
        handlers: {
          [DIAGRAM_NODE]: (_state: unknown, node: DiagramNode): Element => toFigure(node, fallbackTitle),
        },
      },
      template: { literalNodeTypes: [DIAGRAM_NODE] },
    },
  }
}

/* --------------------------------------------------------------- syntax */

export function isDiagramNode(node: MarkdownNode): node is DiagramNode {
  return node.type === DIAGRAM_NODE
}

/** Parses one fence body. A bad payload is reported, not thrown. */
export function parseDiagram(
  format: DiagramFormat,
  value: string,
): { data: DrawingData; layoutProblem?: LayoutProblem } | { error: string } {
  if (format === 'mermaid') return parseMermaidFlowchart(value)
  try {
    JSON.parse(value)
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : 'Invalid JSON' }
  }
  const data = format === 'diagram' ? parseDrawingSkeleton(value) : deserializeDrawingData(value)
  return { data: normalizeDrawingData(data) }
}

function liftFences(tree: MarkdownRoot, report: (d: MarkdownDiagnostic) => void): MarkdownRoot {
  const walk = (node: MarkdownNode): MarkdownNode => {
    if (node.type === 'code' && typeof node['lang'] === 'string' && FORMATS.has(node['lang'] as string)) {
      // Only a flowchart becomes a drawing. A sequence, class or Gantt
      // diagram stays an ordinary code block: rendered as source, edited as
      // text, never mistaken for something the canvas can open.
      const value = typeof node['value'] === 'string' ? (node['value'] as string) : ''
      if (node['lang'] === 'mermaid' && !isMermaidFlowchart(value)) return node
      return lift(node, node['lang'] as DiagramFormat, report)
    }
    if (node.children === undefined) return node
    return { ...node, children: node.children.map(walk) }
  }
  return { ...tree, children: (tree.children ?? []).map(walk) } as MarkdownRoot
}

function lift(code: MarkdownNode, format: DiagramFormat, report: (d: MarkdownDiagnostic) => void): DiagramNode {
  const value = typeof code['value'] === 'string' ? (code['value'] as string) : ''
  const parsed = parseDiagram(format, value)
  const range = code.position === undefined ? {} : { range: code.position }
  if ('error' in parsed) {
    report(diagnostic('DIAGRAM_INVALID', 'warning', `The ${format} block could not be read and is shown as source: ${parsed.error}`, range))
  } else if (parsed.layoutProblem !== undefined) {
    // The flowchart itself is fine; only its geometry was rejected, so the
    // diagram is auto-laid out and the reason is reported with its path.
    report(
      diagnostic('DIAGRAM_LAYOUT_INVALID', 'warning', `The layout annotation was ignored and the diagram auto-laid out: ${parsed.layoutProblem.message}`, {
        ...(parsed.layoutProblem.path === undefined || parsed.layoutProblem.path === '' ? {} : { path: parsed.layoutProblem.path }),
        ...range,
      }),
    )
  }
  return {
    type: DIAGRAM_NODE,
    format,
    value,
    ...(typeof code['meta'] === 'string' ? { meta: code['meta'] as string } : {}),
    ...(code.position === undefined ? {} : { position: code.position }),
    ...('error' in parsed ? { error: parsed.error } : { data: parsed.data }),
  }
}

/** The fence, with a run long enough that the body can never close it early. */
function toFence(node: DiagramNode): string {
  const longest = Math.max(0, ...[...node.value.matchAll(/`+/g)].map((match) => match[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  const info = node.meta === undefined ? node.format : `${node.format} ${node.meta}`
  return `${fence}${info}\n${node.value}\n${fence}`
}

/* -------------------------------------------------------------- renderer */

function toFigure(node: DiagramNode, fallbackTitle: string): Element {
  if (node.data === undefined) {
    return h('figure', { dataRmkDiagram: node.format, dataRmkDiagramError: node.error ?? 'invalid' }, [
      h('pre', {}, [h('code', { className: [`language-${node.format}`] }, [text(node.value)])]),
    ])
  }
  const svg = renderDrawingSvg(node.data, { fallbackTitle })
  const caption = node.data.title
  return h('figure', { dataRmkDiagram: node.format }, [
    svg,
    ...(caption === undefined ? [] : [h('figcaption', {}, [text(caption)])]),
  ])
}
