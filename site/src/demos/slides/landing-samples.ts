/** The code shown on the slides landing page, one constant per block. */

export const RENDER = `import Markdown, { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { slides } from '@react-markdown-kit/slides'
import '@react-markdown-kit/slides/styles.css'

const preset = defineMarkdownPreset({ extensions: [slides()] })

<div className="rmk-document">
  <Markdown preset={preset}>{deck}</Markdown>
</div>`

export const DECK = `---
title: Q3 review
---

# Welcome

---

<!-- class: center, middle -->

## Numbers

Revenue is up.

--

So are costs.

???

Pause before the second line.`

export const PRESENT = `import { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { slides } from '@react-markdown-kit/slides/present'

const preset = defineMarkdownPreset({
  extensions: [slides({ hashRouting: true, sync: 'talk' })],
})`

export const EDIT = `import { defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { slides } from '@react-markdown-kit/slides/editor'

const preset = defineMarkdownPreset({ extensions: [slides()] })

<MarkdownEditor preset={preset} value={source} onChange={setSource} />`

export const EMBED = `<iframe
  src="https://reactmarkdownkit.com/markdown-slides?embed=1&d=uIyBXZWxjb21lCgotLS0KCiMjIFNlY29uZCBzbGlkZQoKT25lIGZpbGUsIHR3byBzbGlkZXMu"
  title="A deck written in Markdown"
  width="100%"
  height="480"
  loading="lazy"
  allowfullscreen
></iframe>`
