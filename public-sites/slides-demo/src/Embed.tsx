import { useEffect, useState, type ReactNode } from 'react'
import { Markdown, defineMarkdownPreset, gfm, type MarkdownPreset } from '@react-markdown-kit/renderer'
import { slides } from '@react-markdown-kit/slides/present'
import { SAMPLE_DECK } from './sample-deck'
import { decodeSource, fullDemoLink, readSourceParam } from './url-state'
import styles from './Embed.module.css'

import '@react-markdown-kit/renderer/styles.css'
import '@react-markdown-kit/slides/styles.css'

/**
 * `?embed=1`: the deck alone, for an iframe in a blog post or a docs page.
 * Nothing else is on the page, so the deck is exactly as large as the frame
 * the host gave it.
 *
 * This is the `/present` entry, not the `/editor` one, so the chunk carries
 * the renderer and the deck and no editor. The deck opens in present mode:
 * its keys and its clicks are bound to the article element, so they work
 * inside the frame as soon as the frame has the focus. There is no
 * BroadcastChannel and no hash routing here; an embedded deck must not move
 * another window's deck or write to an address bar it does not own.
 */
const PRESET: MarkdownPreset = defineMarkdownPreset({
  extensions: [gfm(), slides({ initialMode: 'present' })],
})

/** The deck in `?d=`, or the sample when the link holds none or cannot be read here. */
async function loadSource(): Promise<string> {
  const param = readSourceParam(location.search)
  if (param === null) return SAMPLE_DECK
  return (await decodeSource(param)) ?? SAMPLE_DECK
}

export default function Embed(): ReactNode {
  const [source, setSource] = useState<string | undefined>(undefined)
  const [link] = useState(() => fullDemoLink())

  useEffect(() => {
    let cancelled = false
    void loadSource().then((loaded) => {
      if (!cancelled) setSource(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={styles.frame}>
      {source === undefined ? (
        <div className={styles.deck} aria-busy="true" />
      ) : (
        <div className={`${styles.deck} rmk-document`}>
          <Markdown preset={PRESET}>{source}</Markdown>
        </div>
      )}
      <a className={styles.open} href={link} target="_blank" rel="noopener noreferrer" data-zui-tag="embed:open-full-demo">
        Open in React Markdown Kit
      </a>
    </div>
  )
}
