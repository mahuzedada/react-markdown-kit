/**
 * The one configuration the demo renders with, and the code the Code tab
 * shows for it. Both are written here, next to each other, so what the
 * reader copies is what they saw.
 */
import type { ComponentType } from 'react'
import { defineMarkdownPreset, gfm, type MarkdownBaseProps } from '@react-markdown-kit/renderer'
import { SHOWCASE_SOURCE, showcase } from './showcase'

export const PROPS: MarkdownBaseProps = {
  preset: defineMarkdownPreset({ extensions: [gfm()] }),
  components: showcase as unknown as Record<string, ComponentType<never>> as NonNullable<MarkdownBaseProps['components']>,
}

export const CODE = `import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { showcase } from './showcase'   // shown below
import './showcase.css'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

<div className="showcase">
  <Markdown
    preset={preset}
    components={showcase}
  >
    {content}
  </Markdown>
</div>

${SHOWCASE_SOURCE}`
