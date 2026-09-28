import { useMemo, type ReactNode } from 'react'
import SharedCodePane from '../../components/CodePane'
import { tokenize, type TokenKind } from './highlight'

/** Token colours, all derived from the theme's intent colours. */
const TOKEN_CLASSES = {
  comment: 'text-muted-foreground italic',
  string: 'text-success-text',
  label: 'text-success-text',
  edge: 'text-warning-text font-semibold',
  color: 'text-danger-text',
  keyword: 'text-primary-text font-semibold',
  direction: 'text-primary-text',
  bracket: 'text-muted-foreground',
} satisfies Record<Exclude<TokenKind, 'plain'>, string>

export interface CodePaneProps {
  readonly value: string
  readonly onChange: (value: string) => void
  /** Accessible name of the textarea. */
  readonly label: string
  /** The detected diagram kind, which picks the keyword set. Default flowchart. */
  readonly kind?: string
}

/** The Mermaid source pane: the shared code pane with Mermaid colours, which follow the detected kind. */
export default function CodePane({ value, onChange, label, kind = 'flowchart' }: CodePaneProps): ReactNode {
  const lines = useMemo(() => tokenize(value, kind), [value, kind])
  return <SharedCodePane value={value} onChange={onChange} label={label} lines={lines} tokenClasses={TOKEN_CLASSES} />
}
