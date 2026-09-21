/**
 * `@react-markdown-kit/template/editor` — `templateVariables()` with chips.
 *
 * The same extension as the root entry (same `name`, so it replaces the
 * headless one in a preset) plus an `editor` capability: an inline Lexical
 * node that shows a placeholder as a chip with its label and a sample-data
 * preview, the inline adapter that maps the `templateVariable` mdast node to
 * it and back, the `{{` typing trigger, the insert command and the toolbar
 * button. This is the only entry that loads React and Lexical.
 *
 * Preview data changes what the author sees. It never changes what is saved:
 * a chip serializes from the authored placeholder alone (spec 8.19).
 */
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import { lexicalAdapter } from '@react-markdown-kit/editor/lexical'
import {
  createTemplateVariableAdapter,
  templateVariables as headlessTemplateVariables,
  type TemplateVariablesOptions,
} from './variables.js'
import { TemplateVariableNode } from './editor/node.js'
import { createTemplateVariablePlugin, insertVariableCommand, templateVariableInlineAdapter } from './editor/plugin.js'

export function templateVariables<TData = unknown>(options: TemplateVariablesOptions<TData> = {}): MarkdownExtension {
  const headless = headlessTemplateVariables(options)
  const adapter = createTemplateVariableAdapter(options)
  return {
    ...headless,
    capabilities: {
      ...headless.capabilities,
      editor: lexicalAdapter({
        nodes: [TemplateVariableNode],
        inlines: [templateVariableInlineAdapter(adapter)],
        plugins: [createTemplateVariablePlugin(adapter)],
        commands: [insertVariableCommand(adapter)],
      }),
    },
  }
}

export { template } from './extension.js'
export type { TemplateOptions } from './extension.js'
export type { TemplateVariablesOptions }
export { INSERT_TEMPLATE_VARIABLE_COMMAND } from './editor/plugin.js'
export { $isTemplateVariableNode, TemplateVariableNode } from './editor/node.js'
