/**
 * `<Markdown>` (RENDER-01, RENDER-02, RENDER-06).
 *
 * No provider, no stylesheet, no account, no design system. The default export
 * and the named export are the same component.
 *
 * This module carries no `"use client"` directive: the renderer must stay
 * usable from a server component and from static server rendering (spec 6.8).
 */
import type { ReactElement } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { unified, type PluggableList } from 'unified'
import remarkRehype, { type Options as RemarkRehypeOptions } from 'remark-rehype'
import type { Root as HastRoot } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import { VFile } from 'vfile'

import type { MarkdownDocument, MarkdownRoot } from '@internal/document-contracts/index.js'
import { isMarkdownDocument } from '@internal/document-contracts/index.js'
import { MarkdownConfigurationError } from '@internal/diagnostics/index.js'
import { compileMarkdown, resolveExtensions, type MarkdownCompileOptions } from './compile.js'
import { applyPolicy } from './policy.js'
import { applyClassNames, type RendererClassNames } from './class-names.js'
import type { MarkdownComponents, MarkdownExtension, MarkdownPolicy, MarkdownPreset } from './preset.js'

export interface MarkdownBaseProps {
  readonly preset?: MarkdownPreset
  readonly extensions?: readonly MarkdownExtension[]
  readonly components?: MarkdownComponents

  /** Opt-in class hooks. Absent means no kit classes in the DOM at all. */
  readonly classNames?: RendererClassNames

  // Compatibility / ecosystem escape hatches (spec 5.5)
  readonly remarkPlugins?: PluggableList
  readonly rehypePlugins?: PluggableList
  readonly remarkRehypeOptions?: Readonly<RemarkRehypeOptions>

  // Content policy. Each overrides the preset only when explicitly provided.
  readonly allowedElements?: readonly string[]
  readonly disallowedElements?: readonly string[]
  readonly allowElement?: MarkdownPolicy['allowElement']
  readonly skipHtml?: boolean
  readonly unwrapDisallowed?: boolean
  readonly urlTransform?: MarkdownPolicy['urlTransform']
}

/** String and document are mutually exclusive; there is no "which wins" rule. */
export type MarkdownProps = MarkdownBaseProps &
  ({ children: string; document?: never } | { children?: never; document: MarkdownDocument })

export function Markdown(props: MarkdownProps): ReactElement {
  const { children, document: providedDocument } = props

  if (children !== undefined && providedDocument !== undefined) {
    throw new MarkdownConfigurationError(
      'INPUT_AMBIGUOUS',
      'Pass either Markdown source as children or a compiled document, not both.',
    )
  }
  if (providedDocument !== undefined && !isMarkdownDocument(providedDocument)) {
    throw new MarkdownConfigurationError(
      'DOCUMENT_INVALID',
      'document must be a MarkdownDocument produced by compileMarkdown() or template.resolve().',
    )
  }

  const compileOptions: MarkdownCompileOptions = {
    ...(props.preset === undefined ? {} : { preset: props.preset }),
    ...(props.extensions === undefined ? {} : { extensions: props.extensions }),
  }

  // A remark plugin such as `remark-gfm` changes the *dialect*, not the tree:
  // it registers micromark and mdast-util extensions on processor data and
  // relies on the parser reading them back. Parsing happens in
  // `compileMarkdown`, before the render pipeline exists, so those
  // registrations are collected here and handed to the parser as an ordinary
  // syntax extension. Without this, `remarkPlugins={[remarkGfm]}` would
  // silently render plain CommonMark (spec 6.5 requires the plugin route and
  // the native `gfm()` extension to agree).
  const parserExtension = collectParserExtension([
    ...((props.preset?.remarkPlugins ?? []) as PluggableList),
    ...(props.remarkPlugins ?? []),
  ])
  const parseOptions: MarkdownCompileOptions =
    parserExtension === undefined
      ? compileOptions
      : { ...compileOptions, extensions: [...(compileOptions.extensions ?? []), parserExtension] }

  // A document we just compiled is private to this render, so it needs no
  // defensive copy. Only a caller-supplied document does.
  const document =
    providedDocument ?? compileMarkdown(typeof children === 'string' ? children : '', parseOptions)

  return renderDocument(document, props, compileOptions, providedDocument !== undefined)
}

/**
 * Runs the remark plugins' attachers on a throwaway processor purely to read
 * back the parser extensions they registered. Returns undefined when they
 * register none, so the common case adds no extension.
 */
function collectParserExtension(plugins: PluggableList): MarkdownExtension | undefined {
  if (plugins.length === 0) return undefined
  // `freeze()` is what runs the attachers; `use()` alone only records them.
  const data = unified().use(plugins).freeze().data() as {
    micromarkExtensions?: readonly unknown[]
    fromMarkdownExtensions?: readonly unknown[]
  }
  const micromarkExtensions = data.micromarkExtensions ?? []
  const fromMarkdownExtensions = data.fromMarkdownExtensions ?? []
  if (micromarkExtensions.length === 0 && fromMarkdownExtensions.length === 0) return undefined
  return {
    name: 'remark-plugin-syntax',
    version: '1',
    contractVersion: 1,
    capabilities: { syntax: { micromarkExtensions, fromMarkdownExtensions } },
  }
}

function renderDocument(
  document: MarkdownDocument,
  props: MarkdownBaseProps,
  compileOptions: MarkdownCompileOptions,
  isCallerOwned: boolean,
): ReactElement {
  const { extensions } = resolveExtensions(compileOptions)
  const preset = props.preset

  const rendererAdapters = extensions.flatMap((extension) =>
    extension.capabilities?.renderer === undefined ? [] : [extension.capabilities.renderer],
  )

  // Components: preset first, then extension contributions, then local props.
  // Local keys shallow-override matching keys (spec 6.3 rule 3).
  const components: Record<string, unknown> = {
    ...(preset?.components ?? {}),
    ...Object.assign({}, ...rendererAdapters.map((adapter) => adapter.components ?? {})),
    ...(props.components ?? {}),
  }

  // Policy: a locally provided key overrides the preset, an absent one inherits
  // (spec 6.3 rule 4).
  const policy: MarkdownPolicy = {
    ...(preset?.policy ?? {}),
    ...definedOnly({
      allowedElements: props.allowedElements,
      disallowedElements: props.disallowedElements,
      allowElement: props.allowElement,
      skipHtml: props.skipHtml,
      unwrapDisallowed: props.unwrapDisallowed,
      urlTransform: props.urlTransform,
    }),
  }

  const remarkPlugins: PluggableList = [
    ...((preset?.remarkPlugins ?? []) as PluggableList),
    ...(props.remarkPlugins ?? []),
  ]
  const rehypePlugins: PluggableList = [
    ...((preset?.rehypePlugins ?? []) as PluggableList),
    ...Object.assign([], ...rendererAdapters.map((adapter) => adapter.rehypePlugins ?? [])),
    ...(props.rehypePlugins ?? []),
  ]
  const remarkRehypeOptions: RemarkRehypeOptions = {
    ...(preset?.remarkRehypeOptions as RemarkRehypeOptions | undefined),
    ...props.remarkRehypeOptions,
    // Raw HTML reaches the tree as `raw` nodes so the policy can decide, rather
    // than being silently dropped by the mdast->hast step.
    allowDangerousHtml: true,
  }

  const handlers = Object.assign({}, ...rendererAdapters.map((adapter) => adapter.handlers ?? {}))

  const processor = unified()
    .use(remarkPlugins)
    .use(remarkRehype, {
      ...remarkRehypeOptions,
      handlers: { ...(handlers as object), ...((remarkRehypeOptions.handlers ?? {}) as object) },
    })
    .use(rehypePlugins)

  const file = new VFile()
  if (document.source !== undefined) file.value = document.source

  // A precompiled document still runs every transform and the policy: passing
  // a document object is not a security bypass (spec 10.1). The transforms
  // mutate in place, so a document the caller still holds is copied first.
  const mdast = isCallerOwned ? structuredCloneTree(document.tree) : document.tree
  const hast = processor.runSync(mdast as unknown as MdastRoot, file) as unknown as HastRoot

  applyPolicy(hast, { policy })
  applyClassNames(hast, props.classNames)

  return toJsxRuntime(hast, {
    Fragment,
    components: components as never,
    ignoreInvalidStyle: true,
    jsx: jsx as never,
    jsxs: jsxs as never,
    passKeys: true,
    passNode: true,
  })
}

/** The caller's document must not be mutated by rendering it. */
function structuredCloneTree(tree: MarkdownRoot): MarkdownRoot {
  return typeof structuredClone === 'function'
    ? (structuredClone(tree) as MarkdownRoot)
    : (JSON.parse(JSON.stringify(tree)) as MarkdownRoot)
}

/**
 * Drops keys whose value is `undefined` so that "not provided" inherits from
 * the preset instead of overwriting it with undefined (spec 6.3 rule 4).
 * The return type strips `undefined` so this composes under
 * `exactOptionalPropertyTypes`.
 */
function definedOnly<T extends object>(value: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const result: { [K in keyof T]?: Exclude<T[K], undefined> } = {}
  for (const key of Object.keys(value) as (keyof T)[]) {
    const entry = value[key]
    if (entry !== undefined) result[key] = entry as Exclude<T[keyof T], undefined>
  }
  return result
}

export default Markdown
