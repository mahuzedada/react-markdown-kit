/**
 * Node class hooks.
 *
 * Node DOM is created inside Lexical, outside React, so `classNames` reaches it
 * through the editor config's theme. Parts that map to a semantic element
 * (`h2`, `blockquote`, `li`) get no class at all unless the consumer asks for
 * one, matching the renderer's clean-DOM rule; parts with no semantic element
 * of their own (the opaque block) carry an `rmk-` default.
 */
import type { EditorConfig } from 'lexical'
import { partClass } from '@internal/styling/index.js'
import type { EditorClassNames, EditorClassNamePart } from '../class-names.js'

/** Parts that carry an `rmk-` default because no element names them. */
const DEFAULTED: ReadonlySet<EditorClassNamePart> = new Set<EditorClassNamePart>([
  'opaque',
  'opaqueSource',
  'inlineOpaque',
  'variableChip',
  // Lexical renders bold, italic and strikethrough as a bare <span> (only
  // inline code gets a semantic <code>), so these three have nothing else to
  // be styled by.
  'strong',
  'emphasis',
  'strikethrough',
])

export function buildNodeTheme(classNames: EditorClassNames | undefined): Record<string, unknown> {
  const theme: Record<string, unknown> = {}
  const parts: EditorClassNamePart[] = [
    'opaque',
    'opaqueSource',
    'inlineOpaque',
    'variableChip',
    'image',
    'codeBlock',
    'table',
  ]
  for (const part of parts) {
    const value = classFor(part, classNames)
    if (value !== undefined) theme[part] = value
  }
  // Lexical's own theme slot for text formats.
  const text: Record<string, string> = {}
  const bold = classFor('strong', classNames)
  const italic = classFor('emphasis', classNames)
  const strikethrough = classFor('strikethrough', classNames)
  if (bold !== undefined) text['bold'] = bold
  if (italic !== undefined) text['italic'] = italic
  if (strikethrough !== undefined) text['strikethrough'] = strikethrough
  if (Object.keys(text).length > 0) theme['text'] = text
  return theme
}

function classFor(
  part: EditorClassNamePart,
  classNames: EditorClassNames | undefined,
): string | undefined {
  const explicit = classNames?.[part]
  const value = explicit ?? (DEFAULTED.has(part) ? partClass(part, undefined) : undefined)
  return value === undefined || value === '' ? undefined : value
}

export function themeClass(config: EditorConfig, part: EditorClassNamePart): string | undefined {
  const value = (config.theme as Record<string, unknown>)[part]
  return typeof value === 'string' && value !== '' ? value : undefined
}
