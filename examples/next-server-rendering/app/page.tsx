/**
 * Next.js App Router, rendered on the SERVER.
 *
 * There is no "use client" anywhere in this file or in the renderer, so this
 * component stays a server component: no renderer JavaScript is sent to the
 * browser for the Markdown itself.
 *
 * Reading content from the filesystem here is the point. It only works because
 * the renderer never touches a browser global.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

export default async function Page() {
  const content = await readFile(join(process.cwd(), 'content', 'post.md'), 'utf8')

  return (
    <article>
      <Markdown preset={preset}>{content}</Markdown>
    </article>
  )
}
