/**
 * Per-editor labels for the slide nodes' own UI.
 *
 * A node's `decorate` has no React context of its own, so the plugin
 * publishes the labels it was configured with against the `LexicalEditor`
 * it registers on and the node UI subscribes; a node decorated before the
 * plugin ran still picks them up (mermaid's canvas options work the same
 * way). On top of that the editor's flat `labels` map overrides any string
 * under `slides.<key>`, the way `diagram.<key>` does for the canvas.
 * Function labels keep their defaults.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { LexicalEditor } from 'lexical'
import { useLexicalEditor } from '@react-markdown-kit/editor/lexical'

export interface SlidesEditorLabels {
  /** Caption of the `???` divider. */
  readonly notes: string
  /** Caption of the `--` divider. */
  readonly pause: string
  /** Accessible name of a `---` slide break. */
  readonly slideBreak: string
  /** Accessible name of a `***` rule inside a slide. */
  readonly rule: string
  /** Accessible name of a directive chip and its input, from the directive key. */
  readonly directive: (key: string) => string
  /** Placeholder of a chip's input while it has no value yet. */
  readonly directiveValue: string
}

export const SLIDES_EDITOR_LABELS: SlidesEditorLabels = {
  notes: 'Speaker notes',
  pause: 'Pause',
  slideBreak: 'Slide break',
  rule: 'Rule',
  directive: (key) => `${key} directive`,
  directiveValue: 'Value',
}

/** Prefix of the slide labels in the editor's flat `labels` map. */
export const SLIDES_EDITOR_LABEL_PREFIX = 'slides.'

const published = new WeakMap<LexicalEditor, SlidesEditorLabels>()
const listeners = new WeakMap<LexicalEditor, Set<() => void>>()

function notify(editor: LexicalEditor): void {
  for (const listener of listeners.get(editor) ?? []) listener()
}

/** Registers `labels` for `editor`; returns the function that removes them again. */
export function setSlidesEditorLabels(editor: LexicalEditor, labels: SlidesEditorLabels): () => void {
  published.set(editor, labels)
  notify(editor)
  return () => {
    if (published.get(editor) !== labels) return
    published.delete(editor)
    notify(editor)
  }
}

export function slidesEditorLabelsOf(editor: LexicalEditor): SlidesEditorLabels {
  return published.get(editor) ?? SLIDES_EDITOR_LABELS
}

function subscribe(editor: LexicalEditor, listener: () => void): () => void {
  let set = listeners.get(editor)
  if (set === undefined) {
    set = new Set()
    listeners.set(editor, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

/** `base` with every `slides.<key>` string in the editor's flat `labels` applied. */
export function resolveSlidesEditorLabels(
  base: SlidesEditorLabels,
  labels: Readonly<Partial<Record<string, string>>> | undefined,
): SlidesEditorLabels {
  if (labels === undefined) return base
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(base)) {
    if (typeof out[key] !== 'string') continue
    const override = labels[`${SLIDES_EDITOR_LABEL_PREFIX}${key}`]
    if (typeof override === 'string') out[key] = override
  }
  return out as unknown as SlidesEditorLabels
}

/** The labels a node decorator should draw with, live. Only valid inside a decorator. */
export function useSlidesEditorLabels(editor: LexicalEditor): SlidesEditorLabels {
  const subscribeTo = useCallback((listener: () => void) => subscribe(editor, listener), [editor])
  const read = useCallback(() => slidesEditorLabelsOf(editor), [editor])
  const base = useSyncExternalStore(subscribeTo, read, read)
  const { labels } = useLexicalEditor()
  return useMemo(() => resolveSlidesEditorLabels(base, labels), [base, labels])
}
