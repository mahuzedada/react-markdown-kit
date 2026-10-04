import type { ReactNode, RefObject } from 'react'
import { Markdown, type MarkdownDocument, type MarkdownPreset } from '@react-markdown-kit/renderer'
import Badge from '@zuilib/primitives/badge'
import Text from '@zuilib/primitives/text'
import { cn } from '@zuilib/primitives/lib/cn'

/** Parser notes listed under the deck; the rest are counted. */
const NOTES_SHOWN = 3

export interface DeckPaneProps {
  readonly preset: MarkdownPreset
  readonly document: MarkdownDocument
  readonly deckRef: RefObject<HTMLDivElement | null>
  readonly className: string
  readonly head: string
  readonly hidden: boolean
  readonly streaming: boolean
}

/**
 * The right pane: the renderer with the same preset, a stack of static
 * sections until Present, and the parser's notes under it. Print is the
 * deck alone; the plugin's stylesheet gives each slide a page of its own
 * aspect.
 */
export default function DeckPane({ preset, document, deckRef, className, head, hidden, streaming }: DeckPaneProps): ReactNode {
  const problems = document.diagnostics
  return (
    <div className={className} data-mobile-hidden={hidden ? '' : undefined}>
      <div className={head}>
        <Text as="span" size="sm" weight="medium">
          Deck
        </Text>
        <Badge variant="subtle" tone="success" size="sm" className="whitespace-nowrap">
          {streaming ? 'streaming in, presenting as it grows' : 'static sections until you press Present'}
        </Badge>
      </div>
      <div className="document-deck-content" ref={deckRef}>
        <div className="rmk-document mx-auto max-w-5xl print:m-0 print:max-w-none">
          <Markdown preset={preset} document={document} />
        </div>
      </div>
      {problems.length === 0 ? null : (
        <ul
          className="m-0 list-none border-t border-border bg-warning/10 px-[0.9rem] py-1.5 text-sm text-warning-text print:hidden [&>li+li]:mt-1 [&_code]:font-mono [&_code]:text-[0.9em]"
          aria-label="Parser notes"
        >
          {problems.slice(0, NOTES_SHOWN).map((problem, index) => (
            <li key={`${problem.code}-${index}`}>
              <code>{problem.code}</code> {problem.message}
            </li>
          ))}
          {problems.length > NOTES_SHOWN ? <li>and {problems.length - NOTES_SHOWN} more</li> : null}
        </ul>
      )}
    </div>
  )
}
