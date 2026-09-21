/**
 * Timing and inspection helpers for the status strip and the HTML and Tree
 * tabs. Numbers are medians measured in the reader's own browser, labelled
 * as such, and never presented as a benchmark.
 */
import type { MarkdownRoot } from '@react-markdown-kit/renderer'

export function median(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function timeMedian(fn: () => void, runs: number): number {
  const samples: number[] = []
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now()
    fn()
    samples.push(performance.now() - start)
  }
  return median(samples)
}

export function formatMs(value: number): string {
  return value < 10 ? `${value.toFixed(2)} ms` : `${value.toFixed(1)} ms`
}

export function formatBytes(chars: number): string {
  return chars < 1024 ? `${chars} B` : `${(chars / 1024).toFixed(1)} KB`
}

export function wordCount(text: string): number {
  const matches = text.match(/\S+/g)
  return matches === null ? 0 : matches.length
}

const BLOCK_TAGS = /<(?=(?:p|h[1-6]|ul|ol|li|table|thead|tbody|tr|pre|blockquote|hr|section|div)\b)/g

/** Line breaks before block-level tags, so the HTML tab reads top to bottom. */
export function prettyHtml(html: string): string {
  return html.replace(BLOCK_TAGS, '\n<').replace(/^\n/, '')
}

/** The mdast tree without `position`, which triples the size and says little. */
export function stripPositions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripPositions)
  if (node !== null && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
      if (key === 'position') continue
      out[key] = stripPositions(value)
    }
    return out
  }
  return node
}

export function treeJson(tree: MarkdownRoot, keepPositions: boolean): string {
  return JSON.stringify(keepPositions ? tree : stripPositions(tree), null, 2)
}
