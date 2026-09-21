/**
 * Public template types (spec 8.6 – 8.9).
 *
 * Nothing in this module references React, the renderer, the editor, Lexical
 * or a browser global. It is the type half of the headless contract.
 */

import type { MarkdownDocument } from '@internal/document-contracts/index.js'
import type { MarkdownExtension, MarkdownPreset } from '@internal/extension-contracts/index.js'
import type { MarkdownDiagnostic, SourceRange } from '@internal/diagnostics/index.js'
import type { TemplateFormatter } from './formatters.js'
import type { InferSchemaOutput, StandardSchema } from './standard-schema.js'

/** Default data type when the caller supplies neither a type nor a schema. */
export type TemplateData = Record<string, unknown>

/** Authored source: one string, or one string per locale (spec 8.8). */
export type TemplateSource = string | Readonly<Record<string, string>>

/**
 * How to pick a source when the requested locale was not authored (spec 8.13).
 *
 *   `parent`  exact → parent/sibling language → defaultLocale (the default)
 *   `default` exact → defaultLocale
 *   `none`    exact only; anything else is an error
 */
export type LocaleFallbackPolicy = 'parent' | 'default' | 'none'

/** Presentation metadata, deliberately separate from the schema (spec 8.9). */
export interface TemplateVariableMeta {
  readonly label?: string
  readonly description?: string
  readonly group?: string
  /** Free-form type hint for pickers. Not enforced; the schema enforces. */
  readonly type?: string
  /** Sample value for previews and documentation. */
  readonly example?: unknown
  /** Default true. A variable declared optional resolves to empty text. */
  readonly required?: boolean
  /** Used when the value is absent. Implies the variable is not required. */
  readonly default?: unknown
}

export interface TemplateConfig<TSchema extends StandardSchema = StandardSchema> {
  readonly id?: string
  readonly version?: string | number
  readonly source: TemplateSource
  /** Any Standard Schema validator. Optional (spec 17.4). */
  readonly schema?: TSchema
  /** The application's meaning of Markdown (spec 5.1). Defaults to GFM. */
  readonly preset?: MarkdownPreset
  /** Extensions layered on top of the preset. */
  readonly extensions?: readonly MarkdownExtension[]
  readonly variables?: Readonly<Record<string, TemplateVariableMeta>>
  readonly formatters?: Readonly<Record<string, TemplateFormatter>>
  readonly defaultLocale?: string
  readonly localeFallback?: LocaleFallbackPolicy
  /** IANA time zone for date formatting. Defaults to `UTC` for determinism. */
  readonly timeZone?: string
}

export interface TemplateResolveOptions {
  readonly locale?: string
  readonly timeZone?: string
  /** Per-call formatters, layered over the template's own. */
  readonly formatters?: Readonly<Record<string, TemplateFormatter>>
  /**
   * Keep the *authored* template source on the resolved document. Off by
   * default: after interpolation the tree no longer matches the template text,
   * and a `source` that disagrees with `tree` is a trap (spec 4.1).
   */
  readonly retainSource?: boolean
}

/** Discriminated resolution result (spec 8.7). */
export type TemplateResult =
  | {
      readonly ok: true
      readonly document: MarkdownDocument
      readonly resolvedLocale?: string
      readonly diagnostics: readonly MarkdownDiagnostic[]
    }
  | {
      readonly ok: false
      readonly document?: undefined
      readonly diagnostics: readonly MarkdownDiagnostic[]
    }

/** Where a placeholder sits in the document. */
export type TemplatePlaceholderContext =
  | 'text'
  | 'link-destination'
  | 'image-destination'
  | 'image-alt'
  | 'title'
  | 'html'
  | 'code'

export interface TemplatePlaceholderInfo {
  readonly path: string
  readonly formatter?: string
  readonly argument?: string
  readonly context: TemplatePlaceholderContext
  /** Which authored source this occurrence came from. */
  readonly locale?: string
  readonly range?: SourceRange
}

export interface TemplateVariableInfo extends TemplateVariableMeta {
  readonly path: string
  readonly required: boolean
  /** Formatter names used with this variable across every authored source. */
  readonly formatters: readonly string[]
  /** Locales whose source mentions this variable. */
  readonly locales: readonly string[]
  readonly occurrences: number
  /** True when only `variables` metadata declares it; no placeholder uses it. */
  readonly declaredOnly: boolean
}

/** What `.inspect()` reports (spec 8.6, 8.9, 8.19). */
export interface TemplateInspection {
  readonly id?: string
  readonly version?: string | number
  readonly profile: string
  readonly locales: readonly string[]
  readonly defaultLocale?: string
  readonly localeFallback: LocaleFallbackPolicy
  readonly variables: readonly TemplateVariableInfo[]
  readonly placeholders: readonly TemplatePlaceholderInfo[]
  readonly formatters: readonly string[]
  /** Problems visible without data: bad paths, partial URLs, unknown formatters. */
  readonly diagnostics: readonly MarkdownDiagnostic[]
}

/** The template object (spec 8.6). */
export interface MarkdownTemplate<TData = TemplateData> {
  readonly id?: string
  readonly version?: string | number
  readonly defaultLocale?: string
  /**
   * Resolves data into a document. Synchronous by contract: a future async
   * capability gets its own `resolveAsync` rather than making this return a
   * Promise conditionally (spec 17.6).
   */
  resolve(data: TData, options?: TemplateResolveOptions): TemplateResult
  inspect(): TemplateInspection
  source(options?: { readonly locale?: string }): string
}

/** Data type implied by a config: its schema's output, else a plain record. */
export type TemplateDataOf<TConfig> = TConfig extends { readonly schema: infer TSchema }
  ? [InferSchemaOutput<TSchema>] extends [never]
    ? TemplateData
    : InferSchemaOutput<TSchema>
  : TemplateData
