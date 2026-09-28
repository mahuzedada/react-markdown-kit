/**
 * Line highlights on a code fence, Slidev's spelling: ` ```ts {1|3-4|all} `.
 * The braces sit in the fence's info string after the language, which
 * GitHub ignores. Each `|`-separated step is `all` (or `*`), or a comma
 * list of line numbers and `a-b` ranges. The first step shows with the
 * block; every later one is one more click.
 */
export type CodeStep = 'all' | readonly (readonly [number, number])[]

const BRACES = /(?:^|\s)\{([^}]*)\}/
const RANGE = /^(\d+)(?:-(\d+))?$/

/** The steps in `meta`; undefined when it has no braces, `invalid` when the braces hold something else. */
export function readCodeSteps(meta: unknown): readonly CodeStep[] | 'invalid' | undefined {
  if (typeof meta !== 'string') return undefined
  const braces = BRACES.exec(meta)
  if (braces === null) return undefined
  const steps = braces[1]!.split('|').map(readStep)
  return steps.some((step) => step === undefined) ? 'invalid' : (steps as CodeStep[])
}

function readStep(text: string): CodeStep | undefined {
  const trimmed = text.trim()
  if (trimmed === 'all' || trimmed === '*') return 'all'
  const ranges: [number, number][] = []
  for (const part of trimmed.split(',')) {
    const match = RANGE.exec(part.trim())
    if (match === null) return undefined
    const start = Number(match[1])
    const end = match[2] === undefined ? start : Number(match[2])
    if (start < 1 || end < start) return undefined
    ranges.push([start, end])
  }
  return ranges
}

/** Whether the one-based `line` is highlighted in `step`. */
export function stepFocuses(step: CodeStep, line: number): boolean {
  return step === 'all' || step.some(([start, end]) => line >= start && line <= end)
}
