/**
 * The editing engine, reachable from a node decorator.
 *
 * Decorator components are rendered by the editor package through portals, so
 * a React context set around those portals is the one channel an extension's
 * node UI has back to the `LexicalEditor` that owns it. Exposed only through
 * `@react-markdown-kit/editor/lexical`; the root entry never names Lexical.
 */
import { createContext, useContext } from 'react'
import type { LexicalEditor } from 'lexical'
import type { MarkdownEditorLabels } from '../types.js'

export interface LexicalEditorContextValue {
  readonly editor: LexicalEditor
  readonly readOnly: boolean
  /** Chrome strings passed to the editor, for an extension's own UI. */
  readonly labels: MarkdownEditorLabels | undefined
}

export const LexicalEditorContext = createContext<LexicalEditorContextValue | null>(null)

export function useLexicalEditor(): LexicalEditorContextValue {
  const value = useContext(LexicalEditorContext)
  if (value === null) {
    throw new Error(
      'useLexicalEditor() must be called from a node decorator rendered inside <MarkdownEditorContent>.',
    )
  }
  return value
}
