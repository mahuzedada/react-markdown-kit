/*
 * Swizzled code block button: the copy and word-wrap buttons render the zui
 * Button. Neither caller passes a name, so the track comes from the title
 * ("Copy" -> code-block:copy, "Toggle word wrap" -> code-block:toggle-word-wrap).
 */
import type { ReactNode } from 'react'
import type { Props } from '@theme/CodeBlock/Buttons/Button'
import Button from '@zuilib/primitives/button'

function trackName(title: string | undefined): string {
  const slug = (title ?? 'button').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `code-block:${slug}`
}

export default function CodeBlockButton({ className, title, ...props }: Props): ReactNode {
  return (
    <Button variant="outline" size="icon" track={trackName(title)} title={title} className={className} {...props} />
  )
}
