/**
 * `MarkdownEditorProvider` / `useMarkdownEditorContext` (spec 7.5).
 *
 * The composable route: build an instance with `useMarkdownEditor`, put it in
 * context, and assemble the surface out of whatever components the application
 * already has. No part of the default chrome is required.
 */
import { createContext, useContext, type ReactElement, type ReactNode } from 'react'
import type { MarkdownEditorInstance } from '../types.js'

const MarkdownEditorContext = createContext<MarkdownEditorInstance | null>(null)

export interface MarkdownEditorProviderProps {
  readonly editor: MarkdownEditorInstance
  readonly children?: ReactNode
}

export function MarkdownEditorProvider(props: MarkdownEditorProviderProps): ReactElement {
  return (
    <MarkdownEditorContext.Provider value={props.editor}>
      {props.children}
    </MarkdownEditorContext.Provider>
  )
}

export function useMarkdownEditorContext(): MarkdownEditorInstance {
  const editor = useContext(MarkdownEditorContext)
  if (editor === null) {
    throw new Error(
      'useMarkdownEditorContext() must be used inside <MarkdownEditorProvider editor={useMarkdownEditor(...)}>.',
    )
  }
  return editor
}

/** Returns null outside a provider, for chrome that may render either way. */
export function useOptionalMarkdownEditorContext(): MarkdownEditorInstance | null {
  return useContext(MarkdownEditorContext)
}
