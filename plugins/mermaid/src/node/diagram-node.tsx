/**
 * Ported from @zuilib/text-editor (MIT). The Lexical decorator node holding
 * one drawing (as its JSON payload) and rendering the canvas. On top of the
 * zui node it remembers the fence it was imported from, so an untouched
 * block writes back byte for byte and a touched one becomes ```drawing.
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
import type { BlockWidth } from '../core/block-width.js'
import {
  EMPTY_DRAWING,
  deserializeDrawingData,
  serializeDrawingData,
  type DrawingData,
} from '../core/drawing-data.js'
import type { DiagramFormat, DiagramNode as DiagramMdastNode } from '../extension.js'
import { DiagramCanvas } from '../canvas/drawing-canvas.js'

/**
 * Last parsed payloads, keyed by their JSON. A node's `__data` string is
 * immutable per version, so the string is the whole cache key. Bounded so a
 * long editing session does not keep every intermediate drawing alive.
 */
const PARSE_CACHE_LIMIT = 64
const parseCache = new Map<string, DrawingData>()

function deserializeDrawingDataMemo(json: string): DrawingData {
  const hit = parseCache.get(json)
  if (hit) return hit
  const data = deserializeDrawingData(json)
  if (parseCache.size >= PARSE_CACHE_LIMIT) {
    const oldest = parseCache.keys().next().value
    if (oldest !== undefined) parseCache.delete(oldest)
  }
  parseCache.set(json, data)
  return data
}

export type SerializedDiagramNode = Spread<
  {
    data: string
    format: DiagramFormat
  },
  SerializedLexicalNode
>

/** The DOM attribute a copied node carries its payload in. */
const DOM_ATTRIBUTE = 'data-rmk-drawing'

/**
 * A block-level decorator node embedding a vector diagram (cards, connectors,
 * text) edited on a canvas.
 *
 * The drawing is stored as a JSON string and round-trips through Markdown as
 * a ```mermaid fenced code block, so documents remain plain Markdown and
 * render as a flowchart anywhere Mermaid does.
 */
export class DiagramNode extends DecoratorNode<ReactElement> {
  /** @internal */
  __data: string
  /** @internal The fence this block came from. `mermaid` once edited or inserted. */
  __format: DiagramFormat
  /** @internal Exact fence bytes the block was imported with; null once edited. */
  __source: string | null
  /** @internal The mdast node it was imported from; null once edited. */
  __origin: DiagramMdastNode | null

  static override getType(): string {
    return 'rmk-diagram'
  }

  static override clone(node: DiagramNode): DiagramNode {
    return new DiagramNode(node.__data, node.__format, node.__source, node.__origin, node.__key)
  }

  constructor(
    data: string,
    format: DiagramFormat = 'mermaid',
    source: string | null = null,
    origin: DiagramMdastNode | null = null,
    key?: NodeKey,
  ) {
    super(key)
    this.__data = data
    this.__format = format
    this.__source = source
    this.__origin = origin
  }

  static override importJSON(serialized: SerializedDiagramNode): DiagramNode {
    // A pasted or restored node has no fence to preserve: it is edited content.
    return $createDiagramNode(serialized.data)
  }

  override exportJSON(): SerializedDiagramNode {
    return {
      data: this.__data,
      format: this.__format,
      type: DiagramNode.getType(),
      version: 1,
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
    element.setAttribute(DOM_ATTRIBUTE, this.__data)
    return { element }
  }

  static override importDOM(): DOMConversionMap | null {
    return {
      pre: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute(DOM_ATTRIBUTE)) return null
        return {
          conversion: (element: HTMLElement): DOMConversionOutput => ({
            node: $createDiagramNode(
              serializeDrawingData(deserializeDrawingData(element.getAttribute(DOM_ATTRIBUTE) ?? '')),
            ),
          }),
          priority: 2,
        }
      },
    }
  }

  /**
   * The parsed payload. Parsing is memoized on the JSON string, so repeated
   * reads of an unchanged node (every toolbar update, every decorate) cost
   * one map lookup.
   */
  getData(): DrawingData {
    return deserializeDrawingDataMemo(this.getLatest().__data)
  }

  /** Replaces the drawing. The block is now edited: it serializes as ```drawing. */
  setData(data: DrawingData): void {
    const writable = this.getWritable()
    writable.__data = serializeDrawingData(data)
    writable.__format = 'mermaid'
    writable.__source = null
    writable.__origin = null
  }

  getFormat(): DiagramFormat {
    return this.getLatest().__format
  }

  /** The bytes to write back while untouched, else null. */
  getSource(): string | null {
    return this.getLatest().__source
  }

  /** The mdast node this block was imported from while untouched, else null. */
  getOrigin(): DiagramMdastNode | null {
    return this.getLatest().__origin
  }

  /** Block width of the drawing (`full` when the payload leaves it implicit) */
  getBlockWidth(): BlockWidth {
    return this.getData().width ?? 'full'
  }

  /** Resize the block; `full` picked by hand stays implicit in the payload */
  setBlockWidth(width: BlockWidth): void {
    const { width: _previous, ...data } = this.getData()
    this.setData(width === 'full' ? data : { ...data, width })
  }

  override isInline(): false {
    return false
  }

  override decorate(_editor: LexicalEditor, _config: EditorConfig): ReactElement {
    return <DiagramCanvas nodeKey={this.getKey()} data={this.getData()} />
  }
}

/** A fresh, edited drawing (the insertion path). */
export function $createDiagramNode(data: string = serializeDrawingData(EMPTY_DRAWING)): DiagramNode {
  return $applyNodeReplacement(new DiagramNode(data))
}

/** A drawing imported from a fence, remembering the fence for the writer. */
export function $createImportedDiagramNode(
  data: string,
  origin: DiagramMdastNode,
  source: string | null,
): DiagramNode {
  return $applyNodeReplacement(new DiagramNode(data, origin.format, source, origin))
}

export function $isDiagramNode(node: LexicalNode | null | undefined): node is DiagramNode {
  return node instanceof DiagramNode
}
