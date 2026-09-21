/**
 * The Lexical node for one `{{placeholder}}`: an inline, non-editable chip.
 *
 * It stores what the placeholder *says* (`path`, `formatter`, `argument` and
 * the authored `value`) and nothing about the data. The label and the preview
 * come from the adapter the plugin registered for this editor, at render
 * time, so preview data can never leak into what is saved (spec 8.19).
 */
import { useSyncExternalStore, type ReactElement } from 'react'
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { TemplateVariableValue } from '../variables.js'
import { adapterFor, subscribe } from './registry.js'

export type SerializedTemplateVariableNode = Spread<
  {
    path: string
    formatter: string | null
    argument: string | null
    value: string
  },
  SerializedLexicalNode
>

const DOM_ATTRIBUTE = 'data-rmk-variable'

export class TemplateVariableNode extends DecoratorNode<ReactElement> {
  /** @internal */ __path: string
  /** @internal */ __formatter: string | null
  /** @internal */ __argument: string | null
  /** @internal Authored text. Empty for a chip inserted by hand. */
  __value: string

  static override getType(): string {
    return 'rmk-template-variable'
  }

  static override clone(node: TemplateVariableNode): TemplateVariableNode {
    return new TemplateVariableNode(node.__path, node.__formatter, node.__argument, node.__value, node.__key)
  }

  constructor(path: string, formatter: string | null = null, argument: string | null = null, value = '', key?: NodeKey) {
    super(key)
    this.__path = path
    this.__formatter = formatter
    this.__argument = argument
    this.__value = value
  }

  static override importJSON(serialized: SerializedTemplateVariableNode): TemplateVariableNode {
    return $createTemplateVariableNode({
      path: serialized.path,
      ...(serialized.formatter === null ? {} : { formatter: serialized.formatter }),
      ...(serialized.argument === null ? {} : { argument: serialized.argument }),
      value: serialized.value,
    })
  }

  override exportJSON(): SerializedTemplateVariableNode {
    return {
      type: TemplateVariableNode.getType(),
      version: 1,
      path: this.__path,
      formatter: this.__formatter,
      argument: this.__argument,
      value: this.__value,
    }
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span')
    const className = chipClass(config)
    if (className !== undefined) span.className = className
    span.setAttribute(DOM_ATTRIBUTE, this.__path)
    span.contentEditable = 'false'
    return span
  }

  override updateDOM(): false {
    return false
  }

  override exportDOM(): DOMExportOutput {
    const span = document.createElement('span')
    span.setAttribute(DOM_ATTRIBUTE, this.__path)
    span.textContent = this.getTextContent()
    return { element: span }
  }

  /** A copied chip pastes back as a chip; its text is the authored placeholder. */
  static override importDOM(): DOMConversionMap | null {
    return {
      span: (element: HTMLElement) => {
        const path = element.getAttribute(DOM_ATTRIBUTE)
        if (path === null) return null
        return {
          conversion: () => ({
            node: $createTemplateVariableNode(parsePlaceholder(element.textContent ?? '', path)),
          }),
          priority: 2,
        }
      },
    }
  }

  override isInline(): true {
    return true
  }

  override isKeyboardSelectable(): true {
    return true
  }

  /** What the placeholder says. */
  getValue(): TemplateVariableValue {
    const latest = this.getLatest()
    return {
      path: latest.__path,
      ...(latest.__formatter === null ? {} : { formatter: latest.__formatter }),
      ...(latest.__argument === null ? {} : { argument: latest.__argument }),
      value: latest.__value,
    }
  }

  /** The authored placeholder, which is also what copies to the clipboard. */
  override getTextContent(): string {
    const value = this.getValue()
    if (value.value !== '') return value.value
    const formatter =
      value.formatter === undefined
        ? ''
        : value.argument === undefined
          ? ` | ${value.formatter}`
          : ` | ${value.formatter}:"${value.argument}"`
    return `{{${value.path}${formatter}}}`
  }

  override decorate(editor: LexicalEditor, config: EditorConfig): ReactElement {
    return (
      <TemplateVariableChip
        editor={editor}
        value={this.getValue()}
        text={this.getTextContent()}
        className={chipClass(config)}
      />
    )
  }
}

function TemplateVariableChip(props: {
  readonly editor: LexicalEditor
  readonly value: TemplateVariableValue
  readonly text: string
  readonly className: string | undefined
}): ReactElement {
  const { editor, value } = props
  const adapter = useSyncExternalStore(
    (listener) => subscribe(editor, listener),
    () => adapterFor(editor),
    () => adapterFor(editor),
  )
  const label = adapter?.label(value) ?? value.path
  const preview = adapter?.preview(value)
  return (
    <span className={props.className} data-rmk-variable={value.path} title={props.text}>
      {label}
      {preview === undefined ? null : <span data-rmk-variable-preview="">{preview}</span>}
    </span>
  )
}

/** `{{path | formatter:"argument"}}` back into its parts; falls back to a bare path. */
function parsePlaceholder(text: string, path: string): TemplateVariableValue {
  const match = /^\{\{\s*([^|{}]+?)\s*(?:\|\s*([A-Za-z_][\w-]*)\s*(?::\s*"([^"]*)")?)?\s*\}\}$/.exec(text.trim())
  if (match === null) return { path, value: '' }
  return {
    path: match[1] ?? path,
    ...(match[2] === undefined ? {} : { formatter: match[2] }),
    ...(match[3] === undefined ? {} : { argument: match[3] }),
    value: text.trim(),
  }
}

/** The editor's `variableChip` part, as its theme resolved it (`rmk-variable-chip` unless overridden). */
function chipClass(config: EditorConfig): string | undefined {
  const value = (config.theme as Record<string, unknown>)['variableChip']
  return typeof value === 'string' && value !== '' ? value : undefined
}

export function $createTemplateVariableNode(value: TemplateVariableValue): TemplateVariableNode {
  return $applyNodeReplacement(
    new TemplateVariableNode(value.path, value.formatter ?? null, value.argument ?? null, value.value),
  )
}

export function $isTemplateVariableNode(node: LexicalNode | null | undefined): node is TemplateVariableNode {
  return node instanceof TemplateVariableNode
}
