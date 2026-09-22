/**
 * Theme tokens (docs/MERMAID_PLATFORM.md section 7): every fallback is a
 * six-digit hex colour and every attribute value has the documented shape.
 */
import { describe, expect, it } from 'vitest'
import { DIAGRAM_THEME, DIAGRAM_TOKEN_PREFIX, token, tokenProperty, type DiagramThemeToken } from '../src/svg/theme.js'

const TOKENS = Object.keys(DIAGRAM_THEME) as DiagramThemeToken[]

describe('svg/theme', () => {
  it('declares the section 7 tokens, named by role', () => {
    expect(TOKENS).toEqual([
      'actor-fill',
      'actor-stroke',
      'actor-text',
      'line',
      'signal',
      'signal-text',
      'label-fill',
      'label-stroke',
      'label-text',
      'note-fill',
      'note-stroke',
      'note-text',
      'activation-fill',
      'activation-stroke',
      'number-text',
    ])
  })

  it('every fallback is a six-digit lower-case hex colour', () => {
    for (const name of TOKENS) {
      expect(DIAGRAM_THEME[name].fallback, name).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('every token names the Mermaid theme variable it stands in for', () => {
    for (const name of TOKENS) {
      expect(DIAGRAM_THEME[name].mermaid, name).toMatch(/^[a-z][A-Za-z]+$/)
    }
    expect(DIAGRAM_THEME['note-fill']).toEqual({ mermaid: 'noteBkgColor', fallback: '#fff5ad' })
    expect(DIAGRAM_THEME.signal).toEqual({ mermaid: 'signalColor', fallback: '#333333' })
  })

  it('token() returns the var() string with its fallback', () => {
    expect(token('note-fill')).toBe('var(--rmk-diagram-note-fill, #fff5ad)')
    expect(token('actor-stroke')).toBe('var(--rmk-diagram-actor-stroke, #9370db)')
    for (const name of TOKENS) {
      expect(token(name)).toMatch(/^var\(--rmk-diagram-[a-z-]+, #[0-9a-f]{6}\)$/)
    }
  })

  it('tokenProperty() is the custom property name under the shared prefix', () => {
    expect(DIAGRAM_TOKEN_PREFIX).toBe('--rmk-diagram-')
    expect(tokenProperty('line')).toBe('--rmk-diagram-line')
  })
})
