import { useMemo, type ReactNode } from 'react'
import Badge from '@zuilib/primitives/badge'
import Text from '@zuilib/primitives/text'
import CodePane from '../../components/CodePane'
import { tokenizeDeck, type DeckTokenKind } from './highlight'

/** Token colours, all from the theme's intent colours. The plugin's own syntax is the loudest. */
const TOKEN_CLASSES = {
  break: 'text-primary-text font-semibold',
  marker: 'text-warning-text font-semibold',
  directive: 'text-muted-foreground',
  value: 'text-success-text',
  key: 'text-primary-text',
  heading: 'text-foreground font-semibold',
  fence: 'text-muted-foreground',
  code: 'text-success-text',
  bullet: 'text-warning-text',
  quote: 'text-muted-foreground',
  inlineCode: 'text-success-text',
  strong: 'font-semibold',
  link: 'text-primary-text underline',
} satisfies Record<DeckTokenKind, string>

export interface SourcePaneProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly className: string
  readonly head: string
  readonly hidden: boolean
}

/** The left pane: the deck file as plain text, with the plugin's syntax coloured. What you type here is what gets saved. */
export default function SourcePane({ value, onChange, className, head, hidden }: SourcePaneProps): ReactNode {
  const lines = useMemo(() => tokenizeDeck(value), [value])
  return (
    <div className={className} data-mobile-hidden={hidden ? '' : undefined}>
      <div className={head}>
        <Text as="span" size="sm" weight="medium">
          deck.md
        </Text>
        <Badge variant="subtle" tone="success" size="sm" className="whitespace-nowrap">
          plain Markdown, the file as saved
        </Badge>
      </div>
      <CodePane value={value} onChange={onChange} label="Deck source" lines={lines} tokenClasses={TOKEN_CLASSES} />
      <Text size="sm" muted className="m-0 border-t border-border px-[0.9rem] py-2 [&_code]:font-mono [&_code]:text-[0.9em]">
        <code>---</code> starts a slide, <code>--</code> a step, <code>???</code> the notes and <code>::right::</code> a second
        column. While presenting, press <code>?</code> for the keys.
      </Text>
    </div>
  )
}
