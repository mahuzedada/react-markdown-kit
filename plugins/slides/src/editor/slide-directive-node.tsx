/**
 * The Lexical node for a `<!-- key: value -->` directive: a chip that edits
 * its value inline.
 *
 * Clicking the value (or inserting a chip with no value) opens an <input>
 * inside the chip; Enter commits, Escape cancels, and leaving the field
 * commits a valid value. There is no browser dialog. A value the directive
 * would reject stays in the field, marked invalid, so a broken directive is
 * never written. A chip with no value is always an open draft, whatever
 * brought it there (an insert, an undo), and a draft abandoned empty
 * removes itself: `<!-- key:  -->` is never left closed in the document.
 * Committing a draft merges into the insert's history entry, so one undo
 * takes the whole chip back out; editing an existing chip is its own entry.
 * Closing the field by keyboard returns the caret to the block after the
 * chip; a blur leaves focus where the user put it.
 *
 * The keystrokes never reach Lexical's root listeners (native listeners on
 * the input stop them), so Enter in the field cannot split a paragraph.
 * Untouched, the chip writes back the bytes it was imported with; once
 * edited it is serialized by the plugin's toMarkdown handler.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  $addUpdateTag,
  $applyNodeReplacement,
  $getNodeByKey,
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
import { useLexicalEditor } from '@react-markdown-kit/editor/lexical'
import {
  directiveProblem,
  isDirectiveKey,
  type DirectiveKey,
  type SlideDirectiveNode as SlideDirectiveMdastNode,
} from '../deck/directives.js'
import { useSlidesEditorLabels } from './options.js'

export type SerializedSlideDirectiveNode = Spread<{ key: DirectiveKey; argument: string }, SerializedLexicalNode>

const DOM_ATTRIBUTE = 'data-rmk-slide-directive'

export class SlideDirectiveNode extends DecoratorNode<ReactElement> {
  /** @internal */
  __directiveKey: DirectiveKey
  /** @internal */
  __argument: string
  /** @internal Exact bytes the directive was imported with; null once edited. */
  __source: string | null
  /** @internal The mdast node it was imported from; null once edited. */
  __origin: SlideDirectiveMdastNode | null

  static override getType(): string {
    return 'rmk-slide-directive'
  }

  static override clone(node: SlideDirectiveNode): SlideDirectiveNode {
    return new SlideDirectiveNode(node.__directiveKey, node.__argument, node.__source, node.__origin, node.__key)
  }

  constructor(
    directiveKey: DirectiveKey,
    argument: string,
    source: string | null = null,
    origin: SlideDirectiveMdastNode | null = null,
    key?: NodeKey,
  ) {
    super(key)
    this.__directiveKey = directiveKey
    this.__argument = argument
    this.__source = source
    this.__origin = origin
  }

  static override importJSON(serialized: SerializedSlideDirectiveNode): SlideDirectiveNode {
    return $createSlideDirectiveNode(serialized.key, serialized.argument)
  }

  override exportJSON(): SerializedSlideDirectiveNode {
    return { type: SlideDirectiveNode.getType(), version: 1, key: this.__directiveKey, argument: this.__argument }
  }

  override createDOM(): HTMLElement {
    const element = document.createElement('div')
    element.setAttribute(DOM_ATTRIBUTE, this.__directiveKey)
    element.setAttribute('contenteditable', 'false')
    return element
  }

  override updateDOM(): false {
    return false
  }

  override exportDOM(): DOMExportOutput {
    const element = document.createElement('div')
    element.setAttribute(DOM_ATTRIBUTE, this.__directiveKey)
    element.textContent = this.getTextContent()
    return { element }
  }

  static override importDOM(): DOMConversionMap | null {
    return {
      div: (element: HTMLElement) => {
        const key = element.getAttribute(DOM_ATTRIBUTE)
        if (key === null || !isDirectiveKey(key)) return null
        return {
          conversion: (): DOMConversionOutput => ({
            node: $createSlideDirectiveNode(key, argumentOfComment(element.textContent ?? '', key)),
          }),
          priority: 2,
        }
      },
    }
  }

  getDirectiveKey(): DirectiveKey {
    return this.getLatest().__directiveKey
  }

  getArgument(): string {
    return this.getLatest().__argument
  }

  /** The bytes to write back while untouched, else null. */
  getSource(): string | null {
    return this.getLatest().__source
  }

  /** The mdast node this chip was imported from while untouched, else null. */
  getOrigin(): SlideDirectiveMdastNode | null {
    return this.getLatest().__origin
  }

  /** Replaces the value. The chip is now edited: it serializes from its fields. */
  setArgument(argument: string): void {
    const writable = this.getWritable()
    writable.__argument = argument
    writable.__source = null
    writable.__origin = null
  }

  /** The comment as it is written, which is also what copies to the clipboard. */
  override getTextContent(): string {
    return `<!-- ${this.getDirectiveKey()}: ${this.getArgument()} -->`
  }

  override isInline(): false {
    return false
  }

  override decorate(editor: LexicalEditor): ReactElement {
    return (
      <DirectiveChip
        editor={editor}
        nodeKey={this.getKey()}
        directiveKey={this.getDirectiveKey()}
        argument={this.getArgument()}
      />
    )
  }
}

/** `<!-- key: value -->` back to its value; anything else is taken whole. */
function argumentOfComment(text: string, key: string): string {
  const match = new RegExp(`^<!--\\s*${key}\\s*:\\s*([^]*?)\\s*-->$`, 'i').exec(text.trim())
  return match?.[1] ?? text.trim()
}

interface DirectiveChipProps {
  readonly editor: LexicalEditor
  readonly nodeKey: NodeKey
  readonly directiveKey: DirectiveKey
  readonly argument: string
}

function DirectiveChip({ editor, nodeKey, directiveKey, argument }: DirectiveChipProps): ReactElement {
  const labels = useSlidesEditorLabels(editor)
  const { readOnly } = useLexicalEditor()
  // A chip without a value is a draft and is open for editing, whether it
  // was just inserted or an undo emptied it again.
  const [opened, setOpened] = useState(false)
  const editing = opened || argument === ''
  const name = labels.directive(directiveKey)

  return (
    <>
      <span data-rmk-slide-directive-key="">{directiveKey}:</span>
      {editing && !readOnly ? (
        <DirectiveInput
          editor={editor}
          nodeKey={nodeKey}
          directiveKey={directiveKey}
          argument={argument}
          name={name}
          placeholder={labels.directiveValue}
          onClose={() => {
            setOpened(false)
          }}
        />
      ) : readOnly ? (
        <span data-rmk-slide-directive-value="">{argument}</span>
      ) : (
        <button
          type="button"
          data-rmk-slide-directive-value=""
          aria-label={`${name}: ${argument}`}
          onClick={() => {
            setOpened(true)
          }}
        >
          {argument}
        </button>
      )}
    </>
  )
}

interface DirectiveInputProps extends DirectiveChipProps {
  readonly name: string
  readonly placeholder: string
  readonly onClose: () => void
}

function DirectiveInput({ editor, nodeKey, directiveKey, argument, name, placeholder, onClose }: DirectiveInputProps): ReactElement {
  const ref = useRef<HTMLInputElement | null>(null)
  const [problem, setProblem] = useState<string | undefined>(undefined)

  useEffect(() => {
    const element = ref.current
    if (element === null) return
    element.focus()
    element.select()

    const write = (value: string): void => {
      editor.update(
        () => {
          const node = $getNodeByKey(nodeKey)
          if (!$isSlideDirectiveNode(node) || node.getArgument() === value) return
          // Filling a draft completes the insert: one history entry for both.
          if (node.getArgument() === '') $addUpdateTag('history-merge')
          node.setArgument(value)
        },
        { discrete: true },
      )
    }
    const removeDraft = (): void => {
      editor.update(
        () => {
          const node = $getNodeByKey(nodeKey)
          if (!$isSlideDirectiveNode(node) || node.getArgument() !== '') return
          // Abandoning the draft undoes the insert rather than adding to it.
          $addUpdateTag('history-merge')
          node.selectNext(0, 0)
          node.remove()
        },
        { discrete: true },
      )
    }
    /**
     * The surface takes focus back and the caret goes to the block after
     * the chip (or where a removed draft was). Lexical applies no DOM
     * selection while an input inside a decorator holds focus, so the
     * surface is focused first and the selection reapplied after.
     */
    const returnFocus = (): void => {
      editor.getRootElement()?.focus()
      editor.update(
        () => {
          $getNodeByKey(nodeKey)?.selectNext(0, 0)
        },
        { discrete: true },
      )
      editor.focus()
    }
    /** True when the field's value was accepted (or nothing had to change). */
    const commit = (): boolean => {
      const value = element.value.trim()
      if (value === '') return false
      const fault = directiveProblem(directiveKey, value)
      if (fault !== undefined) {
        setProblem(fault)
        return false
      }
      write(value)
      return true
    }
    // Closing unmounts the field, which may blur it; the second pass is a no-op.
    let closed = false
    const finish = (byKeyboard: boolean): void => {
      closed = true
      onClose()
      if (byKeyboard) returnFocus()
    }
    const close = (byKeyboard: boolean): void => {
      if (closed) return
      if (argument === '') removeDraft()
      finish(byKeyboard)
    }

    // Native listeners, so the keystrokes never reach Lexical's root handlers
    // (which would otherwise treat Enter as a new paragraph).
    const onKeyDown = (event: KeyboardEvent): void => {
      event.stopPropagation()
      if (event.key === 'Enter') {
        event.preventDefault()
        if (!closed && commit()) finish(true)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
      }
    }
    const stop = (event: Event): void => {
      event.stopPropagation()
    }
    const onBlur = (): void => {
      if (closed) return
      if (commit()) finish(false)
      else close(false)
    }
    element.addEventListener('keydown', onKeyDown)
    element.addEventListener('keyup', stop)
    element.addEventListener('keypress', stop)
    element.addEventListener('blur', onBlur)
    return () => {
      element.removeEventListener('keydown', onKeyDown)
      element.removeEventListener('keyup', stop)
      element.removeEventListener('keypress', stop)
      element.removeEventListener('blur', onBlur)
    }
    // Mount-only: the field is keyed by node and opens once per edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <input
      ref={ref}
      type="text"
      defaultValue={argument}
      aria-label={name}
      aria-invalid={problem === undefined ? undefined : true}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      {...(problem === undefined ? {} : { title: problem })}
      onChange={() => {
        setProblem(undefined)
      }}
    />
  )
}

/** A fresh chip (the insertion path). An empty `argument` opens it for editing. */
export function $createSlideDirectiveNode(key: DirectiveKey, argument: string): SlideDirectiveNode {
  return $applyNodeReplacement(new SlideDirectiveNode(key, argument))
}

/** A chip imported from Markdown, remembering its node and bytes for the writer. */
export function $createImportedSlideDirectiveNode(origin: SlideDirectiveMdastNode, source: string | null): SlideDirectiveNode {
  return $applyNodeReplacement(new SlideDirectiveNode(origin.key, origin.argument, source, origin))
}

export function $isSlideDirectiveNode(node: LexicalNode | null | undefined): node is SlideDirectiveNode {
  return node instanceof SlideDirectiveNode
}
