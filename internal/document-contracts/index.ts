/**
 * MarkdownDocument (CORE-02) — the compiled representation the three packages
 * exchange.
 *
 * Rules that make this safe to pass across package and process boundaries:
 *   - JSON-serializable: no React elements, no Lexical instances, no closures,
 *     no application service references.
 *   - `tree` is authoritative for processing. `source` is optional and kept
 *     only for preservation and debugging.
 *   - source positions are retained when the parser supplies them.
 */

import type { MarkdownDiagnostic } from '../diagnostics/index.js'

/**
 * Structural mdast. Typed loosely on purpose: pinning `mdast`'s own types here
 * would force every consumer of the template package to install them. The
 * renderer narrows to the real mdast types internally.
 */
export interface MarkdownNode {
  type: string
  children?: MarkdownNode[]
  value?: string
  position?: {
    start: { line: number; column: number; offset?: number }
    end: { line: number; column: number; offset?: number }
  }
  [key: string]: unknown
}

export interface MarkdownRoot extends MarkdownNode {
  type: 'root'
  children: MarkdownNode[]
}

/** Bumped only on a breaking change to the document shape. */
export const DOCUMENT_CONTRACT_VERSION = 1 as const
export type DocumentContractVersion = typeof DOCUMENT_CONTRACT_VERSION

export interface MarkdownDocument {
  readonly contractVersion: DocumentContractVersion
  /** `commonmark`, `gfm`, or an application-defined profile name. */
  readonly profile: string
  /** Authored source, when retained. The tree stays authoritative. */
  readonly source?: string
  readonly tree: MarkdownRoot
  readonly diagnostics: readonly MarkdownDiagnostic[]
}

export function isMarkdownDocument(value: unknown): value is MarkdownDocument {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<MarkdownDocument>
  return (
    candidate.contractVersion === DOCUMENT_CONTRACT_VERSION &&
    typeof candidate.profile === 'string' &&
    typeof candidate.tree === 'object' &&
    candidate.tree !== null &&
    (candidate.tree as MarkdownRoot).type === 'root' &&
    Array.isArray(candidate.diagnostics)
  )
}

export function createMarkdownDocument(init: {
  profile: string
  tree: MarkdownRoot
  source?: string
  diagnostics?: readonly MarkdownDiagnostic[]
}): MarkdownDocument {
  const base = {
    contractVersion: DOCUMENT_CONTRACT_VERSION,
    profile: init.profile,
    tree: init.tree,
    diagnostics: init.diagnostics ?? [],
  } as const
  return init.source === undefined ? base : { ...base, source: init.source }
}

/**
 * Input union for `<Markdown>` (spec 4.3). String and document are mutually
 * exclusive so no caller has to learn which one wins.
 */
export type MarkdownInput =
  | { children: string; document?: never }
  | { children?: never; document: MarkdownDocument }
