import { useCallback, useMemo, useState, type ReactNode } from 'react'
import Markdown, { compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { template } from '@react-markdown-kit/template'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import { templateVariables } from '@react-markdown-kit/template/editor'
import { useShareHash } from './use-share-hash'
import styles from './KitDemo.module.css'

import '@react-markdown-kit/renderer/styles.css'
import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/mermaid/styles.css'
import '@react-markdown-kit/template/styles.css'

// One dialect for the editor, the template plugin and the renderer, Mermaid included.
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

/**
 * The editor, with both plugins, wired the way a real application would wire
 * them: the editor authors a template with placeholders as chips and a
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

  // The source is recompiled as the author types, with the template plugin
  // filling it in for the customer.
  const result = useMemo(() => {
    const document = compileMarkdown(source, {
      preset,
      extensions: [template({ data: CUSTOMER.data, locale: CUSTOMER.locale })],
    })
    const diagnostics = document.diagnostics
    return { ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'), document, diagnostics }
  }, [source])

  // Chips in the editor preview the customer. Preview data is display only:
  // the saved source keeps its placeholders.
  const editorExtensions = useMemo(
    () => [templateVariables({ previewData: CUSTOMER.data, previewLocale: CUSTOMER.locale })],
    [],
  )

  return (
    <div className={styles.shell}>
      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.colHead}>
            <span>Authored template</span>
            <span className={styles.actions}>
              <span className={styles.badgeStable}>saved as Markdown, placeholders and all</span>
              <button
                type="button"
                className={styles.action}
                disabled={link === undefined}
                title="Copies a link with this document in the URL hash. Nothing is uploaded."
                onClick={copyLink}
              >
                {copied === 'copied' ? 'Copied' : 'Copy link'}
              </button>
            </span>
          </div>
          <div className={styles.editorWrap}>
            <MarkdownEditor preset={preset} extensions={editorExtensions} value={source} onChange={setSource} />
          </div>
          {copied === 'blocked' ? (
            <p className={styles.note}>
              This browser would not write to the clipboard. The address bar holds the same link.
            </p>
          ) : null}
          {unreadable ? (
            <p className={styles.note}>
              This link could not be read in this browser, so the example document is shown. The address bar still
              holds the shared link; editing replaces it.
            </p>
          ) : null}
        </div>

        <div className={styles.col}>
          <div className={styles.colHead}>
            <span>Resolved for {CUSTOMER.label}</span>
            <span className={styles.badgeLive}>follows every edit</span>
          </div>
          {result.ok ? (
            <div className={`${styles.output} rmk-document`}>
              <Markdown preset={preset} document={result.document} />
            </div>
          ) : (
            <ul className={styles.diagnostics}>
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
  )
}
