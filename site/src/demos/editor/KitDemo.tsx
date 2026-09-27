import { useMemo, useRef, useState, type ReactNode } from 'react'
import Markdown, { compileMarkdown, defineMarkdownPreset, gfm, type MarkdownDocument } from '@react-markdown-kit/renderer'
import { variables } from '@react-markdown-kit/variables'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import Tabs from '@zuilib/primitives/tabs'
import Text from '@zuilib/primitives/text'
import { cn } from '@zuilib/primitives/lib/cn'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import { variableChips } from '@react-markdown-kit/variables/editor'
import { DocsLink, PaneSwitch, StatusStrip } from '../../components/DemoStrip'
import { useCopy } from '../../lib/use-copy'
import { useShareLink } from '../../lib/use-share-link'

import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/mermaid/styles.css'
import '@react-markdown-kit/variables/styles.css'

// One dialect for the editor, the variables plugin and the renderer, Mermaid included.
const preset = defineMarkdownPreset({ extensions: [gfm(), mermaid()] })

const INITIAL = `# Launch plan: search v2

**Owner:** {{team.name}} · **Ships:** {{launch.date | date:"long"}}

This is rich mode. The pane on the right shows the Markdown it saves, and the source mode button in the toolbar shows the same text here.

## Before launch

- [x] Load test the new index
- [x] Write the migration guide
- [ ] Turn the flag on for 10% of traffic

## Rollout

| Stage | Traffic | Watch |
| --- | ---: | --- |
| Canary | 1% | error rate |
| Ramp | 10% | p95 latency |
| Full | 100% | support tickets |

> Roll back by turning the flag off. The old index stays warm for a week.

\`\`\`ts
export const searchV2 = flag('search-v2', { rollout: 0.1 })
\`\`\`

## How a query flows

\`\`\`mermaid
flowchart LR
    ui["CLIENT<br/>Search box"] -->|query| api["API<br/>Search service"]
    api -->|flag on| next[(New index)]
    api -->|flag off| old[(Old index)]
    style ui fill:#a5d8ff,stroke:#1971c2
    style api fill:#b2f2bb,stroke:#2f9e44
    style next fill:#d0bfff,stroke:#7048e8
    style old fill:#e9ecef,stroke:#868e96
\`\`\`
`

/** What the placeholders resolve to on the Rendered tab and preview as in the chips. */
const DATA = {
  team: { name: 'Search platform' },
  launch: { date: '2026-11-03' },
}
const LOCALE = 'en-US'

type OutputTab = 'markdown' | 'rendered'
const TABS: readonly (readonly [OutputTab, string])[] = [
  ['markdown', 'Saved Markdown'],
  ['rendered', 'Rendered'],
]

type MobilePane = 'editor' | 'output'
const PANES: readonly (readonly [MobilePane, string])[] = [
  ['editor', 'Editor'],
  ['output', 'Output'],
]

/** One pane of the workbench, and the title bar across its top. Below 900px one pane shows at a time. */
const COLUMN = 'flex min-h-0 min-w-0 flex-col max-[900px]:data-[mobile-hidden]:hidden'
const COLUMN_HEAD = 'flex min-h-[2.35rem] items-center justify-between gap-2 border-b border-border px-3 py-1'
const FILL = 'flex min-h-0 flex-1 flex-col'

/** A line under the editor about the share link. */
const NOTE = 'm-0 border-t border-border px-3 py-1.5'

/**
 * The editor with both plugins, wired the way a real application would wire
 * them: the editor writes a document with placeholders as chips and a
 * diagram on a canvas. The right pane shows the Markdown the editor saves
 * and the same document rendered, with the placeholders filled in.
 *
 * The document also lives in the URL hash (src/lib/use-share-link.ts), so
 * "Copy link" hands over a link that carries it. Nothing is uploaded.
 */
export default function KitDemo(): ReactNode {
  const [source, setSource] = useState(INITIAL)
  const [tab, setTab] = useState<OutputTab>('markdown')
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor')
  const { copied, blocked, copy } = useCopy()
  const pristine = source === INITIAL
  const { link, unreadable } = useShareLink({ source, setSource, pristine })

  // The source is recompiled as the author types, with the variables plugin filling it in.
  const result = useMemo(() => {
    const document = compileMarkdown(source, {
      preset,
      extensions: [variables({ data: DATA, locale: LOCALE })],
    })
    const diagnostics = document.diagnostics
    return { ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'), document, diagnostics }
  }, [source])

  // The plugin never renders a half-filled document. While the author types
  // a placeholder the data doesn't have, the tab keeps the last document
  // that resolved and says what is wrong above it.
  const lastGood = useRef<MarkdownDocument | undefined>(undefined)
  if (result.ok) lastGood.current = result.document
  const shown = result.ok ? result.document : lastGood.current

  // Chips in the editor preview the data. Preview data is display only:
  // the saved source keeps its placeholders.
  const editorExtensions = useMemo(() => [variableChips({ previewData: DATA, previewLocale: LOCALE })], [])

  return (
    <ActivityScope feature="editor-workbench">
      {/* Full-bleed and exactly one viewport tall; the page scrolls past it. */}
      <div className="flex h-[var(--rmk-demo-height,100dvh)] flex-col overflow-hidden border-b border-border bg-card">
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] max-[900px]:grid-cols-1">
          <div className={COLUMN} data-mobile-hidden={mobilePane !== 'editor' ? '' : undefined}>
            <div className={COLUMN_HEAD}>
              <Text as="span" size="sm" weight="medium" muted>
                Editor
              </Text>
              <span className="flex min-w-0 items-center gap-1">
                {pristine ? null : (
                  <Button variant="ghost" size="sm" track="reset" onClick={() => setSource(INITIAL)}>
                    Reset
                  </Button>
                )}
                <Button
                  variant="outline"
                  tone="primary"
                  size="sm"
                  track="copy-link"
                  disabled={link === undefined}
                  title="Copies a link with this document in the URL hash. Nothing is uploaded."
                  onClick={() => link !== undefined && void copy('link', link)}
                >
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </Button>
              </span>
            </div>
            {/* The editor fills its pane; its toolbar stays put and only the content scrolls. */}
            <div
              className={cn(
                FILL,
                // The kit's stylesheet is unlayered, so overrides of its own properties need `!`.
                '[&>.rmk-editor]:min-h-0 [&>.rmk-editor]:flex-1 [&>.rmk-editor]:rounded-none! [&>.rmk-editor]:border-0!',
                '[&_.rmk-editor_.rmk-content]:min-h-0! [&_.rmk-editor_.rmk-content]:flex-1 [&_.rmk-editor_.rmk-content]:overflow-auto',
                '[&_.rmk-editor_.rmk-source-textarea]:min-h-0! [&_.rmk-editor_.rmk-source-textarea]:flex-1 [&_.rmk-editor_.rmk-source-textarea]:resize-none!',
              )}
            >
              <MarkdownEditor preset={preset} extensions={editorExtensions} value={source} onChange={setSource} />
            </div>
            {blocked === 'link' ? (
              <Text size="sm" className={NOTE}>
                This browser blocked the clipboard. The link is in the address bar once you edit the document.
              </Text>
            ) : null}
            {unreadable ? (
              <Text size="sm" className={NOTE}>
                This browser couldn&rsquo;t read the link, so you&rsquo;re seeing the example document instead. The
                shared link is still in the address bar, and editing will replace it.
              </Text>
            ) : null}
          </div>

          <div
            className={cn(COLUMN, 'border-l border-border max-[900px]:border-l-0')}
            data-mobile-hidden={mobilePane !== 'output' ? '' : undefined}
          >
            <Tabs
              className={FILL}
              variant="pills"
              size="sm"
              track="output"
              selectedIndex={TABS.findIndex(([name]) => name === tab)}
              onSelectedIndexChange={(index) => setTab(TABS[index]?.[0] ?? 'markdown')}
            >
              <div className={COLUMN_HEAD}>
                <Tabs.List>
                  {TABS.map(([name, label]) => (
                    <Tabs.Tab key={name}>{label}</Tabs.Tab>
                  ))}
                </Tabs.List>
                {tab === 'markdown' ? (
                  <Button variant="ghost" size="sm" track="copy-markdown" onClick={() => void copy('markdown', source)}>
                    {copied === 'markdown' ? 'Copied' : 'Copy'}
                  </Button>
                ) : null}
              </div>
              <Tabs.Panels className={cn(FILL, 'mt-0')}>
                <Tabs.Panel className={FILL}>
                  <pre className="m-0 flex-1 overflow-auto bg-transparent p-[0.9rem] font-mono text-[0.76rem] leading-[1.55] whitespace-pre-wrap text-foreground [word-break:break-word]">
                    {source}
                  </pre>
                </Tabs.Panel>
                <Tabs.Panel className="min-h-0 flex-1 overflow-auto">
                  {result.ok ? null : (
                    <div className="border-b border-border bg-danger/8 px-4 py-2 text-sm text-danger-text">
                      <p className="m-0">Showing the last version that resolved. The current one doesn&rsquo;t:</p>
                      <ul className="m-0 mt-1 pl-5">
                        {result.diagnostics
                          .filter((diagnostic) => diagnostic.severity === 'error')
                          .map((diagnostic, index) => (
                            <li key={`${diagnostic.code}-${index}`}>
                              {diagnostic.path === undefined ? null : <code>{diagnostic.path}</code>} {diagnostic.message}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {shown === undefined ? null : (
                    <div className={cn('rmk-document px-4.5 py-3.5', !result.ok && 'opacity-60')}>
                      <Markdown preset={preset} document={shown} />
                    </div>
                  )}
                </Tabs.Panel>
              </Tabs.Panels>
            </Tabs>
          </div>
        </div>

        <StatusStrip>
          <PaneSwitch panes={PANES} value={mobilePane} onChange={setMobilePane} />
          <span>
            characters <b>{source.length}</b>
          </span>
          <span>
            errors <b>{result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length}</b>
          </span>
          <span className="ml-auto max-[900px]:ml-0">edited in this browser, nothing is uploaded</span>
          <DocsLink />
        </StatusStrip>
      </div>
    </ActivityScope>
  )
}
