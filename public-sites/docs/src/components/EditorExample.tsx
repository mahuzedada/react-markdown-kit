import { lazy, Suspense, type ReactNode } from 'react'
import BrowserOnly from '@docusaurus/BrowserOnly'
import type { EditorExampleProps } from './EditorExampleInner'
import styles from './Example.module.css'

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
    <div className={styles.placeholder} style={{ height }}>
      Loading editor
    </div>
  )
  return (
    <BrowserOnly fallback={placeholder}>
      {() => (
        <Suspense fallback={placeholder}>
          <Inner {...props} />
        </Suspense>
      )}
    </BrowserOnly>
  )
}
