/**
 * Preset and extension contracts (CORE-04, CORE-05).
 *
 * These types are **structural**. A preset built by the renderer package and a
 * preset built by the template package are the same shape and are accepted by
 * both, which is what lets the kit stay three packages with no shared runtime
 * core (spec 5.2).
 */

import type { MarkdownDiagnostic } from '../diagnostics/index.js'
import type { MarkdownNode, MarkdownRoot } from '../document-contracts/index.js'

/** Bumped when the adapter shapes below change incompatibly. */
export const EXTENSION_CONTRACT_VERSION = 1 as const

/**
 * Syntax adapter: how an extension changes what Markdown *means*.
 * Shared by the renderer, the template engine and the editor, so all three
 * agree on the dialect.
 */
export interface SyntaxAdapter {
  /** micromark extensions, applied at parse time. */
  readonly micromarkExtensions?: readonly unknown[]
  /** mdast-util extensions used while building the tree. */
  readonly fromMarkdownExtensions?: readonly unknown[]
  /** mdast-util extensions used while serializing back to Markdown. */
  readonly toMarkdownExtensions?: readonly unknown[]
  /** Node types this extension introduces, for preservation and validation. */
  readonly nodeTypes?: readonly string[]
  /** Runs over the tree after parsing. Must return a tree, may add diagnostics. */
  readonly transform?: (tree: MarkdownRoot, context: SyntaxTransformContext) => MarkdownRoot
}

/** What a syntax transform is told about the compilation it runs in. */
export interface SyntaxTransformContext {
  readonly profile: string
  readonly report: (d: MarkdownDiagnostic) => void
  /**
   * Every extension active in this compilation, in order. A plugin reads its
   * siblings' capabilities here: the template plugin, for one, honours the
   * `template` adapter (literal node types, formatters) of every other one.
   */
  readonly extensions?: readonly MarkdownExtension[]
  /** The authored source, when the compiler retained it. */
  readonly source?: string
}

/**
 * Renderer adapter: how an extension's nodes become React.
 * Typed as unknown-returning so this contract never imports React; the
 * renderer narrows it.
 */
export interface RendererAdapter {
  /** mdast node type -> handler producing a hast node. */
  readonly handlers?: Readonly<Record<string, unknown>>
  /** Component overrides contributed by the extension. */
  readonly components?: Readonly<Record<string, unknown>>
  /** hast transforms, applied after mdast->hast. */
  readonly rehypePlugins?: readonly unknown[]
}

/**
 * Editor adapter: how an extension participates in authoring.
 * Deliberately opaque here. The editor package narrows it, so neither the
 * renderer nor the template package ever loads editor types.
 */
export interface EditorAdapter {
  /** Editor node definitions (Lexical nodes, behind the editor's own adapter). */
  readonly nodes?: readonly unknown[]
  /**
   * Block adapters: how an mdast node type the extension introduces becomes
   * one of its editor nodes and back. Typed by `@react-markdown-kit/editor/lexical`.
   */
  readonly blocks?: readonly unknown[]
  /**
   * Inline adapters: the same for an inline mdast node type (a chip, a mention).
   * Typed by `@react-markdown-kit/editor/lexical`.
   */
  readonly inlines?: readonly unknown[]
  /** Editor plugins / React children mounted inside the editor. */
  readonly plugins?: readonly unknown[]
  /** Toolbar or command contributions. */
  readonly commands?: readonly unknown[]
}

/** Template adapter: how an extension's nodes survive template resolution. */
export interface TemplateAdapter {
  /** Node types whose text content must NOT be scanned for placeholders. */
  readonly literalNodeTypes?: readonly string[]
  /** Formatters contributed by the extension. */
  readonly formatters?: Readonly<Record<string, unknown>>
  /** Runs over the tree after placeholders resolve. */
  readonly transform?: (
    tree: MarkdownRoot,
    context: { readonly report: (d: MarkdownDiagnostic) => void },
  ) => MarkdownRoot
}

export interface MarkdownExtension {
  /** Unique, stable. Used for ordering, replacement and diagnostics. */
  readonly name: string
  readonly version?: string
  readonly contractVersion?: typeof EXTENSION_CONTRACT_VERSION
  readonly capabilities?: {
    readonly syntax?: SyntaxAdapter
    readonly renderer?: RendererAdapter
    readonly editor?: EditorAdapter
    readonly template?: TemplateAdapter
  }
}

/**
 * Content policy, shared so a preset carries security settings across all
 * three packages rather than each one re-declaring them.
 */
export interface MarkdownPolicy {
  readonly allowedElements?: readonly string[]
  readonly disallowedElements?: readonly string[]
  readonly allowElement?: (element: MarkdownNode, index: number, parent: MarkdownNode | undefined) => boolean | undefined
  readonly skipHtml?: boolean
  readonly unwrapDisallowed?: boolean
  readonly urlTransform?: (url: string, key: string, node: MarkdownNode) => string | null | undefined
}

export interface MarkdownPreset {
  readonly kind: 'markdown-preset'
  readonly contractVersion: typeof EXTENSION_CONTRACT_VERSION
  readonly profile: string
  readonly extensions: readonly MarkdownExtension[]
  /** React components, opaque here so the template package never sees React. */
  readonly components?: Readonly<Record<string, unknown>>
  /** Class name overrides, per the styling contract. */
  readonly classNames?: Readonly<Record<string, string>>
  readonly policy?: MarkdownPolicy
  readonly remarkPlugins?: readonly unknown[]
  readonly rehypePlugins?: readonly unknown[]
  readonly remarkRehypeOptions?: Readonly<Record<string, unknown>>
}

export interface DefineMarkdownPresetOptions {
  /** Presets to build on. Applied left to right, before this preset's own fields. */
  readonly extends?: readonly MarkdownPreset[]
  readonly profile?: string
  readonly extensions?: readonly MarkdownExtension[]
  readonly components?: Readonly<Record<string, unknown>>
  readonly classNames?: Readonly<Record<string, string>>
  readonly policy?: MarkdownPolicy
  readonly remarkPlugins?: readonly unknown[]
  readonly rehypePlugins?: readonly unknown[]
  readonly remarkRehypeOptions?: Readonly<Record<string, unknown>>
}

export function isMarkdownPreset(value: unknown): value is MarkdownPreset {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<MarkdownPreset>
  return (
    candidate.kind === 'markdown-preset' &&
    candidate.contractVersion === EXTENSION_CONTRACT_VERSION &&
    typeof candidate.profile === 'string' &&
    Array.isArray(candidate.extensions)
  )
}

/**
 * Merges extension lists by name (spec 6.3 rule 2 and 5).
 *
 * Later wins: a later extension with the same name **replaces** the earlier
 * one in place, keeping the earlier position so ordering stays stable when an
 * application overrides one entry of a shared preset. New names append.
 */
export function mergeExtensions(
  base: readonly MarkdownExtension[],
  next: readonly MarkdownExtension[],
): readonly MarkdownExtension[] {
  const result = [...base]
  for (const extension of next) {
    const index = result.findIndex((existing) => existing.name === extension.name)
    if (index === -1) result.push(extension)
    else result[index] = extension
  }
  return result
}

/**
 * Builds a preset. Shared by `@react-markdown-kit/renderer` and
 * `@react-markdown-kit/template`; both emit this same function so a headless
 * template user never installs the renderer to build one (spec 5.2).
 *
 * Merge rules, deterministic and documented:
 *   1. `extends` presets apply left to right.
 *   2. extensions merge by name, later replacing earlier in place.
 *   3. components and classNames shallow-merge, later winning per key.
 *   4. policy shallow-merges, later winning per explicitly provided key.
 *   5. remark/rehype plugin lists concatenate in order.
 */
export function definePreset(options: DefineMarkdownPresetOptions = {}): MarkdownPreset {
  let extensions: readonly MarkdownExtension[] = []
  let components: Record<string, unknown> = {}
  let classNames: Record<string, string> = {}
  let policy: MarkdownPolicy = {}
  let remarkPlugins: unknown[] = []
  let rehypePlugins: unknown[] = []
  let remarkRehypeOptions: Record<string, unknown> = {}
  let profile: string | undefined

  for (const parent of options.extends ?? []) {
    extensions = mergeExtensions(extensions, parent.extensions)
    components = { ...components, ...(parent.components ?? {}) }
    classNames = { ...classNames, ...(parent.classNames ?? {}) }
    policy = { ...policy, ...(parent.policy ?? {}) }
    remarkPlugins = [...remarkPlugins, ...(parent.remarkPlugins ?? [])]
    rehypePlugins = [...rehypePlugins, ...(parent.rehypePlugins ?? [])]
    remarkRehypeOptions = { ...remarkRehypeOptions, ...(parent.remarkRehypeOptions ?? {}) }
    profile = parent.profile
  }

  extensions = mergeExtensions(extensions, options.extensions ?? [])
  components = { ...components, ...(options.components ?? {}) }
  classNames = { ...classNames, ...(options.classNames ?? {}) }
  policy = { ...policy, ...(options.policy ?? {}) }
  remarkPlugins = [...remarkPlugins, ...(options.remarkPlugins ?? [])]
  rehypePlugins = [...rehypePlugins, ...(options.rehypePlugins ?? [])]
  remarkRehypeOptions = { ...remarkRehypeOptions, ...(options.remarkRehypeOptions ?? {}) }

  return {
    kind: 'markdown-preset',
    contractVersion: EXTENSION_CONTRACT_VERSION,
    profile: options.profile ?? profile ?? inferProfile(extensions),
    extensions,
    components,
    classNames,
    policy,
    remarkPlugins,
    rehypePlugins,
    remarkRehypeOptions,
  }
}

function inferProfile(extensions: readonly MarkdownExtension[]): string {
  return extensions.some((extension) => extension.name === 'gfm') ? 'gfm' : 'commonmark'
}
