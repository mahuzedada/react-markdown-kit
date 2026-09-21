/**
 * The share codec every demo links with (docs/SEO_WORKPLAN.md, milestone D
 * item 2, `public-sites/shared/share.ts`): a document round-trips through the
 * URL hash, compressed when the streams API exists and as plain base64url
 * when it does not; a hash that carries no document yields nothing rather
 * than an exception; and an in-page anchor is never mistaken for one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inflateSync } from 'node:zlib'
import {
  COMPRESSED_PREFIX,
  PLAIN_PREFIX,
  decodeShareHash,
  encodeShareHash,
  isShareHash,
  shareUrl,
} from '../public-sites/shared/share'

const MARKDOWN = `# Release notes

A paragraph with *emphasis*, a [link](https://example.com) and \`code\`.

| Option | Default |
| ------ | ------- |
| gfm    | off     |

- [x] task
- [ ] another

\`\`\`ts
const answer = 42
\`\`\`
`

const UNICODE = `# Ünïcödé → naïve café

日本語の段落, emoji 🚀, and ß, ñ, ø.`

const LONG = MARKDOWN.repeat(40)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('share hash round trip', () => {
  it.each([
    ['a Markdown document', MARKDOWN],
    ['unicode text', UNICODE],
    ['a long document', LONG],
    ['an empty document', ''],
  ])('round-trips %s through a compressed hash', async (_name, source) => {
    const hash = await encodeShareHash(source)
    expect(hash.startsWith(COMPRESSED_PREFIX)).toBe(true)
    expect(hash).toMatch(/^pako:[A-Za-z0-9_-]*$/)
    expect(await decodeShareHash(hash)).toBe(source)
    expect(await decodeShareHash(`#${hash}`)).toBe(source)
  })

  it('writes the zlib form pako and Node inflate', async () => {
    const hash = await encodeShareHash(MARKDOWN)
    const bytes = Buffer.from(hash.slice(COMPRESSED_PREFIX.length), 'base64url')
    expect(inflateSync(bytes).toString('utf8')).toBe(MARKDOWN)
  })

  it('is shorter than the source for a document worth sharing', async () => {
    expect((await encodeShareHash(LONG)).length).toBeLessThan(LONG.length / 4)
  })

  it('falls back to plain base64url without the streams API', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    vi.stubGlobal('DecompressionStream', undefined)
    const hash = await encodeShareHash(UNICODE)
    expect(hash.startsWith(PLAIN_PREFIX)).toBe(true)
    expect(hash).toMatch(/^base64:[A-Za-z0-9_-]*$/)
    expect(await decodeShareHash(hash)).toBe(UNICODE)
    expect(await decodeShareHash(await encodeShareHash(MARKDOWN))).toBe(MARKDOWN)
  })

  it('reads a plain hash with the streams API present too', async () => {
    const plain = PLAIN_PREFIX + Buffer.from(MARKDOWN, 'utf8').toString('base64url')
    expect(await decodeShareHash(plain)).toBe(MARKDOWN)
  })

  it('accepts the standard base64 alphabet with padding', async () => {
    const hash = await encodeShareHash(MARKDOWN)
    const standard = Buffer.from(hash.slice(COMPRESSED_PREFIX.length), 'base64url').toString('base64')
    expect(standard).toMatch(/[+/=]/)
    expect(await decodeShareHash(COMPRESSED_PREFIX + standard)).toBe(MARKDOWN)
  })

  it('returns nothing for a hash that carries no document', async () => {
    expect(await decodeShareHash('')).toBeUndefined()
    expect(await decodeShareHash('#')).toBeUndefined()
    expect(await decodeShareHash('#renderer-faq')).toBeUndefined()
    expect(await decodeShareHash('pako:not*base64!')).toBeUndefined()
    expect(await decodeShareHash('pako:AAAA')).toBeUndefined()
    expect(await decodeShareHash('base64:_w')).toBeUndefined()
  })
})

describe('telling a share hash from an anchor', () => {
  it('claims both prefixes, with or without the #', async () => {
    expect(isShareHash(await encodeShareHash(MARKDOWN))).toBe(true)
    expect(isShareHash(`#${await encodeShareHash(MARKDOWN)}`)).toBe(true)
    expect(isShareHash('base64:IyBoaQ')).toBe(true)
    // A payload it cannot read is still the page's own hash to replace.
    expect(isShareHash('#pako:AAAA')).toBe(true)
  })

  it('leaves in-page anchors and an empty hash alone', () => {
    expect(isShareHash('')).toBe(false)
    expect(isShareHash('#')).toBe(false)
    expect(isShareHash('#renderer-faq')).toBe(false)
    expect(isShareHash('#pako')).toBe(false)
  })
})

describe('the link', () => {
  it('appends the hash to the base it is given', async () => {
    const hash = await encodeShareHash(MARKDOWN)
    expect(shareUrl(hash, 'https://renderer.reactmarkdownkit.com/')).toBe(
      `https://renderer.reactmarkdownkit.com/#${hash}`,
    )
  })

  it('round-trips through the URL the reader would paste', async () => {
    const link = shareUrl(await encodeShareHash(UNICODE), 'https://renderer.reactmarkdownkit.com/')
    expect(await decodeShareHash(new URL(link).hash)).toBe(UNICODE)
  })
})
