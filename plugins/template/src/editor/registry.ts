/**
 * The adapter each editor instance draws its chips with. A node's `decorate`
 * has no React context of its own, so the plugin publishes the adapter here
 * when it registers and the node reads it back by editor.
 */
import type { LexicalEditor } from 'lexical'
import type { TemplateVariableAdapter } from '../variables.js'

const adapters = new WeakMap<LexicalEditor, TemplateVariableAdapter>()
const listeners = new WeakMap<LexicalEditor, Set<() => void>>()

function notify(editor: LexicalEditor): void {
  for (const listener of listeners.get(editor) ?? []) listener()
}

export function setAdapter(editor: LexicalEditor, adapter: TemplateVariableAdapter): () => void {
  adapters.set(editor, adapter)
  notify(editor)
  return () => {
    if (adapters.get(editor) !== adapter) return
    adapters.delete(editor)
    notify(editor)
  }
}

export function adapterFor(editor: LexicalEditor): TemplateVariableAdapter | undefined {
  return adapters.get(editor)
}

/** Chips subscribe so a refreshed adapter (new preview data) redraws them. */
export function subscribe(editor: LexicalEditor, listener: () => void): () => void {
  const set = listeners.get(editor) ?? new Set()
  set.add(listener)
  listeners.set(editor, set)
  return () => {
    set.delete(listener)
  }
}
