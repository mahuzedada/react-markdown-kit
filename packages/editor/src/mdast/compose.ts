/**
 * The writer — mdast blocks back to Markdown **source**, not to normalised
 * Markdown (spec 7.9).
 *
 * A generic parse/serialize round trip is not sufficient: every construct the
 * serializer normalises (setext headings, `~~~` fences, `***` rules, `_em_`,
 * entity references, runs of blank lines) would change on save even though the
 * user never touched it. So the writer works region by region:
 *
 *   1. align the blocks coming out of the editor against the blocks that were
 *      imported, by canonical key (an LCS, so inserts and deletes do not shift
 *      everything after them);
 *   2. a block that aligned is written back as the **original source bytes**,
 *      including the original inter-block gap;
 *   3. only a run of blocks with no counterpart is serialized from mdast.
 *
 * That is the dirty-region tracking spec 7.9 asks for, and it is why editing a
 * paragraph cannot disturb the opaque HTML block next to it (docs/AUDIT.md G3).
 */
import { toMarkdown, type Options as ToMarkdownOptions } from 'mdast-util-to-markdown'
import type { Root as MdastRoot } from 'mdast'
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'

export interface OriginalBlock {
  readonly key: string
  readonly start: number
  readonly end: number
}

export interface OriginalSource {
  readonly source: string
  readonly blocks: readonly OriginalBlock[]
}

export interface OutgoingBlock {
  readonly node: MarkdownNode
  readonly key: string
  /** Verbatim bytes for an opaque block; always preferred over serializing. */
  readonly raw: string | null
}

/** Serializer options, kept identical to the renderer's `documentToMarkdown`. */
export const SERIALIZE_OPTIONS: ToMarkdownOptions = {
  bullet: '-',
  emphasis: '_',
  strong: '*',
  fence: '`',
  fences: true,
  rule: '-',
}

export function serializeTree(
  tree: MarkdownRoot,
  toMarkdownExtensions: readonly unknown[],
): string {
  return toMarkdown(tree as unknown as MdastRoot, {
    ...SERIALIZE_OPTIONS,
    extensions: toMarkdownExtensions as ToMarkdownOptions['extensions'],
  })
}

interface Part {
  text: string
  start?: number
  end?: number
  originalIndex?: number
}

export function composeMarkdown(
  blocks: readonly OutgoingBlock[],
  original: OriginalSource | null,
  toMarkdownExtensions: readonly unknown[],
): string {
  if (blocks.length === 0) return ''

  const alignment = original === null ? new Map<number, number>() : alignBlocks(blocks, original.blocks)
  const source = original?.source ?? ''

  const parts: Part[] = []
  let pending: OutgoingBlock[] = []

  const flushPending = (): void => {
    if (pending.length === 0) return
    parts.push({ text: serializeRun(pending, toMarkdownExtensions) })
    pending = []
  }

  for (const [index, block] of blocks.entries()) {
    const originalIndex = alignment.get(index)
    const match = originalIndex === undefined ? undefined : original?.blocks[originalIndex]
    if (match === undefined || originalIndex === undefined) {
      pending.push(block)
      continue
    }
    flushPending()
    parts.push({
      text: source.slice(match.start, match.end),
      start: match.start,
      end: match.end,
      originalIndex,
    })
  }
  flushPending()

  let out = ''
  let previous: Part | undefined
  for (const [index, part] of parts.entries()) {
    if (index === 0) {
      out += part.start === undefined ? '' : source.slice(0, part.start)
    } else if (adjacentInOriginal(previous, part)) {
      out += source.slice(previous?.end ?? 0, part.start)
    } else {
      out += '\n\n'
    }
    out += part.text
    previous = part
  }
  out += previous?.end === undefined ? '\n' : source.slice(previous.end)
  return out
}

function adjacentInOriginal(previous: Part | undefined, part: Part): previous is Part {
  return (
    previous !== undefined &&
    previous.end !== undefined &&
    previous.originalIndex !== undefined &&
    part.start !== undefined &&
    part.originalIndex === previous.originalIndex + 1
  )
}

/** A run of new/edited blocks is serialized together so block joining is the
 * serializer's own (two lists in a row stay two lists). */
function serializeRun(blocks: readonly OutgoingBlock[], toMarkdownExtensions: readonly unknown[]): string {
  const parts: string[] = []
  let buffer: MarkdownNode[] = []
  const flush = (): void => {
    if (buffer.length === 0) return
    const tree: MarkdownRoot = { type: 'root', children: buffer }
    parts.push(trimTrailingNewlines(serializeTree(tree, toMarkdownExtensions)))
    buffer = []
  }
  for (const block of blocks) {
    if (block.raw !== null) {
      flush()
      parts.push(trimTrailingNewlines(block.raw))
      continue
    }
    buffer.push(block.node)
  }
  flush()
  return parts.join('\n\n')
}

function trimTrailingNewlines(value: string): string {
  return value.replace(/\n+$/, '')
}

/**
 * Longest common subsequence over canonical keys. Returns outgoing index ->
 * original index for every block that survived unchanged.
 */
function alignBlocks(
  blocks: readonly OutgoingBlock[],
  original: readonly OriginalBlock[],
): Map<number, number> {
  const rows = blocks.length
  const columns = original.length
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(columns + 1).fill(0))
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      const row = table[i] as number[]
      const nextRow = table[i + 1] as number[]
      row[j] =
        blocks[i]?.key === original[j]?.key
          ? (nextRow[j + 1] as number) + 1
          : Math.max(nextRow[j] as number, row[j + 1] as number)
    }
  }
  const matches = new Map<number, number>()
  let i = 0
  let j = 0
  while (i < rows && j < columns) {
    if (blocks[i]?.key === original[j]?.key) {
      matches.set(i, j)
      i += 1
      j += 1
      continue
    }
    const nextRow = table[i + 1] as number[]
    const row = table[i] as number[]
    if ((nextRow[j] as number) >= (row[j + 1] as number)) i += 1
    else j += 1
  }
  return matches
}
