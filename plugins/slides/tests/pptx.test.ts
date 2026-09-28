import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { slides } from '../src/index.js'
import { deckToPptx } from '../src/pptx.js'

const preset = defineMarkdownPreset({ extensions: [gfm(), slides()] })

const DECK = `---
title: Q3 review
footer: ACME
paginate: true
---

# Welcome

Hello **there**.

---

<!-- layout: two-cols -->

## Split

- left one
- left two

::right::

| a | b |
| - | - |
| 1 | 2 |

???

Mention the table.
`

async function files(source: string): Promise<JSZip> {
  const buffer = (await deckToPptx(compileMarkdown(source, { preset }), { output: 'nodebuffer' })) as Uint8Array
  return JSZip.loadAsync(buffer)
}

async function text(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path)
  if (file === null) throw new Error(`No ${path} in the file.`)
  return file.async('string')
}

describe('deckToPptx', () => {
  it('writes one slide per deck slide with titles, body, footer and table', async () => {
    const zip = await files(DECK)
    expect(zip.file(/ppt\/slides\/slide\d+\.xml$/)).toHaveLength(2)
    const first = await text(zip, 'ppt/slides/slide1.xml')
    expect(first).toContain('Welcome')
    expect(first).toContain('there')
    expect(first).toContain('ACME')
    const second = await text(zip, 'ppt/slides/slide2.xml')
    expect(second).toContain('Split')
    expect(second).toContain('left two')
    expect(second).toContain('<a:tbl>')
  })

  it('carries the speaker notes and the deck title', async () => {
    const zip = await files(DECK)
    const notes = zip.file(/ppt\/notesSlides\/notesSlide\d+\.xml$/)
    const all = await Promise.all(notes.map((file) => file.async('string')))
    expect(all.some((xml) => xml.includes('Mention the table.'))).toBe(true)
    expect(await text(zip, 'docProps/core.xml')).toContain('Q3 review')
  })

  it('uses the 4:3 layout when the front matter asks for it', async () => {
    const zip = await files('---\naspect: 4:3\n---\n\n# One\n')
    expect(await text(zip, 'ppt/presentation.xml')).toContain('cx="9144000" cy="6858000"')
  })
})

describe('deckToPptx safety and notes', () => {
  it('refuses file paths and script links by default, and keeps list lines in the notes', async () => {
    const source = `<!-- background: /etc/passwd -->

# Title

[bad](javascript:alert(1)) and [good](https://example.com)

![](file:///etc/hosts)

???

- one
- two
`
    const zip = await files(source)
    const slide = await text(zip, 'ppt/slides/slide1.xml')
    const rels = await text(zip, 'ppt/slides/_rels/slide1.xml.rels')
    expect(rels).not.toContain('passwd')
    expect(rels).not.toContain('javascript:')
    expect(rels).toContain('https://example.com')
    expect(slide).toContain('bad')
    const notes = await Promise.all(zip.file(/ppt\/notesSlides\/notesSlide\d+\.xml$/).map((file) => file.async('string')))
    expect(notes.join('')).toMatch(/- one[^]*- two/)
  })

  it('still writes the file when a picture cannot be loaded', async () => {
    const zip = await files('# Title\n\n![](https://127.0.0.1:9/missing.png)\n')
    expect(await text(zip, 'ppt/slides/slide1.xml')).toContain('Title')
  })
})
