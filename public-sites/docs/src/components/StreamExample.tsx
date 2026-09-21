import { useEffect, useState, type ReactNode } from 'react'
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import styles from './StreamExample.module.css'

const gfmPreset = defineMarkdownPreset({ extensions: [gfm()] })

/**
 * The same split `packages/renderer/tests/streaming.test.tsx` uses: words stay
 * whole, every whitespace and punctuation character is its own token, so a
 * fence arrives as three separate tokens.
 */
export function tokenize(source: string): readonly string[] {
  return source.match(/[A-Za-z0-9]+|[\s\S]/g) ?? []
}

export interface StreamExampleProps {
  /** The finished document. Every prefix of it is fed to the renderer in turn. */
  readonly markdown: string
  readonly title?: string
  /** Milliseconds between tokens. */
  readonly speed?: number
  /** Turn on GFM, so a streamed table behaves the way a chat assistant's does. */
  readonly gfm?: boolean
  readonly children?: ReactNode
}

/**
 * Replays a document token by token through the renderer.
 *
 * Each frame is a full parse and a full render of the prefix so far, which is
 * exactly what a chat UI does when it re-renders on every token. Nothing is
 * cached and nothing is patched in place.
 *
 * It server-renders the finished document, so the page is complete before
 * hydration and a crawler sees the output; the replay starts when the reader
 * presses a button.
 */
export default function StreamExample({
  markdown,
  title,
  speed = 45,
  gfm: useGfm = true,
  children,
}: StreamExampleProps): ReactNode {
  const tokens = tokenize(markdown)
  const [shown, setShown] = useState(tokens.length)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return undefined
    const timer = setInterval(() => {
      setShown((current) => {
        if (current >= tokens.length) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, speed)
    return () => clearInterval(timer)
  }, [playing, speed, tokens.length])

  const prefix = tokens.slice(0, shown).join('')
  const done = shown >= tokens.length

  return (
    <figure className={styles.example}>
      {title !== undefined && <figcaption className={styles.caption}>{title}</figcaption>}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            setShown(0)
            setPlaying(true)
          }}
        >
          Replay from the first token
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => setPlaying((current) => !current)}
          disabled={done && !playing}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            setPlaying(false)
            setShown((current) => Math.min(current + 1, tokens.length))
          }}
          disabled={done}
        >
          One token
        </button>
        <label className={styles.scrub}>
          <span className={styles.scrubLabel}>Token</span>
          <input
            type="range"
            min={0}
            max={tokens.length}
            value={shown}
            onChange={(event) => {
              setPlaying(false)
              setShown(Number(event.target.value))
            }}
          />
          <span className={styles.count}>
            {shown} / {tokens.length}
          </span>
        </label>
      </div>
      <div className={styles.split}>
        <div className={styles.pane}>
          <div className={styles.paneLabel}>Tokens received</div>
          <pre className={styles.source}>
            {prefix}
            {!done && <span className={styles.caret} />}
          </pre>
        </div>
        <div className={styles.pane}>
          <div className={styles.paneLabel}>Rendered from the prefix</div>
          <div className={`${styles.output} rmk-document`}>
            <Markdown {...(useGfm ? { preset: gfmPreset } : {})}>{prefix}</Markdown>
          </div>
        </div>
      </div>
      {children !== undefined && <div className={styles.note}>{children}</div>}
    </figure>
  )
}
