/*
 * Shareable links for the editor demo (docs/SEO_WORKPLAN.md, milestone D
 * item 2). The whole document lives in the URL hash, so a link needs no
 * server and nothing is uploaded.
 *
 * SAME FORMAT AS public-sites/mermaid-demo/src/share.ts. This file is a copy
 * of that module's encode and decode half, kept byte-compatible on purpose:
 * a hash written by either demo reads in the other. The two are meant to
 * become one shared module; keep any change here in step with the Mermaid
 * copy until then.
 *
 * Hash format, in the style of mermaid.live:
 *
 *   #pako:<base64url of zlib-deflated UTF-8 source>   (CompressionStream 'deflate')
 *   #base64:<base64url of UTF-8 source>               (fallback without the streams API)
 *
 * The `pako:` payload is the zlib format that pako.deflate produces, so the
 * same bytes inflate with pako, Node's zlib and DecompressionStream. The
 * reader accepts both alphabets (base64 and base64url) with or without
 * padding, and returns nothing rather than throwing on a bad payload.
 */

export const COMPRESSED_PREFIX = 'pako:'
export const PLAIN_PREFIX = 'base64:'

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

type Bytes = Uint8Array<ArrayBuffer>

function toBase64Url(bytes: Bytes): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Bytes | undefined {
  const standard = text.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(new ArrayBuffer(binary.length))
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes
  } catch {
    return undefined
  }
}

async function pipe(bytes: Bytes, transform: ReadableWritablePair<Uint8Array, BufferSource>): Promise<Bytes> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const chunks: Uint8Array[] = []
  let length = 0
  const reader = source.pipeThrough(transform).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.length
  }
  const out = new Uint8Array(new ArrayBuffer(length))
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

const hasStreams = (): boolean =>
  typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'

/** The hash (without `#`) that carries `source`. Compressed when the browser can. */
export async function encodeShareHash(source: string): Promise<string> {
  const bytes = encodeText(source)
  if (hasStreams()) {
    try {
      return COMPRESSED_PREFIX + toBase64Url(await pipe(bytes, new CompressionStream('deflate')))
    } catch {
      // Fall through to the plain form.
    }
  }
  return PLAIN_PREFIX + toBase64Url(bytes)
}

/** The source a hash (with or without `#`) carries, or nothing when it carries none. */
export async function decodeShareHash(hash: string): Promise<string | undefined> {
  const value = hash.startsWith('#') ? hash.slice(1) : hash
  if (value.startsWith(PLAIN_PREFIX)) {
    const bytes = fromBase64Url(value.slice(PLAIN_PREFIX.length))
    return bytes === undefined ? undefined : decodeText(bytes)
  }
  if (value.startsWith(COMPRESSED_PREFIX) && hasStreams()) {
    const bytes = fromBase64Url(value.slice(COMPRESSED_PREFIX.length))
    if (bytes === undefined) return undefined
    try {
      return decodeText(await pipe(bytes, new DecompressionStream('deflate')))
    } catch {
      return undefined
    }
  }
  return undefined
}

function encodeText(text: string): Bytes {
  const encoded = encoder.encode(text)
  const bytes = new Uint8Array(new ArrayBuffer(encoded.length))
  bytes.set(encoded)
  return bytes
}

function decodeText(bytes: Bytes): string | undefined {
  try {
    return decoder.decode(bytes)
  } catch {
    return undefined
  }
}

/** The link to open `hash` in the editor at `base` (an origin plus path, no query). */
export function shareUrl(hash: string, base: string): string {
  return `${base}#${hash}`
}
