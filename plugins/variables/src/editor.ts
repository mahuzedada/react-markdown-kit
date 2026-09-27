/**
 * `@react-markdown-kit/variables/editor` — `variableChips()` with chips.
 *
 * The same extension as the root entry (same `name`, so it replaces the
 * headless one in a preset) plus an `editor` capability: an inline Lexical
 * node that shows a placeholder as a chip with its label and a sample-data
 * preview, the inline adapter that maps the `variable` mdast node to
 * it and back, the `{{` typing trigger, the insert command and the toolbar
 * button. This is the only entry that loads React and Lexical.
 *
 * Preview data changes what the author sees. It never changes what is saved:
 * a chip serializes from the authored placeholder alone (spec 8.19).
 */
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import { lexicalAdapter } from '@react-markdown-kit/editor/lexical'
import {
  createVariableAdapter,
  variableChips as headlessVariableChips,
  type VariableChipsOptions,
} from './chips.js'
import { VariableNode } from './editor/node.js'
import { createVariablePlugin, insertVariableCommand, variableInlineAdapter } from './editor/plugin.js'

export function variableChips<TData = unknown>(options: VariableChipsOptions<TData> = {}): MarkdownExtension {
  const headless = headlessVariableChips(options)
  const adapter = createVariableAdapter(options)
  return {
    ...headless,
    capabilities: {
      ...headless.capabilities,
      editor: lexicalAdapter({
        nodes: [VariableNode],
        inlines: [variableInlineAdapter(adapter)],
        plugins: [createVariablePlugin(adapter)],
        commands: [insertVariableCommand(adapter)],
      }),
    },
  }
}

export { variables } from './extension.js'
export type { VariablesOptions } from './extension.js'
export type { VariableChipsOptions }
export { INSERT_VARIABLE_COMMAND } from './editor/plugin.js'
export { $isVariableNode, VariableNode } from './editor/node.js'
