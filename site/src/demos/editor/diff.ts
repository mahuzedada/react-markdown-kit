/*
 * A line diff for the round-trip panel (docs/SEO_WORKPLAN.md, milestone D
 * item 5). Longest common subsequence over lines, written here so the demo
 * adds no dependency. The panel compares two texts that are equal in the
 * normal case, so the common prefix and suffix are trimmed first and the
 * quadratic part usually has nothing left to do.
 */

export type DiffKind = 'same' | 'removed' | 'added'

export interface DiffRow {
  readonly kind: DiffKind
  readonly text: string
  /** 1-based line number in the left text; absent on an added line. */
  readonly left: number | undefined
  /** 1-based line number in the right text; absent on a removed line. */
  readonly right: number | undefined
}

/**
 * Above this many cells the table is not worth building. Two documents that
 * differ over more than a thousand lines each are reported as one replaced
 * block instead, which is all a reader would take from the alignment anyway.
 */
const MAX_CELLS = 1_000_000

const lines = (text: string): string[] => text.split('\n')

const same = (text: string, left: number, right: number): DiffRow => ({ kind: 'same', text, left, right })
const removed = (text: string, left: number): DiffRow => ({ kind: 'removed', text, left, right: undefined })
const added = (text: string, right: number): DiffRow => ({ kind: 'added', text, left: undefined, right })

/** Every line of both texts, aligned: shared lines once, the rest as removed then added. */
export function diffLines(before: string, after: string): DiffRow[] {
  const left = lines(before)
  const right = lines(after)

  let head = 0
  while (head < left.length && head < right.length && left[head] === right[head]) head += 1

  let tail = 0
  while (
    tail < left.length - head &&
    tail < right.length - head &&
    left[left.length - 1 - tail] === right[right.length - 1 - tail]
  ) {
    tail += 1
  }

  const rows: DiffRow[] = []
  for (let index = 0; index < head; index += 1) rows.push(same(left[index] ?? '', index + 1, index + 1))
  rows.push(...align(left.slice(head, left.length - tail), right.slice(head, right.length - tail), head))
  for (let index = left.length - tail; index < left.length; index += 1) {
    rows.push(same(left[index] ?? '', index + 1, index + 1 - left.length + right.length))
  }
  return rows
}

/** The middle of the two texts, where they no longer agree. `offset` is the trimmed prefix. */
function align(left: readonly string[], right: readonly string[], offset: number): DiffRow[] {
  if (left.length === 0 || right.length === 0 || (left.length + 1) * (right.length + 1) > MAX_CELLS) {
    return [
      ...left.map((text, index) => removed(text, offset + index + 1)),
      ...right.map((text, index) => added(text, offset + index + 1)),
    ]
  }

  const width = right.length + 1
  const table = new Uint32Array((left.length + 1) * width)
  const cell = (row: number, column: number): number => table[row * width + column] ?? 0
  for (let row = left.length - 1; row >= 0; row -= 1) {
    for (let column = right.length - 1; column >= 0; column -= 1) {
      table[row * width + column] =
        left[row] === right[column]
          ? cell(row + 1, column + 1) + 1
          : Math.max(cell(row + 1, column), cell(row, column + 1))
    }
  }

  const rows: DiffRow[] = []
  let row = 0
  let column = 0
  while (row < left.length && column < right.length) {
    if (left[row] === right[column]) {
      rows.push(same(left[row] ?? '', offset + row + 1, offset + column + 1))
      row += 1
      column += 1
    } else if (cell(row + 1, column) >= cell(row, column + 1)) {
      rows.push(removed(left[row] ?? '', offset + row + 1))
      row += 1
    } else {
      rows.push(added(right[column] ?? '', offset + column + 1))
      column += 1
    }
  }
  while (row < left.length) {
    rows.push(removed(left[row] ?? '', offset + row + 1))
    row += 1
  }
  while (column < right.length) {
    rows.push(added(right[column] ?? '', offset + column + 1))
    column += 1
  }
  return rows
}

export interface DiffSummary {
  readonly removed: number
  readonly added: number
}

export function summarize(rows: readonly DiffRow[]): DiffSummary {
  let removedCount = 0
  let addedCount = 0
  for (const row of rows) {
    if (row.kind === 'removed') removedCount += 1
    if (row.kind === 'added') addedCount += 1
  }
  return { removed: removedCount, added: addedCount }
}

/**
 * The changed runs with `context` unchanged lines around each, so a long
 * document shows only what moved. Runs that overlap are merged.
 */
export function hunks(rows: readonly DiffRow[], context = 2): DiffRow[][] {
  const changed = rows.flatMap((row, index) => (row.kind === 'same' ? [] : [index]))
  if (changed.length === 0) return []

  const groups: DiffRow[][] = []
  let start = Math.max(0, (changed[0] ?? 0) - context)
  let end = Math.min(rows.length, (changed[0] ?? 0) + context + 1)
  for (const index of changed.slice(1)) {
    if (index - context <= end) {
      end = Math.min(rows.length, index + context + 1)
    } else {
      groups.push(rows.slice(start, end))
      start = Math.max(0, index - context)
      end = Math.min(rows.length, index + context + 1)
    }
  }
  groups.push(rows.slice(start, end))
  return groups
}
