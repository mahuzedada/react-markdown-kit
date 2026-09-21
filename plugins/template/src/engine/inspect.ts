/**
 * Static template analysis (spec 8.6, 8.9, 8.19).
 *
 * Everything knowable *without data*: which variables a template binds, which
 * formatters it uses, which locales author it, and which problems are already
 * visible (bad paths, unknown formatters, partial URLs, placeholders stranded
 * in raw HTML). This is what a variable picker, documentation page and the
 * editor extension all read.
 */

import { diagnostic, type MarkdownDiagnostic, type SourceRange } from '@internal/diagnostics/index.js'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import { TEMPLATE_DIAGNOSTIC_CODES } from './diagnostic-codes.js'
import { HTML_NODE_TYPES } from './parse.js'
import { mightContainPlaceholder, scanPlaceholders, type PlaceholderBinding } from './placeholder.js'
import type {
  TemplatePlaceholderContext,
  TemplatePlaceholderInfo,
  TemplateVariableInfo,
  TemplateVariableMeta,
} from './types.js'

export interface CollectedPlaceholder extends TemplatePlaceholderInfo {
  readonly binding: PlaceholderBinding
}

/** Walks one parsed source, recording every placeholder and where it sits. */
export function collectPlaceholders(
  tree: MarkdownRoot,
  literalNodeTypes: ReadonlySet<string>,
  locale: string | undefined,
): CollectedPlaceholder[] {
  const found: CollectedPlaceholder[] = []

  const record = (
    binding: PlaceholderBinding,
    context: TemplatePlaceholderContext,
    node: MarkdownNode,
  ): void => {
    found.push({
      path: binding.path,
      ...(binding.formatter === undefined ? {} : { formatter: binding.formatter }),
      ...(binding.argument === undefined ? {} : { argument: binding.argument }),
      context,
      ...(locale === undefined ? {} : { locale }),
      ...(rangeOf(node) === undefined ? {} : { range: rangeOf(node) as SourceRange }),
      binding,
    })
  }

  const scanField = (
    node: MarkdownNode,
    field: string,
    context: TemplatePlaceholderContext,
  ): void => {
    const value = node[field]
    if (typeof value !== 'string' || !mightContainPlaceholder(value)) return
    for (const binding of scanPlaceholders(value)) record(binding, context, node)
  }

  const walk = (node: MarkdownNode): void => {
    if (literalNodeTypes.has(node.type)) return
    if (HTML_NODE_TYPES.has(node.type)) {
      if (typeof node.value === 'string' && mightContainPlaceholder(node.value)) {
        for (const binding of scanPlaceholders(node.value)) record(binding, 'html', node)
      }
      return
    }
    if (node.type === 'link' || node.type === 'definition') scanField(node, 'url', 'link-destination')
    if (node.type === 'image') scanField(node, 'url', 'image-destination')
    if (node.type === 'image' || node.type === 'imageReference') scanField(node, 'alt', 'image-alt')
    scanField(node, 'title', 'title')

    if (node.type === 'text' && typeof node.value === 'string') {
      for (const binding of scanPlaceholders(node.value)) record(binding, 'text', node)
      return
    }
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child)
  }

  walk(tree)
  return found
}

/**
 * Diagnostics that do not need data. Intentionally excludes "missing value",
 * which is only knowable at resolve time.
 */
export function staticDiagnostics(
  placeholders: readonly CollectedPlaceholder[],
  knownFormatters: ReadonlySet<string>,
  trees: ReadonlyMap<string | undefined, MarkdownRoot>,
): MarkdownDiagnostic[] {
  const diagnostics: MarkdownDiagnostic[] = []
  for (const placeholder of placeholders) {
    const at = {
      ...(placeholder.path === '' ? {} : { path: placeholder.path }),
      ...(placeholder.range === undefined ? {} : { range: placeholder.range }),
    }
    const problem = placeholder.binding.problem
    if (problem !== undefined) {
      diagnostics.push(diagnostic(problem.code, 'error', problem.message, at))
      continue
    }
    if (placeholder.formatter !== undefined && !knownFormatters.has(placeholder.formatter)) {
      diagnostics.push(
        diagnostic(
          TEMPLATE_DIAGNOSTIC_CODES.unknownFormatter,
          'error',
          `Unknown formatter "${placeholder.formatter}" on ${placeholder.path}.`,
          at,
        ),
      )
    }
    if (placeholder.context === 'html') {
      diagnostics.push(
        diagnostic(
          TEMPLATE_DIAGNOSTIC_CODES.placeholderInHtml,
          'warning',
          'A placeholder inside raw HTML is left literal.',
          at,
        ),
      )
    }
  }
  diagnostics.push(...partialUrlDiagnostics(trees))
  return diagnostics
}

function partialUrlDiagnostics(trees: ReadonlyMap<string | undefined, MarkdownRoot>): MarkdownDiagnostic[] {
  const diagnostics: MarkdownDiagnostic[] = []
  for (const tree of trees.values()) {
    visitDestinations(tree, (node, url) => {
      const bindings = scanPlaceholders(url)
      if (bindings.length === 0) return
      const first = bindings[0] as PlaceholderBinding
      const complete = bindings.length === 1 && first.start === 0 && first.end === url.length
      if (complete) return
      const range = rangeOf(node)
      diagnostics.push(
        diagnostic(
          TEMPLATE_DIAGNOSTIC_CODES.partialUrl,
          'error',
          `Partial URL interpolation is not supported in v1: ${url.slice(0, 80)}.`,
          range === undefined ? undefined : { range },
        ),
      )
    })
  }
  return diagnostics
}

function visitDestinations(
  node: MarkdownNode,
  visitor: (node: MarkdownNode, url: string) => void,
): void {
  if (
    (node.type === 'link' || node.type === 'image' || node.type === 'definition') &&
    typeof node.url === 'string' &&
    mightContainPlaceholder(node.url)
  ) {
    visitor(node, node.url)
  }
  for (const child of Array.isArray(node.children) ? node.children : []) {
    visitDestinations(child, visitor)
  }
}

/** Folds occurrences plus declared metadata into one row per variable. */
export function summarizeVariables(
  placeholders: readonly CollectedPlaceholder[],
  declared: Readonly<Record<string, TemplateVariableMeta>>,
): TemplateVariableInfo[] {
  const rows = new Map<string, { formatters: Set<string>; locales: Set<string>; count: number }>()
  for (const placeholder of placeholders) {
    if (placeholder.binding.problem !== undefined) continue
    let row = rows.get(placeholder.path)
    if (row === undefined) {
      row = { formatters: new Set(), locales: new Set(), count: 0 }
      rows.set(placeholder.path, row)
    }
    row.count += 1
    if (placeholder.formatter !== undefined) row.formatters.add(placeholder.formatter)
    if (placeholder.locale !== undefined) row.locales.add(placeholder.locale)
  }
  for (const path of Object.keys(declared)) {
    if (!rows.has(path)) rows.set(path, { formatters: new Set(), locales: new Set(), count: 0 })
  }

  return [...rows.entries()]
    .map(([path, row]) => {
      const meta = Object.hasOwn(declared, path) ? (declared[path] as TemplateVariableMeta) : {}
      const required = meta.required ?? !('default' in meta)
      return {
        ...meta,
        path,
        required,
        formatters: [...row.formatters].sort(),
        locales: [...row.locales].sort(),
        occurrences: row.count,
        declaredOnly: row.count === 0,
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

function rangeOf(node: MarkdownNode): SourceRange | undefined {
  const position = node.position
  if (position === undefined) return undefined
  return { start: position.start, end: position.end }
}
