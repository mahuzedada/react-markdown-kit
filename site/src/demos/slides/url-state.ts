/**
 * The deck in the address bar. `?d=` holds the source in the payload every
 * demo shares (`pako:` or `base64:`, site/src/lib/share.ts). It sits in the
 * query rather than the hash because present mode keeps the slide number in
 * the hash. Links written before the shared codec (`z` deflate-raw, `u`
 * plain, then base64url) still open. `?view=` picks the page's role: the
 * editor, the audience window or the presenter window. `?embed=1` drops both
 * and renders the deck alone, for an iframe in someone else's page.
 */
import { decodeShareHash, encodeShareHash, isShareHash } from '../../lib/share'

export type DemoView = 'edit' | 'present' | 'presenter'

export const SOURCE_PARAM = 'd'
export const VIEW_PARAM = 'view'
export const EMBED_PARAM = 'embed'

/** The prefixes of links written before the shared codec. */
const LEGACY_DEFLATED = 'z'
const LEGACY_PLAIN = 'u'

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function hasStreams(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough<Uint8Array>(transform)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The `?d=` value for `source`. */
export function encodeSource(source: string): Promise<string> {
  return encodeShareHash(source)
}

/** The source a `?d=` value holds, or undefined when it cannot be read here. */
export async function decodeSource(value: string): Promise<string | undefined> {
  if (isShareHash(value)) return decodeShareHash(value)
  const prefix = value.charAt(0)
  const body = value.slice(1)
  try {
    if (prefix === LEGACY_PLAIN) return new TextDecoder().decode(fromBase64Url(body))
    if (prefix === LEGACY_DEFLATED && hasStreams()) {
      return new TextDecoder().decode(await pipe(fromBase64Url(body), new DecompressionStream('deflate-raw')))
    }
  } catch {
    // A truncated or hand-edited link; the caller falls back.
  }
  return undefined
}

export function readView(search: string): DemoView {
  const view = new URLSearchParams(search).get(VIEW_PARAM)
  return view === 'present' || view === 'presenter' ? view : 'edit'
}

export function readSourceParam(search: string): string | null {
  return new URLSearchParams(search).get(SOURCE_PARAM)
}

/** True for `?embed=1`: the page is the deck alone, inside someone else's iframe. */
export function readEmbed(search: string): boolean {
  return new URLSearchParams(search).get(EMBED_PARAM) === '1'
}

/** The same deck on the full demo: this URL without `?embed=` and without a view. */
export function fullDemoLink(): string {
  const url = new URL(location.href)
  url.searchParams.delete(EMBED_PARAM)
  url.searchParams.delete(VIEW_PARAM)
  url.hash = ''
  return url.toString()
}

/** The current page's URL with `?d=` set to `encoded` and `?view=` to `view` (or removed). */
export function linkFor(encoded: string, view: DemoView): string {
  const url = new URL(location.href)
  url.searchParams.set(SOURCE_PARAM, encoded)
  if (view === 'edit') url.searchParams.delete(VIEW_PARAM)
  else url.searchParams.set(VIEW_PARAM, view)
  url.hash = ''
  return url.toString()
}

/**
 * Writes `?d=` for the page as it is (same view, same hash) without a
 * history entry, or removes it for `undefined`, so the sample keeps the plain URL.
 */
export function writeSourceParam(encoded: string | undefined): void {
  const url = new URL(location.href)
  if ((url.searchParams.get(SOURCE_PARAM) ?? undefined) === encoded) return
  if (encoded === undefined) url.searchParams.delete(SOURCE_PARAM)
  else url.searchParams.set(SOURCE_PARAM, encoded)
  try {
    history.replaceState(history.state, '', url.toString())
  } catch {
    // An opaque origin or a sandboxed frame refuses; the page works without.
  }
}

const STORAGE_KEY = 'rmk-slides-demo'

export function readStoredSource(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function storeSource(source: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, source)
  } catch {
    // Storage can be full or blocked; the URL still carries the deck.
  }
}

export function clearStoredSource(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
