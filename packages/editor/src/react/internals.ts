/**
 * The private half of an editor instance.
 *
 * `MarkdownEditorInstance` is the public contract and stays small. Everything
 * the shipped chrome needs on top of it lives here, reached through a WeakMap
 * so it never widens the public type and never leaks Lexical into it.
 */
import type { ReactNode } from 'react'
import type { MarkdownBridge } from '../bridge/session.js'
import type { EditorClassNames } from '../class-names.js'
import type {
  MarkdownEditorInstance,
  MarkdownEditorLabels,
  MarkdownEditorMode,
  MarkdownExtension,
  MarkdownPreset,
} from '../types.js'

export interface EditorInternals {
  readonly bridge: MarkdownBridge
  readonly mode: MarkdownEditorMode
  readonly setMode: (mode: MarkdownEditorMode) => void
  readonly value: string
  readonly setSource: (value: string) => void
  readonly preset: MarkdownPreset | undefined
  readonly extensions: readonly MarkdownExtension[] | undefined
  readonly components: Readonly<Record<string, unknown>> | undefined
  readonly classNames: EditorClassNames | undefined
  readonly readOnly: boolean
  readonly placeholder: ReactNode
  readonly labels: MarkdownEditorLabels | undefined
  readonly documentKey: string | undefined
  /** Bumped whenever the document is replaced, to remount mode surfaces. */
  readonly revision: number
}

const REGISTRY = new WeakMap<MarkdownEditorInstance, EditorInternals>()

export function attachInternals(
  instance: MarkdownEditorInstance,
  internals: EditorInternals,
): void {
  REGISTRY.set(instance, internals)
}

export function internalsOf(instance: MarkdownEditorInstance): EditorInternals {
  const internals = REGISTRY.get(instance)
  if (internals === undefined) {
    throw new Error(
      'This editor was not created by useMarkdownEditor(). Pass the object that hook returns to <MarkdownEditorProvider editor={...}>.',
    )
  }
  return internals
}
