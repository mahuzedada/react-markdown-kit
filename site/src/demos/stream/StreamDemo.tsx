import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { mermaid } from '@react-markdown-kit/mermaid'
import { ActivityScope } from '@zuilib/primitives/activity'
import Badge from '@zuilib/primitives/badge'
import Button from '@zuilib/primitives/button'
import NativeSelect from '@zuilib/primitives/native-select'
import Text from '@zuilib/primitives/text'
import { cn } from '@zuilib/primitives/lib/cn'
import { DocsLink, PaneSwitch, StatusStrip } from '../../components/DemoStrip'
import { tokenize } from '../../components/StreamExample'
import { useCopy } from '../../lib/use-copy'
import { useShareLink } from '../../lib/use-share-link'
import { SAMPLE } from './samples'

import '@react-markdown-kit/mermaid/styles.css'

const preset = defineMarkdownPreset({ extensions: [gfm(), mermaid()] })

/** Milliseconds between chunks. */
const SPEEDS = [
  { label: 'Slow', ms: 90 },
  { label: 'Normal', ms: 35 },
  { label: 'Fast', ms: 12 },
] as const

/** How many tokens arrive per chunk. `0` is a random 1 to 8, which is closer to what a model sends. */
const CHUNKS = [
  { label: '1 token', size: 1 },
  { label: '4 tokens', size: 4 },
  { label: 'Random', size: 0 },
] as const

const chunkSize = (size: number): number => (size === 0 ? 1 + Math.floor(Math.random() * 8) : size)

type MobilePane = 'source' | 'output'
const PANES: readonly (readonly [MobilePane, string])[] = [
  ['source', 'Input'],
  ['output', 'Output'],
]

/*
 * Demo chrome, the same as the renderer playground: hairlines, one accent,
 * tabular numbers. Below 900px the panes stack and a switch in the status
 * strip picks one, starting on the output, which is also where a stream
 * sends the reader.
 */
const PANE_HEAD =
  'flex min-h-[2.35rem] items-center justify-between gap-2 border-b border-border px-[0.8rem] py-[0.3rem]'
const PANE = 'flex min-h-0 min-w-0 flex-col max-[900px]:data-[mobile-hidden]:hidden'
const EDITOR =
  'm-0 box-border min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-[0.9rem] font-mono text-[0.8rem] leading-[1.6] text-foreground outline-none [tab-size:2] focus:shadow-[inset_3px_0_0_var(--primary)]'
/** The caret while streaming, on the element `caretHost` picks. */
const CURSOR =
  "[&_[data-caret]]:after:ml-0.5 [&_[data-caret]]:after:inline-block [&_[data-caret]]:after:h-[1em] [&_[data-caret]]:after:w-[0.5em] [&_[data-caret]]:after:bg-primary [&_[data-caret]]:after:align-text-bottom [&_[data-caret]]:after:content-['']"

/** Elements the caret can't go inside: nothing renders after their content. */
const CARET_STOP = new Set(['svg', 'input', 'img', 'br', 'hr'])

/**
 * The element holding the end of the text: follow the last child down while
 * it is an element, so the caret lands after the last character written
 * (inside the open code block, the last table cell or the last list item)
 * rather than under the last block. A diagram or an empty document has no
 * text to follow, so the caret goes after the figure or the wrapper.
 */
function caretHost(root: Element): Element {
  let host = root
  for (;;) {
    let last = host.lastChild
    while (last !== null && last.nodeType === Node.TEXT_NODE && (last.textContent ?? '').trim() === '') {
      last = last.previousSibling
    }
    if (!(last instanceof Element) || CARET_STOP.has(last.tagName.toLowerCase())) return host
    host = last
  }
}

/**
 * The streaming demo: Markdown on the left, and on the right the renderer fed
 * that Markdown a few tokens at a time, the way a chat UI re-renders on every
 * chunk from a model. Each frame is a plain `<Markdown>` of the prefix so far,
 * with no streaming mode and no incremental parser.
 */
export default function StreamDemo(): ReactNode {
  const [source, setSource] = useState(SAMPLE)
  const [shown, setShown] = useState(() => tokenize(SAMPLE).length)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(SPEEDS[1].ms)
  const [chunk, setChunk] = useState<number>(CHUNKS[2].size)
  const [mobilePane, setMobilePane] = useState<MobilePane>('output')
  const { copied, blocked, copy } = useCopy()
  const [renders, setRenders] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const output = useRef<HTMLDivElement>(null)
  const rendered = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  // The interval reads the position here, so counting a chunk stays out of a state updater.
  const position = useRef(shown)

  const tokens = useMemo(() => tokenize(source), [source])
  const total = tokens.length
  const prefix = tokens.slice(0, shown).join('')
  const done = shown >= total

  const restore = useCallback((text: string) => {
    setSource(text)
    setShown(tokenize(text).length)
  }, [])
  const { link, unreadable } = useShareLink({
    source,
    setSource: restore,
    pristine: source === SAMPLE,
  })

  useLayoutEffect(() => {
    position.current = shown
  }, [shown])

  useEffect(() => {
    if (!playing) return undefined
    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const delta = now - last
      last = now
      if (position.current >= total) return
      setElapsed((current) => current + delta)
      position.current = Math.min(position.current + chunkSize(chunk), total)
      setShown(position.current)
      setRenders((count) => count + 1)
    }, speed)
    return () => clearInterval(timer)
  }, [playing, speed, chunk, total])

  useEffect(() => {
    if (playing && done) setPlaying(false)
  }, [playing, done])

  // Stick to the bottom while text arrives, unless the reader has scrolled up.
  useLayoutEffect(() => {
    const element = output.current
    if (element !== null && playing && pinned.current) element.scrollTop = element.scrollHeight
  }, [prefix, playing])

  // React doesn't own this attribute, so moving it never fights a re-render.
  useLayoutEffect(() => {
    const root = rendered.current
    if (root === null || !playing) return undefined
    const host = caretHost(root)
    host.setAttribute('data-caret', '')
    return () => host.removeAttribute('data-caret')
  }, [prefix, playing])

  const stream = (): void => {
    setShown(0)
    setRenders(0)
    setElapsed(0)
    pinned.current = true
    if (output.current !== null) output.current.scrollTop = 0
    setMobilePane('output')
    setPlaying(true)
  }

  return (
    <ActivityScope feature="stream-playground">
      <div className="flex h-[var(--rmk-demo-height,100dvh)] flex-col overflow-hidden border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-[0.8rem] py-2">
          <Button variant="solid" tone="primary" size="sm" track="stream" onClick={stream}>
            Simulate stream
          </Button>
          <Button
            variant="outline"
            size="sm"
            track={playing ? 'pause' : 'resume'}
            disabled={done || (shown === 0 && !playing)}
            onClick={() => setPlaying((current) => !current)}
          >
            {playing ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            track="clear"
            onClick={() => {
              setPlaying(false)
              setShown(0)
              setRenders(0)
              setElapsed(0)
            }}
          >
            Clear
          </Button>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1.5">
              <Text as="span" size="sm" weight="medium" muted>
                Speed
              </Text>
              <NativeSelect
                size="sm"
                track="speed"
                value={String(speed)}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                {SPEEDS.map((option) => (
                  <option key={option.ms} value={option.ms}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex items-center gap-1.5">
              <Text as="span" size="sm" weight="medium" muted>
                Chunk size
              </Text>
              <NativeSelect
                size="sm"
                track="chunk"
                value={String(chunk)}
                onChange={(event) => setChunk(Number(event.target.value))}
              >
                {CHUNKS.map((option) => (
                  <option key={option.size} value={option.size}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <Button
              variant="outline"
              tone="primary"
              size="sm"
              track="copy-link"
              disabled={link === undefined}
              title="Copies a link with the Markdown in the URL hash. Nothing is uploaded."
              onClick={() => link !== undefined && void copy('link', link)}
            >
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </Button>
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] max-[900px]:grid-cols-1">
          <section
            className={cn(PANE, 'border-r border-border max-[900px]:border-r-0')}
            data-mobile-hidden={mobilePane !== 'source' ? '' : undefined}
          >
            <div className={PANE_HEAD}>
              <Text as="span" size="sm" weight="medium" muted>
                Markdown input
              </Text>
              {source === SAMPLE ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  track="reset-sample"
                  onClick={() => {
                    setPlaying(false)
                    restore(SAMPLE)
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
            <textarea
              className={EDITOR}
              value={source}
              spellCheck={false}
              aria-label="Markdown to stream"
              data-zui-tag="source"
              onChange={(event) => {
                setPlaying(false)
                setSource(event.target.value)
                setShown(tokenize(event.target.value).length)
              }}
            />
            {unreadable ? (
              <Text as="div" size="sm" className="m-0 border-t border-border px-[0.9rem] py-[0.6rem]">
                This browser couldn&rsquo;t read the link, so you&rsquo;re seeing the sample instead. The shared link is
                still in the address bar, and editing will replace it.
              </Text>
            ) : blocked === 'link' ? (
              <Text as="div" size="sm" className="m-0 border-t border-border px-[0.9rem] py-[0.6rem]">
                This browser blocked the clipboard. The link is in the address bar once you edit the Markdown.
              </Text>
            ) : null}
          </section>

          <section className={PANE} data-mobile-hidden={mobilePane !== 'output' ? '' : undefined}>
            <div className={PANE_HEAD}>
              <Text as="span" size="sm" weight="medium" muted>
                Rendered output
              </Text>
              <Badge variant="subtle" tone={playing ? 'warning' : done ? 'success' : 'neutral'} size="sm">
                {playing ? 'streaming' : done ? 'complete' : shown === 0 ? 'empty' : 'paused'}
              </Badge>
            </div>
            <div className="h-0.5 bg-muted" aria-hidden="true">
              <div className="h-full bg-primary" style={{ width: `${total === 0 ? 0 : (shown / total) * 100}%` }} />
            </div>
            <div
              ref={output}
              className="flex-1 overflow-auto px-[1.1rem] py-4"
              onScroll={(event) => {
                const element = event.currentTarget
                pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40
              }}
            >
              <div ref={rendered} className={cn('rmk-document', CURSOR)}>
                <Markdown preset={preset}>{prefix}</Markdown>
              </div>
            </div>
          </section>
        </div>

        <StatusStrip>
          <PaneSwitch panes={PANES} value={mobilePane} onChange={setMobilePane} />
          <span>
            tokens <b>{shown}</b> / {total}
          </span>
          <span>
            characters <b>{prefix.length}</b>
          </span>
          <span>
            chunks <b>{renders}</b>
          </span>
          <span>
            elapsed <b>{(elapsed / 1000).toFixed(1)} s</b>
          </span>
          <span className="ml-auto max-[900px]:ml-0">every chunk is a full parse and render of the prefix</span>
          <DocsLink />
        </StatusStrip>
      </div>
    </ActivityScope>
  )
}
