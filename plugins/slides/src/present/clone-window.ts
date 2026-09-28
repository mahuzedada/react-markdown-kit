/**
 * The `c` key: another window of this deck (remark's clone), which the sync
 * transport keeps on the same step. Only offered when the deck syncs; the
 * URL is `cloneUrl` (a string, or built from the current slide), else this
 * page's own.
 */
import type { ResolvedPresentOptions } from './options.js'

export function cloneOpener(options: ResolvedPresentOptions, index: number): (() => void) | undefined {
  if (options.sync === false || typeof window === 'undefined' || typeof window.open !== 'function') return undefined
  const { cloneUrl } = options
  return () => {
    const url = cloneUrl === undefined ? location.href : typeof cloneUrl === 'string' ? cloneUrl : cloneUrl(index)
    window.open(url, '_blank', 'noopener')
  }
}
