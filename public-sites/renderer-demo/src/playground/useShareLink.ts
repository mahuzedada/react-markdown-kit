/**
 * The document in the address bar (docs/SEO_WORKPLAN.md, milestone D item 2).
 * The codec is `public-sites/shared/share.ts`, the same one the Mermaid demo
 * links with: the whole document is compressed into the URL hash, so a link
 * needs no server and nothing is uploaded.
 *
 * Two rules keep the hash out of the way of the rest of the page:
 *
 * - Nothing is written while the document is still the sample the playground
 *   opens with, so the plain URL stays plain and an in-page anchor such as
 *   `#renderer-faq` or a heading link in the rendered output survives.
 * - Only a hash that claims to carry a document (`isShareHash`) is read, so
 *   an anchor is never mistaken for a shared document.
 *
 * A hash this browser cannot read is left in the address bar untouched and
 * reported, so a link is never silently replaced by the sample.
 */
import { useEffect, useRef, useState } from 'react'
import { decodeShareHash, encodeShareHash, isShareHash, pageBase, shareUrl, writeShareHash } from '../../../shared/share'

/** How long after the last keystroke the URL hash follows the document. */
export const HASH_DEBOUNCE_MS = 400

export interface ShareLinkInput {
  /** The document as it stands. */
  readonly source: string
  /** Called with the document a shared link carries. */
  readonly setSource: (source: string) => void
  /** True while the document is untouched, so the hash is left alone. */
  readonly pristine: boolean
}

export interface ShareLink {
  /** The link to this document, once the debounce has encoded it. */
  readonly link: string | undefined
  /** The page opened with a share hash it could not read here. */
  readonly unreadable: boolean
}

export function useShareLink({ source, setSource, pristine }: ShareLinkInput): ShareLink {
  const [hash, setHash] = useState<string | undefined>(undefined)
  // Nothing is written until the hash the page opened with has been read, so
  // the sample document never overwrites a shared one.
  const [restored, setRestored] = useState(false)
  const [unreadable, setUnreadable] = useState(false)
  const written = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const restore = async (): Promise<void> => {
      const current = location.hash
      if (isShareHash(current) && current.slice(1) !== written.current) {
        const document = await decodeShareHash(current)
        if (cancelled) return
        if (document === undefined) setUnreadable(true)
        else {
          setUnreadable(false)
          setSource(document)
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
    const timer = setTimeout(() => {
      void encodeShareHash(source).then((next) => {
        if (cancelled) return
        setHash(next)
        // The sample keeps the URL plain, and an unreadable hash stays until
        // the reader edits, so the link they were sent survives a failed read.
        if (pristine && (!isShareHash(location.hash) || unreadable)) return
        written.current = next
        setUnreadable(false)
        writeShareHash(next)
      })
    }, HASH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [source, restored, pristine, unreadable])

  return { link: hash === undefined ? undefined : shareUrl(hash, pageBase()), unreadable }
}
