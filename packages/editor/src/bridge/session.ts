/**
 * The adapter boundary (spec 10.3, 10.4).
 *
 * Everything Lexical-shaped lives behind this module. Above it the editor deals
 * in Markdown strings and `MarkdownDocument`s; below it there are Lexical
 * nodes. Swapping the editing engine means rewriting this file and the two
 * bridges, and nothing else.
 */
import { createEditor, type LexicalEditor } from 'lexical'
import { createHeadlessEditor } from '@lexical/headless'
import { compileMarkdown } from '@react-markdown-kit/renderer'
import {
  createMarkdownDocument,
  type MarkdownDocument,
  type MarkdownNode,
  type MarkdownRoot,
} from '@internal/document-contracts/index.js'
import type { MarkdownExtension, MarkdownPreset } from '@internal/extension-contracts/index.js'
import type { MarkdownDiagnostic } from '@internal/diagnostics/index.js'
import { rawResolverFor, type RawResolver } from '../mdast/atoms.js'
import { canonicalBlock } from '../mdast/canonical.js'
import { composeMarkdown, serializeTree, type OriginalSource, type OutgoingBlock } from '../mdast/compose.js'
import { $importDocument, indexDocument } from './import.js'
import { $readBlocks } from './export.js'
import { MARKDOWN_NODES } from '../nodes/index.js'
import type { EditorClassNames } from '../class-names.js'
import { buildNodeTheme } from '../nodes/theme.js'
import { adapterOf, attachAdapter, resolveAdapter } from './adapters.js'

export interface BridgeOptions {
  readonly preset?: MarkdownPreset | undefined
  readonly extensions?: readonly MarkdownExtension[] | undefined
  readonly classNames?: EditorClassNames | undefined
  readonly namespace?: string
  /**
   * Builds an editor with no DOM reconciliation. Used by the round-trip tests
   * and by anything that wants Markdown in / Markdown out on a server.
   */
  readonly headless?: boolean
}

/**
 * Markdown in, Markdown out, with no React and no DOM.
 *
 * `LexicalEditor` is absent from this interface on purpose: the engine reaches
 * a caller only through `getNativeEditor()`, typed `unknown`, exactly like
 * `MarkdownEditorInstance` (spec 7.6, 17.2).
 */
export interface MarkdownBridge {
  readonly profile: string
  /** Replaces the document. Returns the diagnostics from parsing. */
  load(source: string): readonly MarkdownDiagnostic[]
  getMarkdown(): string
  getDocument(): MarkdownDocument
  compile(source: string): MarkdownDocument
  /** Node classes registered on the editing engine, for extension diffing. */
  readonly nodeSignature: string
  /**
   * Registers every extension plugin (commands, listeners) on the engine and
   * returns the function that unregisters them. The React hook calls this
   * once per mount and again after `refreshExtensions`; a headless caller that
   * needs extension commands calls it itself.
   */
  registerPlugins(): () => void
  /**
   * Re-reads the extensions' plugins and commands without rebuilding the
   * editor. The dialect (node classes, block and inline adapters) is fixed at
   * creation, so this only takes effect for extensions of the same names with
   * new options: a template extension handed new preview data, a diagram
   * extension handed a new style. Unregister the old plugins first and
   * register again afterwards.
   */
  refreshExtensions(options: Pick<BridgeOptions, 'preset' | 'extensions'>): void
  /**
   * Advanced, implementation-coupled escape hatch with weaker stability
   * guarantees than the rest of this interface.
   */
  getNativeEditor(): unknown
}

/** Package-internal view of a bridge. Never exported from the entry point. */
export function editorOf(bridge: MarkdownBridge): LexicalEditor {
  return bridge.getNativeEditor() as LexicalEditor
}

/** Preset extensions plus local ones, later replacing earlier by name. */
export function resolveEditorExtensions(options: BridgeOptions): {
  extensions: readonly MarkdownExtension[]
  profile: string
} {
  let extensions: readonly MarkdownExtension[] = options.preset?.extensions ?? []
  for (const extension of options.extensions ?? []) {
    const index = extensions.findIndex((existing) => existing.name === extension.name)
    extensions =
      index === -1
        ? [...extensions, extension]
        : extensions.map((existing, at) => (at === index ? extension : existing))
  }
  const profile =
    options.preset?.profile ??
    (extensions.some((extension) => extension.name === 'gfm') ? 'gfm' : 'commonmark')
  return { extensions, profile }
}

export function createMarkdownBridge(options: BridgeOptions): MarkdownBridge {
  const { extensions, profile } = resolveEditorExtensions(options)
  const toMarkdownExtensions = extensions.flatMap(
    (extension) => extension.capabilities?.syntax?.toMarkdownExtensions ?? [],
  )
  // Extensions resolve here rather than at mount, so a changed `extensions`
  // prop is a changed node signature and the editor is rebuilt (audit G9).
  const adapter = resolveAdapter(extensions)
  const nodes = [...MARKDOWN_NODES, ...adapter.nodes]

  const create = options.headless === true ? createHeadlessEditor : createEditor
  const editor = create({
    namespace: options.namespace ?? 'react-markdown-kit',
    nodes,
    theme: buildNodeTheme(options.classNames),
    onError: (error: Error) => {
      throw error
    },
  })

  let original: OriginalSource | null = null
  let diagnostics: readonly MarkdownDiagnostic[] = []

  const compile = (source: string): MarkdownDocument =>
    compileMarkdown(source, {
      ...(options.preset === undefined ? {} : { preset: options.preset }),
      ...(options.extensions === undefined ? {} : { extensions: options.extensions }),
    })

  const load = (source: string): readonly MarkdownDiagnostic[] => {
    const document = compile(source)
    original = indexDocument(document)
    diagnostics = document.diagnostics
    editor.update(
      () => {
        $importDocument(document, adapter)
      },
      // Replacing the document is not an undoable user edit: `documentKey` is
      // the mechanism for switching documents, not Ctrl+Z (spec 7.10).
      { discrete: true, tag: 'history-merge' },
    )
    return diagnostics
  }

  const readOutgoing = (): { blocks: OutgoingBlock[]; raw: RawResolver } => {
    const { blocks, rawByNode } = editor.getEditorState().read(() => $readBlocks(adapter))
    const fallback = rawResolverFor(original?.source)
    const raw: RawResolver = (node: MarkdownNode) => rawByNode.get(node) ?? fallback(node)
    return {
      blocks: blocks.map((block) => ({ ...block, key: canonicalBlock(block, raw) })),
      raw,
    }
  }

  const getMarkdown = (): string =>
    composeMarkdown(readOutgoing().blocks, original, toMarkdownExtensions)

  const getDocument = (): MarkdownDocument => {
    const { blocks } = readOutgoing()
    const tree: MarkdownRoot = { type: 'root', children: blocks.map((block) => block.node) }
    return createMarkdownDocument({ profile, tree, source: getMarkdown(), diagnostics })
  }

  const registerPlugins = (): (() => void) => {
    const unregister = adapterOf(bridge).plugins.flatMap((plugin) => {
      const off = plugin(editor)
      return typeof off === 'function' ? [off] : []
    })
    return () => {
      for (const off of unregister) off()
    }
  }

  const refreshExtensions = (next: Pick<BridgeOptions, 'preset' | 'extensions'>): void => {
    const resolved = resolveAdapter(resolveEditorExtensions(next).extensions)
    // Node classes cannot change on a live editor; adapters and plugins can.
    attachAdapter(bridge, { ...resolved, nodes: adapter.nodes })
  }

  const bridge: MarkdownBridge = {
    profile,
    load,
    getMarkdown,
    getDocument,
    compile,
    nodeSignature: nodes.map((node) => (node as { name?: string }).name ?? 'anon').join(','),
    registerPlugins,
    refreshExtensions,
    getNativeEditor: () => editor,
  }
  attachAdapter(bridge, adapter)
  return bridge
}

/**
 * Sync equivalent of the renderer's async `documentToMarkdown`, kept in step
 * with it by `tests/serializer-parity.test.ts`. The editor needs a synchronous
 * `getMarkdown()`, which an async import cannot provide.
 */
export function serializeDocument(
  document: MarkdownDocument,
  toMarkdownExtensions: readonly unknown[] = [],
): string {
  return serializeTree(document.tree, toMarkdownExtensions)
}
