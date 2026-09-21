/**
 * @react-markdown-kit/template — Markdown templating as plugins.
 *
 * Two extensions and nothing else:
 *
 *   template({ data })   resolves `{{placeholders}}` while the renderer (or
 *                        `compileMarkdown`) parses; values are placed into the
 *                        tree structurally and can never inject Markdown;
 *   templateVariables()  shows unresolved placeholders as chips in the
 *                        renderer, and, on `/editor`, as editable chips.
 *
 * The package has no standalone API: install it, put an extension in a
 * preset or an `extensions` prop, and the renderer and the editor do the rest.
 * This entry imports no React and no Lexical.
 */
export { template } from './extension.js'
export type { TemplateOptions } from './extension.js'

export { templateVariables, TEMPLATE_VARIABLE_NODE, isTemplateVariableNode } from './variables.js'
export type {
  TemplateVariableAdapter,
  TemplateVariableMatch,
  TemplateVariableNode,
  TemplateVariableSummary,
  TemplateVariableValue,
  TemplateVariablesOptions,
} from './variables.js'
export { createTemplateVariableAdapter } from './variables.js'

export { TEMPLATE_DIAGNOSTIC_CODES } from './engine/diagnostic-codes.js'
export type { TemplateDiagnosticCode } from './engine/diagnostic-codes.js'
export { builtinFormatters, TemplateFormatterError } from './engine/formatters.js'
export type { TemplateFormatter, TemplateFormatterContext } from './engine/formatters.js'
export type {
  InferSchemaOutput,
  StandardSchema,
  StandardSchemaIssue,
  StandardSchemaProps,
  StandardSchemaResult,
} from './engine/standard-schema.js'
export type { TemplateVariableMeta } from './engine/types.js'
export type { TemplateDiagnostic } from '@internal/diagnostics/index.js'
