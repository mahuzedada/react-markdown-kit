/**
 * Deep links. With `hashRouting` the deck reads `#3`, `#intro` or
 * `#slide-intro` on mount and writes `#3` (1-based) as it moves, through
 * `replaceState` so the back button is not filled with slides. Every browser
 * API is checked before use; on the server both functions are inert.
 */
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

/** The zero-based slide a hash refers to, given each slide's `name` (undefined when unnamed). */
export function slideFromHash(hash: string, names: readonly (string | undefined)[]): number | undefined {
  const fragment = decode(hash.replace(/^#/, ''))
  if (fragment === '') return undefined
  if (/^\d+$/.test(fragment)) {
    const index = Number(fragment) - 1
    return index >= 0 && index < names.length ? index : undefined
  }
  const name = fragment.startsWith('slide-') ? fragment.slice('slide-'.length) : fragment
  const index = names.indexOf(name)
  return index === -1 ? undefined : index
}

export function writeSlideHash(index: number): void {
  if (typeof history === 'undefined' || typeof location === 'undefined' || typeof history.replaceState !== 'function') return
  const hash = `#${index + 1}`
  if (location.hash === hash) return
  try {
    history.replaceState(history.state, '', hash)
  } catch {
    // A sandboxed frame or an opaque origin refuses; the deck works without.
  }
}
