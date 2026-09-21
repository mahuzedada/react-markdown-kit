import { useEffect, useRef, useState } from 'react'
import { decodeShareHash, encodeShareHash, shareUrl } from './share'

/*
 * The URL hash as the document (docs/SEO_WORKPLAN.md, milestone D item 2).
 * The same hook shape the Mermaid demo uses, over the same hash format.
 */

/** How long after the last keystroke the URL hash follows the document. */
const HASH_DEBOUNCE_MS = 300

export interface ShareState {
  /** The link that carries the current document, once the hash has been built. */
  readonly link: string | undefined
  /** The page opened with a hash it could not read (corrupt, or `#pako:` without the streams API). */
  readonly unreadable: boolean
}

/** This page without its query, so a shared link opens the full site. */
function pageBase(): string {
  return `${location.origin}${location.pathname}`
}

/**
 * Restores `source` from the hash on load and on `hashchange`, and writes it
 * back debounced with `replaceState`, so typing leaves no history entries.
 *
 * Nothing is written until the hash the page opened with has been read, and a
 * hash the page cannot read is left in the address bar untouched until the
 * user edits, so a shared link is never silently replaced by `initial`.
 */
export function useShareHash(source: string, setSource: (source: string) => void, initial: string): ShareState {
  const [hash, setHash] = useState<string | undefined>(undefined)
  const [restored, setRestored] = useState(false)
  const [unreadable, setUnreadable] = useState(false)
  const written = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const restore = async (): Promise<void> => {
      const current = location.hash
      if (current !== '' && current.slice(1) !== written.current) {
        const restoredSource = await decodeShareHash(current)
        if (cancelled) return
        if (restoredSource === undefined) setUnreadable(true)
        else {
          setUnreadable(false)
          setSource(restoredSource)
        }
      }
      if (!cancelled) setRestored(true)
    }
    void restore()
    addEventListener('hashchange', restore)
    return () => {
      cancelled = true
      removeEventListener('hashchange', restore)
    }
  }, [setSource])

  useEffect(() => {
    if (!restored) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const next = await encodeShareHash(source)
      if (cancelled) return
      setHash(next)
      // The plain URL stays plain until the initial document is edited, and
      // an unreadable hash stays until the user edits.
      if (source === initial && (location.hash === '' || unreadable)) return
      written.current = next
      setUnreadable(false)
      try {
        history.replaceState(null, '', `#${next}`)
      } catch {
        // A sandboxed frame refuses; the copy link button still works.
      }
    }, HASH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [source, restored, unreadable, initial])

  return { link: hash === undefined ? undefined : shareUrl(hash, pageBase()), unreadable }
}
