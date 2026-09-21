import sites from '../../shared/sites.json'

/*
 * Shareable links for the Mermaid demo (docs/SEO_WORKPLAN.md, milestone D
 * items 2 and 3). The whole Mermaid source, layout annotation included, lives
 * in the URL hash, so a link needs no server and nothing is uploaded.
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

/** The badge a README links to this editor with, served from public/. */
export const BADGE_URL = `${sites.mermaidDemo}/badge.svg`

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
export function shareUrl(hash: string, base: string = `${sites.mermaidDemo}/`): string {
  return `${base}#${hash}`
}

/** The Markdown a README pastes: the badge, linking to the editor with the diagram in the hash. */
export function badgeMarkdown(link: string): string {
  return `[![Open in visual editor](${BADGE_URL})](${link})`
}

/** The iframe a blog post or docs page pastes: the editor without the site chrome. */
export function embedHtml(link: string): string {
  const url = new URL(link)
  url.searchParams.set('embed', '1')
  return `<iframe src="${url.href}" width="100%" height="520" style="border:0" title="Mermaid visual editor" loading="lazy"></iframe>`
}

/**
 * The three-node flowchart the landing page's badge example links to, with
 * its layout annotation. `EXAMPLE_HASH` is `encodeShareHash(EXAMPLE_SOURCE)`
 * as Node's zlib produced it; tests/mermaid-share.test.ts decodes it back.
 */
export const EXAMPLE_SOURCE = `flowchart LR
    web[Web App] -->|REST| api[API]
    api --> db[(Postgres)]
    style web fill:#a5d8ff,stroke:#1971c2
    %% rmk-layout v1 {"canvasHeight":220,"nodes":{"web":{"x":40,"y":60,"width":160,"height":90},"api":{"x":280,"y":60,"width":160,"height":90},"db":{"x":520,"y":60,"width":160,"height":90}}}`

export const EXAMPLE_HASH = 'pako:eJyNzMFrwjAUBvD7_orHK4KDFNqgm-Yw6EFw4EF0sEPpIWlSG5qZ0GTWov3fpc6dt9N78P2-rzK2K2veBtjsngAAOiXyTyUgc66AOH677lb7jytwp_Ns-17cDXd6jECKfLq1Phxa5Z9_Ih96o8YRqLQxLOJzuagq4kNrG8WidPmalvQuJxNov5rY8N5-BzilcMGSH0_cr5U-1AEZpQnBo5XKI7tgp8R4zshmCcEe2UtCsNMy1MjS8a8ftWUyEOROPzRd_IPL3-05_VMPww18tFoi'
