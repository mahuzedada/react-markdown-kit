/**
 * The Lexical decorator node of one diagram block (docs/MERMAID_PLATFORM.md
 * section 9.1). Ported from @zuilib/text-editor (MIT) and re-based on source.
 *
 * The node stores the fence body and its kind, never a parsed model: parsing
 * happens outside, memoised on the source, so every kind edits the same node
 * and the canvas and the source editor are two views of one string. On top
 * of that it remembers the fence it was imported from (the exact bytes and
 * the mdast node), so an untouched block writes back byte for byte and a
 * legacy ```diagram / ```drawing fence converts invisibly: its source is the
 * flowchart writer's output from the first moment, but the document keeps
 * the JSON until the first edit.
 */
import type { ReactElement } from 'react'
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import { detectDiagramKind } from '../core/detect.js'
import { deserializeDrawingData, type DrawingData } from '../core/drawing-data.js'
import { flowchart } from '../core/flowchart-kind.js'
import type { DiagramKind } from '../core/kind.js'
import type { DiagramFormat, DiagramNode as DiagramMdastNode } from '../extension.js'
import { DiagramBlock } from './diagram-block.js'

/** Version 2: the source and its kind. */
export type SerializedDiagramNode = Spread<
  {
    source: string
    kind: string
    format: DiagramFormat
  },
  SerializedLexicalNode
>

/** Version 1 carried the drawing JSON; it still imports. */
type SerializedDiagramNodeV1 = Spread<{ data: string; format: DiagramFormat }, SerializedLexicalNode>

/** The clipboard element: the fence body under this attribute, so a paste renders wherever Mermaid does. */
const DOM_ATTRIBUTE = 'data-rmk-mermaid'
const DOM_KIND_ATTRIBUTE = 'data-rmk-diagram-kind'
/** Older clipboards carried the drawing JSON. */
const LEGACY_DOM_ATTRIBUTE = 'data-rmk-drawing'

/** The kind name of the built-in canvas kind. */
export const FLOWCHART_KIND = 'flowchart'

/** Flowchart source for a legacy model: the built-in writer, with nothing retained. */
export function legacySource(model: DrawingData): string {
  const writer = flowchart().write
  if (writer === undefined) throw new Error('The built-in flowchart kind writes.')
  return writer(model, { retained: [] })
}

export class DiagramNode extends DecoratorNode<ReactElement> {
  /** @internal Fence body, or the edited text. */
  __source: string
  /** @internal Kind name from detection; `flowchart` for a legacy fence. */
  __kind: string
  /** @internal The fence this block came from. `mermaid` once edited or inserted. */
  __format: DiagramFormat
  /** @internal Exact block bytes from import, fence included; null once edited. */
  __raw: string | null
  /** @internal The mdast node it was imported from; null once edited. */
  __origin: DiagramMdastNode | null
  /** @internal The fence's info-string remainder, kept across edits. */
  __meta: string | null

  static override getType(): string {
    return 'rmk-diagram'
  }

  static override clone(node: DiagramNode): DiagramNode {
    return new DiagramNode(node.__source, node.__kind, node.__format, node.__raw, node.__origin, node.__meta, node.__key)
  }

  constructor(
    source: string,
    kind: string = FLOWCHART_KIND,
    format: DiagramFormat = 'mermaid',
    raw: string | null = null,
    origin: DiagramMdastNode | null = null,
    meta: string | null = null,
    key?: NodeKey,
  ) {
    super(key)
    this.__source = source
    this.__kind = kind
    this.__format = format
    this.__raw = raw
    this.__origin = origin
    this.__meta = meta
  }

  static override importJSON(serialized: SerializedDiagramNode | SerializedDiagramNodeV1): DiagramNode {
    // A pasted or restored node has no fence to preserve: it is edited content.
    if ('source' in serialized) return $createDiagramNode(serialized.source, serialized.kind)
    return $createDiagramNode(legacySource(deserializeDrawingData(serialized.data)), FLOWCHART_KIND)
  }

  override exportJSON(): SerializedDiagramNode {
    return {
      source: this.__source,
      kind: this.__kind,
      format: this.__format,
      type: DiagramNode.getType(),
      version: 2,
    }
  }

  override createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'rmk-diagram'
    div.setAttribute('data-rmk-diagram', this.__format)
    return div
  }

  override updateDOM(): false {
    return false
  }

  override exportDOM(): DOMExportOutput {
    const element = document.createElement('pre')
    element.setAttribute(DOM_ATTRIBUTE, '')
    element.setAttribute(DOM_KIND_ATTRIBUTE, this.__kind)
    element.textContent = this.__source
    return { element }
  }

  static override importDOM(): DOMConversionMap | null {
    return {
      pre: (domNode: HTMLElement) => {
        if (domNode.hasAttribute(DOM_ATTRIBUTE)) {
          return {
            conversion: (element: HTMLElement): DOMConversionOutput => ({
              node: $createDiagramNode(element.textContent ?? '', element.getAttribute(DOM_KIND_ATTRIBUTE) ?? 'unknown'),
            }),
            priority: 2,
          }
        }
        if (domNode.hasAttribute(LEGACY_DOM_ATTRIBUTE)) {
          return {
            conversion: (element: HTMLElement): DOMConversionOutput => ({
              node: $createDiagramNode(
                legacySource(deserializeDrawingData(element.getAttribute(LEGACY_DOM_ATTRIBUTE) ?? '')),
                FLOWCHART_KIND,
              ),
            }),
            priority: 2,
          }
        }
        return null
      },
    }
  }

  /** The fence body as it stands. */
  getSource(): string {
    return this.getLatest().__source
  }

  getKind(): string {
    return this.getLatest().__kind
  }

  getFormat(): DiagramFormat {
    return this.getLatest().__format
  }

  /** The bytes to write back while untouched, else null. */
  getRaw(): string | null {
    return this.getLatest().__raw
  }

  /** The mdast node this block was imported from while untouched, else null. */
  getOrigin(): DiagramMdastNode | null {
    return this.getLatest().__origin
  }

  /** The fence's info-string remainder, or null. */
  getMeta(): string | null {
    return this.getLatest().__meta
  }

  /**
   * Replaces the source and re-detects its kind. The block is now edited:
   * it serializes as ```mermaid from its source.
   */
  setSource(next: string, kinds: readonly DiagramKind[]): void {
    const writable = this.getWritable()
    writable.__source = next
    writable.__kind = detectDiagramKind(next, kinds).kind
    writable.__format = 'mermaid'
    writable.__raw = null
    writable.__origin = null
  }

  override isInline(): false {
    return false
  }

  override decorate(_editor: LexicalEditor, _config: EditorConfig): ReactElement {
    return <DiagramBlock nodeKey={this.getKey()} source={this.getSource()} kind={this.getKind()} format={this.getFormat()} />
  }
}

/** A fresh, edited block (the insertion and clipboard paths). */
export function $createDiagramNode(source: string, kind: string): DiagramNode {
  return $applyNodeReplacement(new DiagramNode(source, kind))
}

/** A block imported from a fence, remembering the fence for the writer. */
export function $createImportedDiagramNode(
  source: string,
  kind: string,
  origin: DiagramMdastNode,
  raw: string | null,
): DiagramNode {
  return $applyNodeReplacement(new DiagramNode(source, kind, origin.format, raw, origin, origin.meta ?? null))
}

export function $isDiagramNode(node: LexicalNode | null | undefined): node is DiagramNode {
  return node instanceof DiagramNode
}
