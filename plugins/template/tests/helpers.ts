/**
 * Shared helpers for the template suite.
 *
 * `defineTemplate` and `toMarkdown` here are test shims over the plugin: the
 * package's only public surface is `template()` (and `templateVariables()`),
 * used through `compileMarkdown` and `<Markdown>`. The shims keep the many
 * behavioural tests readable ("define, resolve, inspect the result") while
 * exercising exactly the code path a consumer runs.
 */
import { serializeDocument } from '@react-markdown-kit/editor'
import {
  compileMarkdown,
  gfm,
  type MarkdownDiagnostic,
  type MarkdownDocument,
  type MarkdownExtension,
  type MarkdownNode,
  type MarkdownPreset,
} from '@react-markdown-kit/renderer'
import { template, type StandardSchema, type TemplateFormatter, type TemplateVariableMeta } from '../src/index.js'

export interface ShimConfig {
  readonly source: string | Readonly<Record<string, string>>
  readonly preset?: MarkdownPreset
  readonly extensions?: readonly MarkdownExtension[]
  readonly schema?: StandardSchema
  readonly variables?: Readonly<Record<string, TemplateVariableMeta>>
  readonly formatters?: Readonly<Record<string, TemplateFormatter>>
  readonly timeZone?: string
  readonly defaultLocale?: string
}

export interface ShimResolveOptions {
  readonly locale?: string
  readonly timeZone?: string
  readonly formatters?: Readonly<Record<string, TemplateFormatter>>
  readonly retainSource?: boolean
}

export type ShimResult =
  | { readonly ok: true; readonly document: MarkdownDocument; readonly diagnostics: readonly MarkdownDiagnostic[] }
  | { readonly ok: false; readonly document?: undefined; readonly diagnostics: readonly MarkdownDiagnostic[] }

export interface ShimTemplate {
  resolve(data: unknown, options?: ShimResolveOptions): ShimResult
}

/** Resolve a source with `template()` the way `<Markdown>` would. */
export function defineTemplate(input: string | ShimConfig): ShimTemplate {
  const config: ShimConfig = typeof input === 'string' ? { source: input } : input
  return {
    resolve(data, options) {
      const locale = options?.locale ?? config.defaultLocale
      const source =
        typeof config.source === 'string'
          ? config.source
          : (config.source[locale ?? ''] ?? config.source[config.defaultLocale ?? ''] ?? Object.values(config.source)[0] ?? '')
      let reported: readonly MarkdownDiagnostic[] = []
      const extension = template({
        data,
        ...(config.schema === undefined ? {} : { schema: config.schema }),
        ...(config.variables === undefined ? {} : { variables: config.variables }),
        formatters: { ...config.formatters, ...options?.formatters },
        ...(locale === undefined ? {} : { locale }),
        ...(options?.timeZone ?? config.timeZone) === undefined ? {} : { timeZone: (options?.timeZone ?? config.timeZone) as string },
        onDiagnostics: (diagnostics) => {
          reported = diagnostics
        },
      })
      const document = compileMarkdown(source, {
        ...(config.preset === undefined ? {} : { preset: config.preset }),
        extensions: [...(config.extensions ?? []), extension],
        retainSource: options?.retainSource === true,
      })
      const ok = !reported.some((diagnostic) => diagnostic.severity === 'error')
      return ok ? { ok: true, document, diagnostics: reported } : { ok: false, diagnostics: reported }
    },
  }
}

/** Sync serialization for assertions; the document's own profile decides the dialect. */
export function toMarkdown(
  document: MarkdownDocument,
  options?: { readonly preset?: MarkdownPreset; readonly extensions?: readonly MarkdownExtension[] },
): string {
  const extensions =
    options?.preset === undefined && options?.extensions === undefined && document.profile === 'gfm'
      ? [gfm()]
      : [...(options?.preset?.extensions ?? []), ...(options?.extensions ?? [])]
  return serializeDocument(
    document,
    extensions.flatMap((extension) => extension.capabilities?.syntax?.toMarkdownExtensions ?? []),
  )
}

/** Every `text` value in the tree, concatenated. What a reader would see. */
export function textOf(document: MarkdownDocument | { tree: MarkdownNode }): string {
  return collect(document.tree as MarkdownNode).join('')
}

function collect(node: MarkdownNode): string[] {
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') {
    return [typeof node.value === 'string' ? node.value : '']
  }
  const children = Array.isArray(node.children) ? node.children : []
  return children.flatMap(collect)
}

/** Every node type present, for asserting that no new structure appeared. */
export function typesOf(document: MarkdownDocument | { tree: MarkdownNode }): string[] {
  const seen: string[] = []
  const walk = (node: MarkdownNode): void => {
    seen.push(node.type)
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child)
  }
  walk(document.tree as MarkdownNode)
  return seen
}

/** The structural skeleton: node types with `text` removed and autolink literals flattened. */
export function structureOf(document: MarkdownDocument | { tree: MarkdownNode }): string[] {
  const seen: string[] = []
  const walk = (node: MarkdownNode): void => {
    const children = Array.isArray(node.children) ? node.children : []
    if (node.type !== 'text' && !isAutolink(node)) seen.push(node.type)
    for (const child of children) walk(child)
  }
  walk(document.tree as MarkdownNode)
  return seen
}

function isAutolink(node: MarkdownNode): boolean {
  if (node.type !== 'link' || typeof node.url !== 'string') return false
  const shown = collect(node).join('')
  return node.url === shown || node.url === `mailto:${shown}`
}

/** Narrows a result to its document, failing the test with the diagnostics if it is not ok. */
export function expectOk<T extends { ok: boolean; document?: MarkdownDocument | undefined }>(result: T): MarkdownDocument {
  if (!result.ok || result.document === undefined) {
    throw new Error(`expected ok result, got: ${JSON.stringify((result as { diagnostics?: unknown }).diagnostics)}`)
  }
  return result.document
}
