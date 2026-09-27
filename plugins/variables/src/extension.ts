/**
 * `variables()` — the plugin that personalizes a document.
 *
 *   <Markdown preset={appMarkdown} extensions={[variables({ data: customer })]}>{source}</Markdown>
 *   compileMarkdown(source, { preset, extensions: [variables({ data })] })
 *
 * There is no standalone engine object and no second parser. The renderer parses the
 * source with the application's preset, then this extension's syntax
 * transform fills the parsed tree in: values are placed structurally, never
 * substituted into source text, so a value of `**Administrator**` renders as
 * those literal characters and no value can create a heading, a table row, a
 * link destination or a code fence (spec 8.11).
 *
 * The rules of spec 8.7 still hold: a missing required value, a schema
 * failure or an unsafe path is an error, and on any error the document is
 * replaced by `fallback` (nothing by default) rather than rendered half-filled.
 * Diagnostics land on the compiled document and on `onDiagnostics`.
 */
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Root as MdastRoot } from 'mdast'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import type { MarkdownExtension, SyntaxTransformContext } from '@internal/extension-contracts/index.js'
import { MarkdownConfigurationError, hasErrors, type MarkdownDiagnostic } from '@internal/diagnostics/index.js'
import { auditSource } from './engine/audit.js'
import { mergeFormatters, type VariableFormatter } from './engine/formatters.js'
import { collectPlaceholders } from './engine/inspect.js'
import { interpolateTree } from './engine/interpolate.js'
import { literalNodeTypesOf } from './engine/parse.js'
import { isStandardSchema, validateWithSchema, type InferSchemaOutput, type StandardSchema } from './engine/standard-schema.js'
import type { VariableMeta } from './engine/types.js'
import { VARIABLE_NODE } from './chips.js'

export interface VariablesOptions<TData = unknown> {
  /** The values placeholders resolve to. Validated by `schema` when given. */
  readonly data: TData
  /** A Standard Schema validator (Zod, Valibot, ArkType, ...). Rejected data is an error. */
  readonly schema?: StandardSchema
  /** Formatting locale. Default `en-US`. */
  readonly locale?: string
  /** Time zone for date and time formatters. Default `UTC`. */
  readonly timeZone?: string
  /** Formatters on top of the built-ins and those sibling extensions contribute. */
  readonly formatters?: Readonly<Record<string, VariableFormatter>>
  /** Per-variable metadata: `required`, `label`, `group`. */
  readonly variables?: Readonly<Record<string, VariableMeta>>
  /** Markdown shown instead when resolution fails. Default: an empty document. */
  readonly fallback?: string
  /** Every diagnostic of this resolution, on success and on failure. */
  readonly onDiagnostics?: (diagnostics: readonly MarkdownDiagnostic[]) => void
}

export function variables<TSchema extends StandardSchema>(
  options: VariablesOptions<InferSchemaOutput<TSchema>> & { readonly schema: TSchema },
): MarkdownExtension
export function variables<TData = unknown>(options: VariablesOptions<TData>): MarkdownExtension
export function variables(options: VariablesOptions<unknown>): MarkdownExtension {
  if (options === null || typeof options !== 'object' || !('data' in options)) {
    throw new MarkdownConfigurationError('VARIABLE_CONFIG_INVALID', 'variables() expects an options object with `data`.')
  }
  if (options.schema !== undefined && !isStandardSchema(options.schema)) {
    throw new MarkdownConfigurationError(
      'VARIABLE_SCHEMA_INVALID',
      'schema must be a Standard Schema validator (an object with a "~standard" property).',
    )
  }
  return {
    name: 'variables',
    version: '1',
    contractVersion: 1,
    capabilities: {
      syntax: { transform: (tree, context) => resolve(tree, context, options) },
    },
  }
}

function resolve(tree: MarkdownRoot, context: SyntaxTransformContext, options: VariablesOptions<unknown>): MarkdownRoot {
  const siblings = (context.extensions ?? []).filter((extension) => extension.name !== 'variables')
  const literalNodeTypes = literalNodeTypesOf(siblings)
  const formatters = mergeFormatters(siblingFormatters(siblings), options.formatters)
  const locale = options.locale ?? 'en-US'
  const timeZone = options.timeZone ?? 'UTC'

  const diagnostics: MarkdownDiagnostic[] = []
  const report = (diagnostic: MarkdownDiagnostic): void => {
    diagnostics.push(diagnostic)
  }

  // A `variableChips()` chip lifted earlier in the same compilation is a
  // placeholder like any other: put its text back so it resolves.
  unliftChips(tree)

  // Authoring problems first: a placeholder that Markdown dissolved is
  // reported from the source, because the tree walk can no longer see it.
  const placeholders = collectPlaceholders(tree, literalNodeTypes)
  if (context.source !== undefined) {
    diagnostics.push(...auditSource(context.source, tree, literalNodeTypes, placeholders))
  }

  let data = options.data
  const schema = options.schema
  if (schema !== undefined) {
    const validation = validateWithSchema(schema, data)
    if (!validation.ok) {
      // Terminal: resolving against rejected data would produce a
      // publishable-looking document from data nobody vouched for.
      return fail(context, siblings, options, dedupe([...diagnostics, ...validation.diagnostics]))
    }
    data = validation.data
  }

  interpolateTree(tree, {
    data,
    locale,
    timeZone,
    formatters,
    variables: options.variables ?? {},
    literalNodeTypes,
    source: context.source ?? '',
    report,
  })

  let resolved = tree
  for (const extension of siblings) {
    const transform = extension.capabilities?.variables?.transform
    if (transform !== undefined) resolved = transform(resolved, { report })
  }

  const reported = dedupe(diagnostics)
  if (hasErrors(reported)) return fail(context, siblings, options, reported)
  for (const diagnostic of reported) context.report(diagnostic)
  options.onDiagnostics?.(reported)
  return resolved
}

/** Never a half-filled document: the fallback, or nothing. */
function fail(
  context: SyntaxTransformContext,
  siblings: readonly MarkdownExtension[],
  options: VariablesOptions<unknown>,
  diagnostics: readonly MarkdownDiagnostic[],
): MarkdownRoot {
  for (const diagnostic of diagnostics) context.report(diagnostic)
  options.onDiagnostics?.(diagnostics)
  if (options.fallback === undefined) return { type: 'root', children: [] }
  return fromMarkdown(options.fallback, {
    extensions: siblings.flatMap((extension) => extension.capabilities?.syntax?.micromarkExtensions ?? []) as never,
    mdastExtensions: siblings.flatMap((extension) => extension.capabilities?.syntax?.fromMarkdownExtensions ?? []) as never,
  }) as MdastRoot as unknown as MarkdownRoot
}

function unliftChips(tree: MarkdownRoot): void {
  const walk = (node: MarkdownNode): void => {
    const children = node.children
    if (!Array.isArray(children)) return
    node.children = children.map((child) => {
      if (child.type === VARIABLE_NODE && typeof child.value === 'string') {
        return { type: 'text', value: child.value, ...(child.position === undefined ? {} : { position: child.position }) }
      }
      walk(child)
      return child
    })
  }
  walk(tree)
}

function siblingFormatters(extensions: readonly MarkdownExtension[]): Record<string, VariableFormatter> {
  const merged: Record<string, VariableFormatter> = {}
  for (const extension of extensions) {
    for (const [name, formatter] of Object.entries(extension.capabilities?.variables?.formatters ?? {})) {
      if (typeof formatter === 'function') merged[name] = formatter as VariableFormatter
    }
  }
  return merged
}

/**
 * One problem, one diagnostic. The source audit and the tree walk both see a
 * bad placeholder, by design, so identical reports are collapsed. The first
 * wins, which is the audit's, whose range points at the placeholder.
 */
function dedupe(diagnostics: readonly MarkdownDiagnostic[]): MarkdownDiagnostic[] {
  const seen = new Set<string>()
  const unique: MarkdownDiagnostic[] = []
  for (const value of diagnostics) {
    const key = `${value.code}|${value.path ?? ''}|${value.message}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(value)
  }
  return unique
}
