/**
 * `compileMarkdown` (RENDER-03) — Markdown source to a `MarkdownDocument`.
 *
 * Deterministic for the same source and configuration, with no network access.
 * Content problems become diagnostics on the returned document; configuration
 * mistakes throw `MarkdownConfigurationError` so a caller never has to
 * try/catch ordinary content.
 */
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Root as MdastRoot } from 'mdast'
import {
  createMarkdownDocument,
  type MarkdownDocument,
  type MarkdownRoot,
} from '@internal/document-contracts/index.js'
import {
  MarkdownConfigurationError,
  type MarkdownDiagnostic,
} from '@internal/diagnostics/index.js'
import { isMarkdownPreset, type MarkdownExtension, type MarkdownPreset } from './preset.js'

export interface MarkdownCompileOptions {
  readonly preset?: MarkdownPreset
  readonly extensions?: readonly MarkdownExtension[]
  /** Keep the authored source on the document. Default true. */
  readonly retainSource?: boolean
  /** Overrides the profile recorded on the document. */
  readonly profile?: string
}

/** Resolves preset + local extensions into the one list the parser will use. */
export function resolveExtensions(options: MarkdownCompileOptions | undefined): {
  extensions: readonly MarkdownExtension[]
  profile: string
} {
  const preset = options?.preset
  if (preset !== undefined && !isMarkdownPreset(preset)) {
    throw new MarkdownConfigurationError(
      'PRESET_INVALID',
      'preset must be created with defineMarkdownPreset() from the renderer or template package.',
    )
  }
  // Local extensions append after preset extensions; a local extension with the
  // same name replaces the preset's in place (spec 6.3).
  let extensions = preset?.extensions ?? []
  for (const extension of options?.extensions ?? []) {
    const index = extensions.findIndex((existing) => existing.name === extension.name)
    extensions = index === -1
      ? [...extensions, extension]
      : extensions.map((existing, at) => (at === index ? extension : existing))
  }
  const profile =
    options?.profile ??
    preset?.profile ??
    (extensions.some((extension) => extension.name === 'gfm') ? 'gfm' : 'commonmark')
  return { extensions, profile }
}

export function compileMarkdown(
  source: string,
  options?: MarkdownCompileOptions,
): MarkdownDocument {
  if (typeof source !== 'string') {
    throw new MarkdownConfigurationError('SOURCE_NOT_STRING', 'compileMarkdown expects a Markdown string.')
  }
  const { extensions, profile } = resolveExtensions(options)
  const diagnostics: MarkdownDiagnostic[] = []
  const report = (diagnostic: MarkdownDiagnostic): void => {
    diagnostics.push(diagnostic)
  }

  const micromarkExtensions = extensions.flatMap(
    (extension) => extension.capabilities?.syntax?.micromarkExtensions ?? [],
  )
  const mdastExtensions = extensions.flatMap(
    (extension) => extension.capabilities?.syntax?.fromMarkdownExtensions ?? [],
  )

  let tree = fromMarkdown(source, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- micromark's extension type is structural
    extensions: micromarkExtensions as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mdastExtensions: mdastExtensions as any,
  }) as MdastRoot as unknown as MarkdownRoot

  for (const extension of extensions) {
    const transform = extension.capabilities?.syntax?.transform
    if (transform === undefined) continue
    tree = transform(tree, { profile, report, extensions, source })
  }

  return createMarkdownDocument({
    profile,
    tree,
    diagnostics,
    ...(options?.retainSource === false ? {} : { source }),
  })
}

/**
 * Serializes a document back to Markdown. Round-trip stable for every construct
 * the configured extensions understand.
 */
export async function documentToMarkdown(
  document: MarkdownDocument,
  options?: { readonly preset?: MarkdownPreset; readonly extensions?: readonly MarkdownExtension[] },
): Promise<string> {
  const { toMarkdown } = await import('mdast-util-to-markdown')
  const { extensions } = resolveExtensions(options)
  const toMarkdownExtensions = extensions.flatMap(
    (extension) => extension.capabilities?.syntax?.toMarkdownExtensions ?? [],
  )
  return toMarkdown(document.tree as unknown as MdastRoot, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extensions: toMarkdownExtensions as any,
    bullet: '-',
    emphasis: '_',
    strong: '*',
    fence: '`',
    fences: true,
    rule: '-',
  })
}
