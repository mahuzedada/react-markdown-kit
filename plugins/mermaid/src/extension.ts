/**
 * `mermaid()`: the headless extension.
 *
 * One object, four capabilities, no React and no Lexical:
 *
 *   syntax    every ```mermaid fence, and the legacy ```diagram and
 *             ```drawing fences, becomes one `diagram` node whose kind a
 *             registered `DiagramKind` parsed once; it serializes back to
 *             the same fence byte for byte;
 *   renderer  the node becomes a <figure> holding a static SVG when a kind
 *             renders it, or the source when none does;
 *   template  the payload is literal, so `{{...}}` inside it is never data;
 *   editor    absent here. The `/editor` entry adds the canvas and the
 *             source editor, and only that entry needs Lexical.
 *
 * Kinds are configuration values (docs/MERMAID_PLATFORM.md section 4.2):
 * `mermaid({ kinds })` takes the ordered list, `defaultKinds()` is what the
 * package ships. A fence no kind renders is still lifted, named by
 * detection and shown as source, never left as a code block, so a host can
 * pick it up through the `/client` fallback.
 */
import type { Element } from 'hast'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import type { MarkdownDiagnostic, SourceRange } from '@internal/diagnostics/index.js'
import { deserializeDrawingData, normalizeDrawingData, type DrawingData } from './core/drawing-data.js'
import { parseDrawingSkeleton } from './core/skeleton.js'
import { detectDiagramKind } from './core/detect.js'
import { defaultKinds, validateKinds } from './core/kinds.js'
import type { DiagramKind, DiagramParse, DiagramParseError, DiagramProblem, RetainedLine } from './core/kind.js'
import { diagramDiagnostic } from './diagnostics.js'
import { h, text } from './svg/hast.js'

/** The mdast node type this extension introduces. */
export const DIAGRAM_NODE = 'diagram'

/** `mermaid` is what the editor writes; the two JSON fences are read for compatibility. */
export type DiagramFormat = 'mermaid' | 'diagram' | 'drawing'

/** `static` when a registered kind renders the fence; `source` otherwise. */
export type DiagramSupport = 'static' | 'source'

export interface DiagramNode extends MarkdownNode {
  readonly type: typeof DIAGRAM_NODE
  /** Fence: 'mermaid', or the legacy JSON fences 'diagram' and 'drawing'. */
  readonly format: DiagramFormat
  /** Kind name from detection; 'flowchart' for the legacy fences; 'unknown' when undetected. */
  readonly kind: string
  readonly support: DiagramSupport
  /** Fence body, byte for byte. This is what serializes. */
  readonly value: string
  /** The rest of the fence info string, if any. */
  readonly meta?: string
  /** The kind's parsed model. Absent when the fence did not parse or no kind reads it. */
  readonly model?: unknown
  /** Why `model` is absent although a kind read the fence. */
  readonly error?: string
  readonly problems?: readonly DiagramProblem[]
  readonly retained?: readonly RetainedLine[]
  readonly lossy?: readonly string[]
}

export interface MermaidPluginOptions {
  /** Accessible name for a diagram whose model has no `title`. Default "Diagram". */
  readonly fallbackTitle?: string
  /** Diagram kinds in detection order. Default `[flowchart(), sequenceDiagram()]`. */
  readonly kinds?: readonly DiagramKind[]
}

const FORMATS: ReadonlySet<string> = new Set<DiagramFormat>(['mermaid', 'diagram', 'drawing'])
/** Per-problem diagnostics stop here so one fence cannot flood a document's list. */
const PROBLEM_DIAGNOSTICS_LIMIT = 20

export function mermaid(options: MermaidPluginOptions = {}): MarkdownExtension {
  const fallbackTitle = options.fallbackTitle ?? 'Diagram'
  const kinds = options.kinds ?? defaultKinds()
  validateKinds(kinds)
  return {
    name: 'mermaid',
    version: '1',
    contractVersion: 1,
    capabilities: {
      syntax: {
        nodeTypes: [DIAGRAM_NODE],
        transform: (tree, { report }) => liftFences(tree, kinds, report),
        toMarkdownExtensions: [{ handlers: { [DIAGRAM_NODE]: toFence } }],
      },
      renderer: {
        handlers: {
          [DIAGRAM_NODE]: (_state: unknown, node: DiagramNode): Element => toFigure(node, kinds, fallbackTitle),
        },
      },
      template: { literalNodeTypes: [DIAGRAM_NODE] },
    },
  }
}

/* --------------------------------------------------------------- parsing */

export function isDiagramNode(node: MarkdownNode): node is DiagramNode {
  return node.type === DIAGRAM_NODE
}

export type DiagramSourceParse = DiagramParse<unknown> | DiagramParseError

/**
 * Last parses, keyed by registry, then by kind and source. The syntax
 * transform and the editor's block both parse the same fence, so the second
 * one is free. Bounded so a long editing session does not keep every
 * intermediate model alive.
 */
const PARSE_CACHE_LIMIT = 64
const parseCaches = new WeakMap<readonly DiagramKind[], Map<string, DiagramSourceParse>>()

/** The registered kind's parse of `source`, memoised on `(kinds, kind, source)`. Undefined when no kind is named `kind`. */
export function parseDiagramSource(kinds: readonly DiagramKind[], kind: string, source: string): DiagramSourceParse | undefined {
  const registered = kinds.find((candidate) => candidate.name === kind)
  if (registered === undefined) return undefined
  let cache = parseCaches.get(kinds)
  if (cache === undefined) {
    cache = new Map()
    parseCaches.set(kinds, cache)
  }
  const key = `${kind}\n${source}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const parsed = safeParse(registered, source)
  if (cache.size >= PARSE_CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, parsed)
  return parsed
}

/** A kind's `parse` must not throw; one that does is treated as a parse error rather than breaking the document. */
function safeParse(kind: DiagramKind, source: string): DiagramSourceParse {
  try {
    return kind.parse(source)
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) }
  }
}

/** Builds the node for one fence body: detection, then the kind's parse. The syntax transform and the editor's block adapter both use it. */
export function diagramNodeFrom(
  value: string,
  format: DiagramFormat,
  kinds: readonly DiagramKind[],
  extra: { readonly meta?: string; readonly position?: MarkdownNode['position'] } = {},
): DiagramNode {
  const base = {
    type: DIAGRAM_NODE,
    format,
    value,
    ...(extra.meta === undefined ? {} : { meta: extra.meta }),
    ...(extra.position === undefined ? {} : { position: extra.position }),
  } as const
  if (format === 'mermaid') {
    const detected = detectDiagramKind(value, kinds)
    if (detected.registered === undefined) return { ...base, kind: detected.kind, support: 'source' }
    const parsed = parseDiagramSource(kinds, detected.kind, value) ?? { error: 'The kind did not parse the fence.' }
    if ('error' in parsed) return { ...base, kind: detected.kind, support: detected.support, error: parsed.error }
    return {
      ...base,
      kind: detected.kind,
      support: detected.support,
      model: parsed.model,
      problems: parsed.problems,
      retained: parsed.retained,
      lossy: parsed.lossy,
    }
  }
  // The legacy JSON fences are flowchart models; the flowchart kind renders them.
  const flowchart = kinds.find((kind) => kind.name === 'flowchart')
  const support: DiagramSupport = flowchart?.render === undefined ? 'source' : 'static'
  const parsed = parseLegacy(format, value)
  if ('error' in parsed) return { ...base, kind: 'flowchart', support, error: parsed.error }
  return { ...base, kind: 'flowchart', support, model: parsed.model }
}

function parseLegacy(format: 'diagram' | 'drawing', value: string): { model: DrawingData } | { error: string } {
  try {
    JSON.parse(value)
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : 'Invalid JSON' }
  }
  const data = format === 'diagram' ? parseDrawingSkeleton(value) : deserializeDrawingData(value)
  return { model: normalizeDrawingData(data) }
}

/* ---------------------------------------------------------------- syntax */

function liftFences(tree: MarkdownRoot, kinds: readonly DiagramKind[], report: (d: MarkdownDiagnostic) => void): MarkdownRoot {
  const walk = (node: MarkdownNode): MarkdownNode => {
    if (node.type === 'code' && typeof node['lang'] === 'string' && FORMATS.has(node['lang'] as string)) {
      return lift(node, node['lang'] as DiagramFormat, kinds, report)
    }
    if (node.children === undefined) return node
    return { ...node, children: node.children.map(walk) }
  }
  return { ...tree, children: (tree.children ?? []).map(walk) } as MarkdownRoot
}

function lift(code: MarkdownNode, format: DiagramFormat, kinds: readonly DiagramKind[], report: (d: MarkdownDiagnostic) => void): DiagramNode {
  const value = typeof code['value'] === 'string' ? (code['value'] as string) : ''
  const node = diagramNodeFrom(value, format, kinds, {
    ...(typeof code['meta'] === 'string' ? { meta: code['meta'] as string } : {}),
    ...(code.position === undefined ? {} : { position: code.position }),
  })
  reportDiagnostics(node, kinds, report)
  return node
}

/** The section 5 table: kind and support first, then the parse error, then one diagnostic per problem, narrowed to its line. */
function reportDiagnostics(node: DiagramNode, kinds: readonly DiagramKind[], report: (d: MarkdownDiagnostic) => void): void {
  const whole = node.position
  if (node.format === 'mermaid') {
    if (node.kind === 'unknown') {
      const { hint } = detectDiagramKind(node.value, kinds)
      report(diagramDiagnostic('DIAGRAM_KIND_UNKNOWN', whole, hint === undefined ? {} : { hint }))
    } else if (node.support === 'source') {
      report(diagramDiagnostic('DIAGRAM_KIND_UNSUPPORTED', whole, { kind: node.kind }))
    }
  }
  if (node.error !== undefined) {
    // The kind's parse is memoised, so asking again for the error's line is free.
    const registered = node.format === 'mermaid' ? kinds.find((kind) => kind.name === node.kind) : undefined
    const parsed = registered === undefined ? undefined : parseDiagramSource(kinds, node.kind, node.value)
    const line = parsed !== undefined && 'error' in parsed ? parsed.line : undefined
    report(
      diagramDiagnostic('DIAGRAM_INVALID', whole, {
        kind: registered?.label ?? node.format,
        ...(line === undefined ? {} : { line }),
      }),
    )
  }
  let invalid = 0
  let ignored = 0
  for (const problem of node.problems ?? []) {
    const range = narrowRange(node, problem.line)
    const detail = { message: problem.message, ...(problem.line === undefined ? {} : { line: problem.line }) }
    if (problem.code === 'FLOWCHART_LAYOUT_INVALID') {
      report(diagramDiagnostic('DIAGRAM_LAYOUT_INVALID', range, { ...detail, ...(problem.path === undefined ? {} : { path: problem.path }) }))
    } else if (problem.severity === 'invalid') {
      invalid += 1
      if (invalid <= PROBLEM_DIAGNOSTICS_LIMIT) report(diagramDiagnostic('DIAGRAM_SYNTAX_INVALID', range, detail))
    } else {
      ignored += 1
      if (ignored <= PROBLEM_DIAGNOSTICS_LIMIT) report(diagramDiagnostic('DIAGRAM_SYNTAX_IGNORED', range, detail))
    }
  }
}

/** The fence line a problem names (the opening fence is line 0 of the body), or the whole fence. */
function narrowRange(node: DiagramNode, line: number | undefined): SourceRange | undefined {
  const position = node.position
  if (position === undefined) return undefined
  if (line === undefined) return position
  const number = position.start.line + line
  const length = node.value.split(/\r?\n/)[line - 1]?.length ?? 0
  return { start: { line: number, column: 1 }, end: { line: number, column: length + 1 } }
}

/** The fence, with a run long enough that the body can never close it early. */
function toFence(node: DiagramNode): string {
  const longest = Math.max(0, ...[...node.value.matchAll(/`+/g)].map((match) => match[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  const info = node.meta === undefined ? node.format : `${node.format} ${node.meta}`
  return `${fence}${info}\n${node.value}\n${fence}`
}

/* -------------------------------------------------------------- renderer */

function toFigure(node: DiagramNode, kinds: readonly DiagramKind[], fallbackTitle: string): Element {
  const attributes = { dataRmkDiagram: node.format, dataRmkDiagramKind: node.kind, dataRmkDiagramSupport: node.support }
  const render = kinds.find((kind) => kind.name === node.kind)?.render
  if (node.model !== undefined && render !== undefined) {
    const caption = modelTitle(node.model)
    return h('figure', attributes, [
      render(node.model, { fallbackTitle }),
      ...(caption === undefined ? [] : [h('figcaption', {}, [text(caption)])]),
    ])
  }
  return h('figure', { ...attributes, ...(node.error === undefined ? {} : { dataRmkDiagramError: node.error }) }, [
    h('pre', {}, [h('code', { className: [`language-${node.format}`] }, [text(node.value)])]),
  ])
}

/** A model's string `title`, the caption and the SVG's accessible name. */
function modelTitle(model: unknown): string | undefined {
  if (typeof model !== 'object' || model === null) return undefined
  const title = (model as { title?: unknown }).title
  return typeof title === 'string' ? title : undefined
}
