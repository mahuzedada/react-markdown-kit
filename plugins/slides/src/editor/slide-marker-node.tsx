/**
 * The Lexical node for a `???` (speaker notes) or `--` (pause) marker.
 *
 * A marker has no content of its own: it is a captioned divider that tells
 * the author where the notes or the next fragment start. It keeps the mdast
 * node and the bytes it was imported from so an untouched marker writes
 * back byte for byte; a fresh one is written by the plugin's toMarkdown
 * handler, which is what keeps `--` from becoming `\--`.
 */
import type { ReactElement } from 'react'
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import { markerSpelling, type MarkerKind, type SlideMarkerNode as SlideMarkerMdastNode } from '../deck/markers.js'
import { useSlidesEditorLabels } from './options.js'

export type SerializedSlideMarkerNode = Spread<{ kind: MarkerKind }, SerializedLexicalNode>

const DOM_ATTRIBUTE = 'data-rmk-slide-marker'

export class SlideMarkerNode extends DecoratorNode<ReactElement> {
  /** @internal */
  __kind: MarkerKind
  /** @internal Exact bytes the marker was imported with; null for a fresh one. */
  __source: string | null
  /** @internal The mdast node it was imported from; null for a fresh one. */
  __origin: SlideMarkerMdastNode | null

  static override getType(): string {
    return 'rmk-slide-marker'
  }

  static override clone(node: SlideMarkerNode): SlideMarkerNode {
    return new SlideMarkerNode(node.__kind, node.__source, node.__origin, node.__key)
  }

  constructor(kind: MarkerKind, source: string | null = null, origin: SlideMarkerMdastNode | null = null, key?: NodeKey) {
    super(key)
    this.__kind = kind
    this.__source = source
    this.__origin = origin
  }

  static override importJSON(serialized: SerializedSlideMarkerNode): SlideMarkerNode {
    return $createSlideMarkerNode(serialized.kind)
  }

  override exportJSON(): SerializedSlideMarkerNode {
    return { type: SlideMarkerNode.getType(), version: 1, kind: this.__kind }
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('div')
    element.setAttribute(DOM_ATTRIBUTE, this.__kind)
    element.setAttribute('contenteditable', 'false')
    return element
  }

  override updateDOM(): false {
    return false
  }

  override exportDOM(): DOMExportOutput {
    const element = document.createElement('div')
    element.setAttribute(DOM_ATTRIBUTE, this.__kind)
    element.textContent = markerSpelling(this.__kind)
    return { element }
  }

  static override importDOM(): DOMConversionMap | null {
    return {
      div: (element: HTMLElement) => {
        const kind = element.getAttribute(DOM_ATTRIBUTE)
        if (kind !== 'notes' && kind !== 'pause') return null
        return {
          conversion: (): DOMConversionOutput => ({ node: $createSlideMarkerNode(kind) }),
          priority: 2,
        }
      },
    }
  }

  getKind(): MarkerKind {
    return this.getLatest().__kind
  }

  /** The bytes to write back while untouched, else null. */
  getSource(): string | null {
    return this.getLatest().__source
  }

  /** The mdast node this marker was imported from, else null. */
  getOrigin(): SlideMarkerMdastNode | null {
    return this.getLatest().__origin
  }

  /** The marker's spelling, which is also what copies to the clipboard. */
  override getTextContent(): string {
    return markerSpelling(this.getKind())
  }

  override isInline(): false {
    return false
  }

  override decorate(editor: LexicalEditor): ReactElement {
    return <MarkerView editor={editor} kind={this.getKind()} />
  }
}

/** The caption; the stylesheet draws the lines on either side. */
function MarkerView({ editor, kind }: { readonly editor: LexicalEditor; readonly kind: MarkerKind }): ReactElement {
  const labels = useSlidesEditorLabels(editor)
  return <span role="separator" aria-label={kind === 'notes' ? labels.notes : labels.pause}>{kind === 'notes' ? labels.notes : labels.pause}</span>
}

/** A fresh marker (the insertion path). */
export function $createSlideMarkerNode(kind: MarkerKind): SlideMarkerNode {
  return $applyNodeReplacement(new SlideMarkerNode(kind))
}

/** A marker imported from Markdown, remembering its node and bytes for the writer. */
export function $createImportedSlideMarkerNode(origin: SlideMarkerMdastNode, source: string | null): SlideMarkerNode {
  return $applyNodeReplacement(new SlideMarkerNode(origin.kind, source, origin))
}

export function $isSlideMarkerNode(node: LexicalNode | null | undefined): node is SlideMarkerNode {
  return node instanceof SlideMarkerNode
}
