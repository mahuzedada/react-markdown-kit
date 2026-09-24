/**
 * Text widths from the canvas's rendered font, so the SVG wraps a line
 * exactly where the inline text field does (Excalidraw's WYSIWYG editing).
 * Without a browser, or before the canvas has mounted, the core estimate
 * (0.6em a character) stands in, which is also what layout sizes boxes by.
 */
import { createContext, useContext } from 'react'
import { textBoxSize, wrapText } from '../core/geometry.js'
import { LINE_HEIGHT } from '../core/drawing-data.js'

/** Width of one line of text at a font size, in user units. */
export type TextMeasure = (line: string, fontSize: number, weight?: number) => number

export const TextMeasureContext = createContext<TextMeasure | null>(null)

export function useTextMeasure(): TextMeasure | null {
  return useContext(TextMeasureContext)
}

/**
 * A measure in `el`'s font family and letter spacing (in em, as the ink
 * style sets it), or null when `el` has no layout (hidden) or there is
 * no 2D canvas to measure with (no browser, or jsdom).
 */
export function createTextMeasure(el: Element, letterSpacingEm = 0): TextMeasure | null {
  if (typeof CanvasRenderingContext2D === 'undefined' || el.getBoundingClientRect().width === 0) return null
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  const family = getComputedStyle(el).fontFamily
  if (!family) return null
  const cache = new Map<string, number>()
  return (line, fontSize, weight = 400) => {
    const key = `${weight}|${fontSize}|${line}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    ctx.font = `${weight} ${fontSize}px ${family}`
    const width = ctx.measureText(line).width + line.length * letterSpacingEm * fontSize
    if (cache.size > 2000) cache.clear()
    cache.set(key, width)
    return width
  }
}

/**
 * Lines of `text` wrapped at word boundaries to `maxWidth`, a word wider
 * than a line broken where it overflows: `wrapText` with measured widths.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: TextMeasure | null,
  weight?: number,
): string[] {
  if (measure === null) return wrapText(text, maxWidth, fontSize)
  const fits = (line: string): boolean => measure(line, fontSize, weight) <= maxWidth
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (fits(para)) {
      lines.push(para)
      continue
    }
    let current = ''
    for (let word of para.split(' ')) {
      while (!fits(word)) {
        if (current) {
          lines.push(current)
          current = ''
        }
        let cut = 1
        while (cut < word.length && fits(word.slice(0, cut + 1))) cut++
        lines.push(word.slice(0, cut))
        word = word.slice(cut)
      }
      if (!current) {
        current = word
      } else if (fits(`${current} ${word}`)) {
        current += ` ${word}`
      } else {
        lines.push(current)
        current = word
      }
    }
    lines.push(current)
  }
  return lines
}

/** Size of already-broken lines: the widest line by the lines' height. */
export function linesSize(
  lines: readonly string[],
  fontSize: number,
  measure: TextMeasure | null,
): { w: number; h: number } {
  if (measure === null) return textBoxSize(lines.join('\n'), fontSize)
  const widest = lines.reduce((max, line) => Math.max(max, measure(line, fontSize)), 0)
  return { w: Math.max(20, widest), h: lines.length * fontSize * LINE_HEIGHT }
}
