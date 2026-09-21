/**
 * The Mermaid demo's shareable links (docs/SEO_WORKPLAN.md, milestone D
 * items 2 and 3): the source, layout annotation included, round-trips
 * through the URL hash, compressed when the streams API exists and as plain
 * base64url when it does not, and a bad hash yields nothing rather than an
 * exception.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inflateSync } from 'node:zlib'
import { readLayoutAnnotation } from '@react-markdown-kit/mermaid'
import {
  BADGE_URL,
  COMPRESSED_PREFIX,
  EXAMPLE_HASH,
  EXAMPLE_SOURCE,
  PLAIN_PREFIX,
  badgeMarkdown,
  decodeShareHash,
  embedHtml,
  encodeShareHash,
  shareUrl,
} from '../public-sites/mermaid-demo/src/share'

const THREE_NODES = `flowchart LR
    a[Start] --> b[Work]
    b --> c[Done]`

const WITH_LAYOUT = `flowchart LR
    web["CLIENT<br/>Web App<br/>React"] -->|REST| api["SERVICE<br/>API<br/>Kotlin"]
    api --> db[(Postgres)]
    style web fill:#a5d8ff,stroke:#1971c2
    %% rmk-layout v1 {"canvasHeight":260,"nodes":{"web":{"x":40,"y":50,"width":170,"height":100,"strokeWidth":2,"slots":["label","text","footer"]},"api":{"x":330,"y":50,"width":140,"height":110,"strokeWidth":2}},"edges":{"web->api":{"id":"e1","x":216,"y":100,"width":108,"height":0,"stroke":"#1e1e1e","fill":"transparent","strokeWidth":2,"routing":"elbow"}}}`

const UNICODE = `flowchart TD
    a["Ünïcödé → naïve café"] --> b["日本語のラベル"]
    b --> c["emoji 🚀 and ß, ñ, ø"]
    %% rmk-layout v1 {"description":"Ünïcödé 日本語 🚀","nodes":{"a":{"x":10.5,"y":20.25}}}`

const layoutLine = (source: string): string => source.split('\n').find((line) => line.includes('rmk-layout')) ?? ''

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('share hash round trip', () => {
  it.each([
    ['three nodes', THREE_NODES],
    ['a layout annotation', WITH_LAYOUT],
    ['unicode labels', UNICODE],
    ['an empty source', ''],
  ])('round-trips %s through a compressed hash', async (_name, source) => {
    const hash = await encodeShareHash(source)
    expect(hash.startsWith(COMPRESSED_PREFIX)).toBe(true)
    expect(hash).toMatch(/^pako:[A-Za-z0-9_-]*$/)
    expect(await decodeShareHash(hash)).toBe(source)
    expect(await decodeShareHash(`#${hash}`)).toBe(source)
  })

  it('keeps the layout annotation byte for byte and readable', async () => {
    const restored = await decodeShareHash(await encodeShareHash(WITH_LAYOUT))
    expect(layoutLine(restored ?? '')).toBe(layoutLine(WITH_LAYOUT))
    const read = readLayoutAnnotation(layoutLine(restored ?? '').trim())
    expect(read.kind).toBe('annotation')
  })

  it('writes the zlib form pako and Node inflate', async () => {
    const hash = await encodeShareHash(WITH_LAYOUT)
    const bytes = Buffer.from(hash.slice(COMPRESSED_PREFIX.length), 'base64url')
    expect(inflateSync(bytes).toString('utf8')).toBe(WITH_LAYOUT)
  })

  it('is shorter than the source for a real diagram', async () => {
    const hash = await encodeShareHash(WITH_LAYOUT)
    expect(hash.length).toBeLessThan(WITH_LAYOUT.length)
  })

  it('falls back to plain base64url without the streams API', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    vi.stubGlobal('DecompressionStream', undefined)
    const hash = await encodeShareHash(UNICODE)
    expect(hash.startsWith(PLAIN_PREFIX)).toBe(true)
    expect(hash).toMatch(/^base64:[A-Za-z0-9_-]*$/)
    expect(await decodeShareHash(hash)).toBe(UNICODE)
    expect(await decodeShareHash(await encodeShareHash(THREE_NODES))).toBe(THREE_NODES)
  })

  it('reads a plain hash with the streams API present too', async () => {
    const plain = PLAIN_PREFIX + Buffer.from(UNICODE, 'utf8').toString('base64url')
    expect(await decodeShareHash(plain)).toBe(UNICODE)
  })

  it('accepts the standard base64 alphabet with padding', async () => {
    const hash = await encodeShareHash(WITH_LAYOUT)
    const standard = Buffer.from(hash.slice(COMPRESSED_PREFIX.length), 'base64url').toString('base64')
    expect(standard).toMatch(/[+/=]/)
    expect(await decodeShareHash(COMPRESSED_PREFIX + standard)).toBe(WITH_LAYOUT)
  })

  it('returns nothing for a hash it does not carry', async () => {
    expect(await decodeShareHash('')).toBeUndefined()
    expect(await decodeShareHash('#')).toBeUndefined()
    expect(await decodeShareHash('#mermaid-faq')).toBeUndefined()
    expect(await decodeShareHash('pako:not*base64!')).toBeUndefined()
    expect(await decodeShareHash('pako:AAAA')).toBeUndefined()
    expect(await decodeShareHash('base64:_w')).toBeUndefined()
  })
})

describe('the landing page example', () => {
  it('decodes EXAMPLE_HASH to EXAMPLE_SOURCE, whose layout annotation reads', async () => {
    expect(await decodeShareHash(EXAMPLE_HASH)).toBe(EXAMPLE_SOURCE)
    expect(readLayoutAnnotation(layoutLine(EXAMPLE_SOURCE).trim()).kind).toBe('annotation')
  })

  it('links the badge to the demo with the hash', () => {
    const link = shareUrl(EXAMPLE_HASH)
    expect(link).toBe(`https://mermaid.reactmarkdownkit.com/#${EXAMPLE_HASH}`)
    expect(badgeMarkdown(link)).toBe(`[![Open in visual editor](${BADGE_URL})](${link})`)
    expect(BADGE_URL).toBe('https://mermaid.reactmarkdownkit.com/badge.svg')
  })

  it('embeds with ?embed=1 before the hash', () => {
    const html = embedHtml(shareUrl(EXAMPLE_HASH))
    expect(html).toContain(`src="https://mermaid.reactmarkdownkit.com/?embed=1#${EXAMPLE_HASH}"`)
    expect(html).toContain('<iframe ')
  })
})
