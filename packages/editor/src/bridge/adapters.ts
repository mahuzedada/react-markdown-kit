/**
 * Narrows the opaque `editor` capability of every active extension to the
 * types in `../lexical.ts`, once per bridge, and remembers the result so the
 * import bridge, the export bridge and the toolbar read the same resolution.
 */
import type { Klass, LexicalNode } from 'lexical'
import type { MarkdownExtension } from '@internal/extension-contracts/index.js'
import type {
  EditorBlockAdapter,
  EditorCommandContribution,
  EditorInlineAdapter,
  EditorPlugin,
  LexicalEditorAdapter,
} from '../lexical.js'

export type BlockAdapters = ReadonlyMap<string, EditorBlockAdapter>
export type InlineAdapters = ReadonlyMap<string, EditorInlineAdapter>

/** The two adapter maps the bridges consult, keyed by mdast node type. */
export interface NodeAdapters {
  readonly blocks: BlockAdapters
  readonly inlines: InlineAdapters
}

export interface ResolvedAdapter extends NodeAdapters {
  readonly nodes: readonly Klass<LexicalNode>[]
  readonly plugins: readonly EditorPlugin[]
  readonly commands: readonly EditorCommandContribution[]
}

export const NO_ADAPTERS: NodeAdapters = { blocks: new Map(), inlines: new Map() }

export const EMPTY_ADAPTER: ResolvedAdapter = { ...NO_ADAPTERS, nodes: [], plugins: [], commands: [] }

export function resolveAdapter(extensions: readonly MarkdownExtension[]): ResolvedAdapter {
  const nodes: Klass<LexicalNode>[] = []
  const blocks = new Map<string, EditorBlockAdapter>()
  const inlines = new Map<string, EditorInlineAdapter>()
  const plugins: EditorPlugin[] = []
  const commands: EditorCommandContribution[] = []
  for (const extension of extensions) {
    const adapter = extension.capabilities?.editor as LexicalEditorAdapter | undefined
    if (adapter === undefined) continue
    nodes.push(...(adapter.nodes ?? []))
    for (const block of adapter.blocks ?? []) blocks.set(block.type, block)
    for (const inline of adapter.inlines ?? []) inlines.set(inline.type, inline)
    plugins.push(...(adapter.plugins ?? []))
    commands.push(...(adapter.commands ?? []))
  }
  return { nodes, blocks, inlines, plugins, commands }
}

/** The block adapter that owns `node`, if any. */
export function blockAdapterFor(node: LexicalNode, blocks: BlockAdapters): EditorBlockAdapter | undefined {
  if (blocks.size === 0) return undefined
  for (const adapter of blocks.values()) if (adapter.matches(node)) return adapter
  return undefined
}

/** The inline adapter that owns `node`, if any. */
export function inlineAdapterFor(node: LexicalNode, inlines: InlineAdapters): EditorInlineAdapter | undefined {
  if (inlines.size === 0) return undefined
  for (const adapter of inlines.values()) if (adapter.matches(node)) return adapter
  return undefined
}

const REGISTRY = new WeakMap<object, ResolvedAdapter>()

export function attachAdapter(bridge: object, adapter: ResolvedAdapter): void {
  REGISTRY.set(bridge, adapter)
}

export function adapterOf(bridge: object): ResolvedAdapter {
  return REGISTRY.get(bridge) ?? EMPTY_ADAPTER
}
