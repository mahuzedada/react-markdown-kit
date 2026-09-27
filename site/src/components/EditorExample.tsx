import { lazy, type ReactNode } from 'react'
import ClientOnly from '@site/src/components/ClientOnly'
import type { EditorExampleProps } from './EditorExampleInner'

export type { EditorExampleProps }

// The editor pulls in Lexical, so it is its own chunk. Doc pages hydrate
// immediately and the examples stream in after.
const Inner = lazy(() => import('./EditorExampleInner'))

/**
 * A live `MarkdownEditor` in a doc page.
 *
 * Unlike the renderer, the editor needs a DOM, so it mounts client-side. The
 * placeholder reserves the same height so the page does not jump.
 */
export default function EditorExample(props: EditorExampleProps): ReactNode {
  const height = (props.height ?? 320) + 96
  const placeholder = (
    <div
      className="flex items-center justify-center rounded-(--radius) border border-dashed border-border text-sm text-muted-foreground"
      style={{ height }}
    >
      Loading editor
    </div>
  )
  return (
    <ClientOnly fallback={placeholder}>
      <Inner {...props} />
    </ClientOnly>
  )
}
