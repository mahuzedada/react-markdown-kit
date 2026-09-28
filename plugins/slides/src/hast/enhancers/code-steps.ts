/**
 * ` ```ts {1|3-4} ` becomes a `<pre data-rmk-code-steps="a b">` whose code
 * is one `<span data-rmk-code-line>` per line. The pre lists the reveal
 * step each highlight step starts at (the first starts with the block);
 * each line lists, in `data-rmk-code-focus`, the steps it is highlighted in,
 * and carries the first step's state statically, so a single `{2,4}`
 * highlight needs no script. Code another extension already split into
 * elements (a syntax highlighter) is left alone.
 */
import type { Element, ElementContent, Text } from 'hast'
import { readCodeSteps, stepFocuses, type CodeStep } from '../../deck/code-steps.js'
import { h } from '../h.js'
import type { BlockEnhancer } from './block-enhancer.js'

export const codeSteps: BlockEnhancer = (block, { counter }) => {
  if (block.type !== 'element' || block.tagName !== 'pre') return
  const code = block.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code')
  const steps = readCodeSteps((code?.data as { meta?: unknown } | undefined)?.meta)
  if (code === undefined || steps === undefined || steps === 'invalid') return
  const text = plainText(code)
  if (text === undefined) return

  const starts = steps.map((_, index) => (index === 0 ? counter.current : counter.next()))
  block.properties = { ...block.properties, dataRmkCodeSteps: starts.join(' ') }
  code.children = lineSpans(text, steps)
}

function plainText(code: Element): string | undefined {
  if (!code.children.every((child): child is Text => child.type === 'text')) return undefined
  return code.children.map((child) => child.value).join('')
}

function lineSpans(text: string, steps: readonly CodeStep[]): ElementContent[] {
  const lines = text.replace(/\n$/, '').split('\n')
  return lines.flatMap((line, index) => {
    const number = index + 1
    const focus = steps.flatMap((step, stepIndex) => (stepFocuses(step, number) ? [String(stepIndex)] : []))
    const span = h(
      'span',
      { dataRmkCodeLine: String(number), dataRmkCodeFocus: focus.join(' '), dataRmkCodeLineState: focus.includes('0') ? 'focus' : 'dim' },
      [{ type: 'text', value: line }],
    )
    return index === lines.length - 1 ? [span] : [span, { type: 'text', value: '\n' }]
  })
}
