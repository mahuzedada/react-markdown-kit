/**
 * @react-markdown-kit/variables — Markdown variables as plugins.
 *
 * Two extensions and nothing else:
 *
 *   variables({ data })   resolves `{{placeholders}}` while the renderer (or
 *                        `compileMarkdown`) parses; values are placed into the
 *                        tree structurally and can never inject Markdown;
 *   variableChips()  shows unresolved placeholders as chips in the
 *                        renderer, and, on `/editor`, as editable chips.
 *
 * The package has no standalone API: install it, put an extension in a
 * preset or an `extensions` prop, and the renderer and the editor do the rest.
 * This entry imports no React and no Lexical.
 */
export { variables } from './extension.js'
export type { VariablesOptions } from './extension.js'

export { variableChips, VARIABLE_NODE, isVariableNode } from './chips.js'
export type {
  VariableAdapter,
  VariableMatch,
  VariableNode,
  VariableSummary,
  VariableValue,
  VariableChipsOptions,
} from './chips.js'
export { createVariableAdapter } from './chips.js'

export { VARIABLE_DIAGNOSTIC_CODES } from './engine/diagnostic-codes.js'
export type { VariableDiagnosticCode } from './engine/diagnostic-codes.js'
export { builtinFormatters, VariableFormatterError } from './engine/formatters.js'
export type { VariableFormatter, VariableFormatterContext } from './engine/formatters.js'
export type {
  InferSchemaOutput,
  StandardSchema,
  StandardSchemaIssue,
  StandardSchemaProps,
  StandardSchemaResult,
} from './engine/standard-schema.js'
export type { VariableMeta } from './engine/types.js'
export type { VariableDiagnostic } from '@internal/diagnostics/index.js'
