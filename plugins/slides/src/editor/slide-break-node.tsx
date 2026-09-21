/**
 * The Lexical node for a thematic break inside a deck.
 *
 * The editor package maps every `thematicBreak` to its own rule node, which
 * cannot tell a `---` slide break from a `***` rule: the spelling is gone
 * once mdast exists. This node keeps it as `kind`, so the rich surface can
 * number slide breaks and leave rules plain, and it remembers the bytes it
 * was imported with, so `- - -` or `_____` survive a session that never
 * touches them. A fresh node (inserted, pasted or restored) has no bytes
 * and writes `---` or `***`; the adapter exports it as the plugin's own
 * mdast node so the writer never mistakes it for an original break of the
 * other kind. The kind is fixed for the node's life: a break is replaced,
 * never re-typed. A break nested in a quote or a list is always a rule,
 * because only a root-level `---` splits slides; the plugin's node
 * transform re-types one that imported as a slide break.
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
import type { BreakKind } from '../deck/breaks.js'
import { useSlidesEditorLabels } from './options.js'
import { breakSpellingOf } from './slide-break-mdast.js'

export type SerializedSlideBreakNode = Spread<{ kind: BreakKind }, SerializedLexicalNode>

const DOM_ATTRIBUTE = 'data-rmk-slide-break'

export class SlideBreakNode extends DecoratorNode<ReactElement> {
  /** @internal */
  __kind: BreakKind
  /** @internal Exact bytes the break was imported with; null for a fresh one. */
  __source: string | null

  static override getType(): string {
    return 'rmk-slide-break'
  }

  static override clone(node: SlideBreakNode): SlideBreakNode {
    return new SlideBreakNode(node.__kind, node.__source, node.__key)
  }

  constructor(kind: BreakKind = 'slide', source: string | null = null, key?: NodeKey) {
    super(key)
    this.__kind = kind
    this.__source = source
  }

  static override importJSON(serialized: SerializedSlideBreakNode): SlideBreakNode {
    // A pasted or restored break has no bytes to preserve.
    return $createSlideBreakNode(serialized.kind)
  }

  override exportJSON(): SerializedSlideBreakNode {
    return { type: SlideBreakNode.getType(), version: 1, kind: this.__kind }
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('div')
    element.setAttribute(DOM_ATTRIBUTE, this.__kind)
    element.setAttribute('contenteditable', 'false')
    return element
  }

  override updateDOM(previous: SlideBreakNode): boolean {
    return previous.__kind !== this.__kind
  }

  override exportDOM(): DOMExportOutput {
    const element = document.createElement('hr')
    element.setAttribute(DOM_ATTRIBUTE, this.__kind)
    return { element }
  }

  /** A copied break pastes back as the same kind; any other <hr> is a slide break. */
  static override importDOM(): DOMConversionMap | null {
    return {
      hr: (element: HTMLElement) => ({
        conversion: (): DOMConversionOutput => ({
          node: $createSlideBreakNode(element.getAttribute(DOM_ATTRIBUTE) === 'rule' ? 'rule' : 'slide'),
        }),
        priority: 2,
      }),
    }
  }

  getKind(): BreakKind {
    return this.getLatest().__kind
  }

  /** The bytes the break was imported with, else null for a fresh one. */
  getSource(): string | null {
    return this.getLatest().__source
  }

  override getTextContent(): string {
    return this.getSource() ?? breakSpellingOf(this.getKind())
  }

  override isInline(): false {
    return false
  }

  override decorate(editor: LexicalEditor): ReactElement {
    return <BreakView editor={editor} kind={this.getKind()} />
  }
}

/** The stylesheet draws the divider and the slide number; the <hr> is what an unstyled editor shows. */
function BreakView({ editor, kind }: { readonly editor: LexicalEditor; readonly kind: BreakKind }): ReactElement {
  const labels = useSlidesEditorLabels(editor)
  return <hr aria-label={kind === 'rule' ? labels.rule : labels.slideBreak} />
}

/** A fresh break (the insertion path). */
export function $createSlideBreakNode(kind: BreakKind = 'slide'): SlideBreakNode {
  return $applyNodeReplacement(new SlideBreakNode(kind))
}

/** A break imported from Markdown, remembering its bytes for the writer. */
export function $createImportedSlideBreakNode(kind: BreakKind, source: string | null): SlideBreakNode {
  return $applyNodeReplacement(new SlideBreakNode(kind, source))
}

export function $isSlideBreakNode(node: LexicalNode | null | undefined): node is SlideBreakNode {
  return node instanceof SlideBreakNode
}
