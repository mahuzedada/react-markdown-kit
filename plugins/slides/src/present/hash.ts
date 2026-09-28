/**
 * Deep links. With `hashRouting` the deck reads `#3`, `#3.2` (slide 3,
 * two steps revealed), `#intro` or `#slide-intro` on mount (a number past
 * the last slide is tried as a name, so `<!-- name: 2024 -->` links too) and writes `#3`
 * or `#3.2` as it moves, through `replaceState` so the back button is not
 * filled with slides. Every browser API is checked before use; on the
 * server both functions are inert.
 */
export interface HashPosition {
  /** Zero-based */
  readonly index: number
  readonly fragment: number
}

export function currentHash(): string {
  return typeof location === 'undefined' ? '' : location.hash
}

function decode(fragment: string): string {
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
}

/** Where a hash points, given each slide's `name` (undefined when unnamed). */
export function positionFromHash(hash: string, names: readonly (string | undefined)[]): HashPosition | undefined {
  const fragment = decode(hash.replace(/^#/, ''))
  if (fragment === '') return undefined
  const numbered = /^(\d+)(?:\.(\d+))?$/.exec(fragment)
  if (numbered !== null) {
    const index = Number(numbered[1]) - 1
    if (index >= 0 && index < names.length) return { index, fragment: Number(numbered[2] ?? 0) }
  }
  const name = fragment.startsWith('slide-') ? fragment.slice('slide-'.length) : fragment
  const index = names.indexOf(name)
  return index === -1 ? undefined : { index, fragment: 0 }
}

/** The zero-based slide a hash refers to. */
export function slideFromHash(hash: string, names: readonly (string | undefined)[]): number | undefined {
  return positionFromHash(hash, names)?.index
}

export function writeSlideHash(index: number, fragment = 0): void {
  if (typeof history === 'undefined' || typeof location === 'undefined' || typeof history.replaceState !== 'function') return
  const hash = fragment === 0 ? `#${index + 1}` : `#${index + 1}.${fragment}`
  if (location.hash === hash) return
  try {
    history.replaceState(history.state, '', hash)
  } catch {
    // A sandboxed frame or an opaque origin refuses; the deck works without.
  }
}
