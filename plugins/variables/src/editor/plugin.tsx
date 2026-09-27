/**
 * The editor half of `variableChips()`:
 *
 *   - the inline adapter that maps a `variable` mdast node to a chip
 *     and back;
 *   - a text transform that turns a `{{placeholder}}` the author finishes
 *     typing into a chip (the `{{` trigger of spec 8.19), except inside code;
 *   - `INSERT_VARIABLE_COMMAND` and the toolbar button that runs it.
 */
import {
  $createTextNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  TextNode,
  createCommand,
  type LexicalCommand,
  type LexicalNode,
} from 'lexical'
import { mergeRegister } from '@lexical/utils'
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import type {
  VariableAdapter,
  VariableNode as VariableMdastNode,
  VariableValue,
} from '../chips.js'
import { VARIABLE_NODE } from '../chips.js'
import type { EditorCommandContribution, EditorInlineAdapter, EditorPlugin } from '@react-markdown-kit/editor/lexical'
import { $createVariableNode, $isVariableNode } from './node.js'
import { setAdapter } from './registry.js'

/** Insert a chip at the selection. Handled by the plugin `variableChips()` registers. */
export const INSERT_VARIABLE_COMMAND: LexicalCommand<VariableValue | { readonly path: string }> =
  createCommand('INSERT_VARIABLE_COMMAND')

export function variableInlineAdapter(adapter: VariableAdapter): EditorInlineAdapter {
  return {
    type: VARIABLE_NODE,
    $import(node: MarkdownNode): LexicalNode {
      const origin = node as VariableMdastNode
      return $createVariableNode(valueOf(origin))
    },
    matches: $isVariableNode,
    $export(node: LexicalNode) {
      if (!$isVariableNode(node)) throw new Error('not a variable node')
      const value = node.getValue()
      const mdast: VariableMdastNode = { type: VARIABLE_NODE, ...value }
      return { node: mdast, raw: adapter.serialize(mdast) }
    },
  }
}

export function createVariablePlugin(adapter: VariableAdapter): EditorPlugin {
  return (editor) =>
    mergeRegister(
      setAdapter(editor, adapter),
      editor.registerCommand(
        INSERT_VARIABLE_COMMAND,
        (payload) => {
          const node = $createVariableNode({ value: '', ...payload })
          const selection = $getSelection()
          if ($isRangeSelection(selection)) selection.insertNodes([node])
          else $insertNodes([node])
          return true
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      // Typing `{{customer.name}}` closes into a chip. Code stays text, as in
      // resolution (spec 8.11): inline code is a text format, a code block a
      // parent node.
      editor.registerNodeTransform(TextNode, (node) => {
        if (node.hasFormat('code') || !node.isSimpleText()) return
        // The editor's code block node; its class is not public, its type name is stable.
        if (node.getParent()?.getType() === 'rmk-code-block') return
        const text = node.getTextContent()
        const matches = adapter.scan(text)
        if (matches.length === 0) return
        const pieces: LexicalNode[] = []
        let cursor = 0
        for (const match of matches) {
          if (match.start > cursor) pieces.push(styled(node, text.slice(cursor, match.start)))
          pieces.push($createVariableNode(valueOf(match.node)))
          cursor = match.end
        }
        if (cursor < text.length) pieces.push(styled(node, text.slice(cursor)))
        const last = pieces[pieces.length - 1]
        for (const piece of pieces) node.insertBefore(piece)
        node.remove()
        last?.selectEnd()
      }),
    )
}

/** The placeholder's own fields, without `type` or `position`. */
function valueOf(node: VariableMdastNode): VariableValue {
  return {
    path: node.path,
    ...(node.formatter === undefined ? {} : { formatter: node.formatter }),
    ...(node.argument === undefined ? {} : { argument: node.argument }),
    value: node.value,
  }
}

function styled(like: TextNode, text: string): TextNode {
  const node = $createTextNode(text)
  node.setFormat(like.getFormat())
  node.setStyle(like.getStyle())
  return node
}

/** The default toolbar's "Insert variable" button. */
export function insertVariableCommand(adapter: VariableAdapter): EditorCommandContribution {
  return {
    id: 'variable',
    label: 'Insert variable',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M7 4c-2 0-2 1.5-2 3s0 3-2 3c2 0 2 1.5 2 3s0 3 2 3M13 4c2 0 2 1.5 2 3s0 3 2 3c-2 0-2 1.5-2 3s0 3-2 3" strokeLinecap="round" />
      </svg>
    ),
    run(editor) {
      // The same single browser dialog the default toolbar uses for links.
      if (typeof globalThis.prompt !== 'function') return
      const suggestion = adapter.variables[0]?.path ?? 'customer.name'
      const answer = globalThis.prompt('Variable path', suggestion)
      if (answer === null) return
      const path = answer.trim().replace(/^\{\{|\}\}$/g, '').trim()
      if (path === '') return
      const [match] = adapter.scan(`{{${path}}}`)
      if (match === undefined) return
      const value = valueOf(match.node)
      editor.update(
        () => {
          editor.dispatchCommand(INSERT_VARIABLE_COMMAND, value)
        },
        { discrete: true },
      )
    },
  }
}
