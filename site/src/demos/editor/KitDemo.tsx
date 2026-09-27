import { useCallback, useMemo, useState, type ReactNode } from 'react'
import Markdown, { compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { variables } from '@react-markdown-kit/variables'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { ActivityScope } from '@zuilib/primitives/activity'
import Badge from '@zuilib/primitives/badge'
import Button from '@zuilib/primitives/button'
import Text from '@zuilib/primitives/text'
import { cn } from '@zuilib/primitives/lib/cn'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import { variableChips } from '@react-markdown-kit/variables/editor'
import { useShareHash } from './use-share-hash'

import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/mermaid/styles.css'
import '@react-markdown-kit/variables/styles.css'

// One dialect for the editor, the variables plugin and the renderer, Mermaid included.
const preset = defineMarkdownPreset({ extensions: [gfm(), mermaid()] })

const INITIAL = `![{{brand.logoAlt}}]({{brand.logoUrl}})

# Account review for {{customer.name}}

Hello {{contact.firstName}}, your plan renews on {{renewsAt | date:"long"}}.

| Line item | Amount |
| --- | ---: |
| Subscription | {{amounts.subscription \\| currency:"USD"}} |
| Overage | {{amounts.overage \\| currency:"USD"}} |

Usage is at {{usage.ratio | percent}} of the included allowance.

## How your data flows

\`\`\`mermaid
flowchart LR
    site["SOURCE<br/>Your site"] -->|usage| kit["PIPELINE<br/>Report job"]
    kit -->|PDF| inbox>Monthly email]
    style site fill:#a5d8ff,stroke:#1971c2
    style kit fill:#b2f2bb,stroke:#2f9e44
    style inbox fill:#ffec99,stroke:#f08c00
\`\`\`
`

const CUSTOMER = {
  label: 'Acme Industrial',
  locale: 'en-US',
  data: {
    brand: { logoAlt: 'Acme Industrial', logoUrl: 'https://placehold.co/160x40/0f6f6b/fff?text=ACME' },
    customer: { name: 'Acme Industrial' },
    contact: { firstName: 'Dana' },
    renewsAt: '2026-11-01',
    amounts: { subscription: 4800, overage: 312.5 },
    usage: { ratio: 0.78 },
  },
}

type CopyState = 'copied' | 'blocked' | undefined

/** How long the button reports the copy before going back to its label. */
const COPIED_MS = 1500

/** One pane of the workbench, and the title bar across its top. */
const COLUMN = 'flex min-h-0 min-w-0 flex-col'
const COLUMN_HEAD = 'flex items-center justify-between gap-2 border-b border-border px-3 py-1.5'

/** A line under the editor about the share link. */
const NOTE = 'm-0 border-t border-border px-3 py-1.5'

/**
 * The editor, with both plugins, wired the way a real application would wire
 * them: the editor authors a document with placeholders as chips and a
 * diagram on a canvas, and the renderer shows the same document resolved for
 * one customer. Edit on the left and the right follows.
 *
 * The document also lives in the URL hash (src/share.ts), so "Copy link"
 * hands over a link that carries it. Nothing is uploaded.
 */
export default function KitDemo(): ReactNode {
  const [source, setSource] = useState(INITIAL)
  const [copied, setCopied] = useState<CopyState>(undefined)
  const { link, unreadable } = useShareHash(source, setSource, INITIAL)

  const copyLink = useCallback(() => {
    if (link === undefined) return
    const report = (state: CopyState): void => {
      setCopied(state)
      setTimeout(() => setCopied((current) => (current === state ? undefined : current)), COPIED_MS)
    }
    if (typeof navigator.clipboard?.writeText !== 'function') {
      report('blocked')
      return
    }
    navigator.clipboard.writeText(link).then(
      () => report('copied'),
      () => report('blocked'),
    )
  }, [link])

  // The source is recompiled as the author types, with the variables plugin
  // filling it in for the customer.
  const result = useMemo(() => {
    const document = compileMarkdown(source, {
      preset,
      extensions: [variables({ data: CUSTOMER.data, locale: CUSTOMER.locale })],
    })
    const diagnostics = document.diagnostics
    return { ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'), document, diagnostics }
  }, [source])

  // Chips in the editor preview the customer. Preview data is display only:
  // the saved source keeps its placeholders.
  const editorExtensions = useMemo(
    () => [variableChips({ previewData: CUSTOMER.data, previewLocale: CUSTOMER.locale })],
    [],
  )

  return (
    <ActivityScope feature="editor-workbench">
      {/* Full-bleed and exactly one viewport tall; the page scrolls past it. */}
      <div className="flex h-[var(--rmk-demo-height,100dvh)] flex-col overflow-hidden border-b border-border bg-card">
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className={COLUMN}>
            <div className={COLUMN_HEAD}>
              <Text as="span" size="sm" weight="semibold">
                Authored source
              </Text>
              <span className="flex min-w-0 items-center gap-1.5">
                <Badge variant="subtle" tone="success" size="sm">
                  saved as Markdown, placeholders and all
                </Badge>
                <Button
                  variant="outline"
                  tone="primary"
                  size="sm"
                  track="copy-link"
                  disabled={link === undefined}
                  title="Copies a link with this document in the URL hash. Nothing is uploaded."
                  onClick={copyLink}
                >
                  {copied === 'copied' ? 'Copied' : 'Copy link'}
                </Button>
              </span>
            </div>
            {/* The editor fills its pane; its toolbar stays put and only the content scrolls. */}
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col',
                // The kit's stylesheet is unlayered, so overrides of its own properties need `!`.
                '[&>.rmk-editor]:min-h-0 [&>.rmk-editor]:flex-1 [&>.rmk-editor]:rounded-none! [&>.rmk-editor]:border-0!',
                '[&_.rmk-editor_.rmk-content]:min-h-0! [&_.rmk-editor_.rmk-content]:flex-1 [&_.rmk-editor_.rmk-content]:overflow-auto',
                '[&_.rmk-editor_.rmk-source-textarea]:min-h-0! [&_.rmk-editor_.rmk-source-textarea]:flex-1 [&_.rmk-editor_.rmk-source-textarea]:resize-none!',
              )}
            >
              <MarkdownEditor preset={preset} extensions={editorExtensions} value={source} onChange={setSource} />
            </div>
            {copied === 'blocked' ? (
              <Text size="sm" className={NOTE}>
                This browser blocked the clipboard, but the same link is in the address bar.
              </Text>
            ) : null}
            {unreadable ? (
              <Text size="sm" className={NOTE}>
                This browser couldn&rsquo;t read the link, so you&rsquo;re seeing the example document instead. The
                shared link is still in the address bar, and editing will replace it.
              </Text>
            ) : null}
          </div>

          <div className={cn(COLUMN, 'border-l border-border max-[900px]:border-t max-[900px]:border-l-0')}>
            <div className={COLUMN_HEAD}>
              <Text as="span" size="sm" weight="semibold">
                Resolved for {CUSTOMER.label}
              </Text>
              <Badge variant="subtle" tone="warning" size="sm">
                follows every edit
              </Badge>
            </div>
            {result.ok ? (
              <div className="rmk-document min-h-0 flex-1 overflow-auto px-4.5 py-3.5">
                <Markdown preset={preset} document={result.document} />
              </div>
            ) : (
              <ul className="m-0 py-3 pr-3 pl-7.5 text-sm text-danger-text">
                {result.diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.code}-${index}`}>
                    <code>{diagnostic.code}</code>{' '}
                    {diagnostic.path === undefined ? '' : <code>{diagnostic.path}</code>}{' '}
                    {diagnostic.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </ActivityScope>
  )
}
