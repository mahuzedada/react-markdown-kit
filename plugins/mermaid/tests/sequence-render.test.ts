/**
 * The sequence renderer (docs/MERMAID_PLATFORM.md sections 4.1, 7 and 8.4):
 * one `svg[role=img]` with a `title`, no script or foreignObject, every
 * colour a theme token with its hex fallback, and the arrow, line and note
 * shapes the subset asks for. The corpus is rendered whole so a docs
 * example that renders badly fails here, not in a browser.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Element, ElementContent } from 'hast'
import { describe, expect, it } from 'vitest'
import { sequenceDiagram } from '../src/core/sequence/index.js'
import type { SequenceModel } from '../src/core/sequence/model.js'
import { parseSequenceDiagram } from '../src/core/sequence/parse.js'
import { renderSequenceSvg } from '../src/svg/sequence-render.js'

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), 'corpus', 'sequenceDiagram')
const COLOUR = /^var\(--rmk-diagram-[a-z-]+, #[0-9a-f]{6}\)$/

function render(source: string, fallbackTitle = 'Diagram'): Element {
  const parsed = parseSequenceDiagram(source)
  if ('error' in parsed) throw new Error(parsed.error)
  return renderSequenceSvg(parsed.model, { fallbackTitle })
}

function walk(node: ElementContent, visit: (element: Element) => void): void {
  if (node.type !== 'element') return
  visit(node)
  for (const child of node.children) walk(child, visit)
}

function elements(root: Element): Element[] {
  const out: Element[] = []
  walk(root, (element) => out.push(element))
  return out
}

function group(root: Element, shape: string): Element[] {
  return elements(root).filter((e) => e.properties.dataShape === shape)
}

function textOf(element: Element): string {
  return element.children.map((c) => (c.type === 'text' ? c.value : c.type === 'element' ? textOf(c) : '')).join('')
}

describe('renderSequenceSvg: contract', () => {
  const files = readdirSync(CORPUS).filter((f) => f.endsWith('.mmd')).sort()

  it('has a corpus to render', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`renders ${file} as one svg[role=img] with a title and only token colours`, () => {
      const svg = render(readFileSync(join(CORPUS, file), 'utf8'))
      expect(svg.tagName).toBe('svg')
      expect(svg.properties.role).toBe('img')
      expect(svg.properties.viewBox).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/)
      const title = svg.children.find((c): c is Element => c.type === 'element' && c.tagName === 'title')
      expect(title).toBeDefined()
      expect(svg.properties.ariaLabel).toBe(textOf(title!))
      for (const element of elements(svg)) {
        expect(['script', 'foreignObject', 'a', 'image', 'use', 'style']).not.toContain(element.tagName)
        for (const [name, value] of Object.entries(element.properties)) {
          if (name === 'fill' || name === 'stroke') {
            if (value !== 'none') expect(value, `${element.tagName} ${name}`).toMatch(COLOUR)
          } else if (name !== 'xmlns') {
            expect(String(value), `${element.tagName} ${name}`).not.toMatch(/url\(|https?:|javascript:/i)
          }
        }
      }
    })
  }

  it('uses the model title as the accessible name and falls back otherwise', () => {
    const titled = render('---\ntitle: Sign in\n---\nsequenceDiagram\n    A->>B: hi\n')
    expect(textOf(titled.children[0] as Element)).toBe('Sign in')
    expect(titled.properties.ariaLabel).toBe('Sign in')
    const fallback = render('sequenceDiagram\n    A->>B: hi\n', 'Fallback')
    expect(textOf(fallback.children[0] as Element)).toBe('Fallback')
  })

  it('renders an empty model', () => {
    const model: SequenceModel = { participants: [], boxes: [], items: [], activations: [] }
    const svg = renderSequenceSvg(model, { fallbackTitle: 'Empty' })
    expect(svg.tagName).toBe('svg')
    expect(group(svg, 'participant')).toEqual([])
  })

  it('is what the kind renders', () => {
    const kind = sequenceDiagram()
    const parsed = kind.parse('sequenceDiagram\n    A->>B: hi\n')
    if ('error' in parsed) throw new Error(parsed.error)
    expect(kind.render?.(parsed.model, { fallbackTitle: 'D' })).toEqual(render('sequenceDiagram\n    A->>B: hi\n', 'D'))
  })
})

describe('renderSequenceSvg: shapes', () => {
  it('draws a rectangle for a participant and a stick figure for an actor, top and bottom', () => {
    const svg = render('sequenceDiagram\n    participant A\n    actor B\n    A->>B: hi\n')
    const participants = group(svg, 'participant')
    const actors = group(svg, 'actor')
    expect(participants).toHaveLength(2)
    expect(actors).toHaveLength(2)
    expect(participants[0]!.children.map((c) => (c as Element).tagName)).toEqual(['rect', 'text'])
    expect(actors[0]!.children.map((c) => (c as Element).tagName)).toEqual(['circle', 'path', 'text'])
    expect(textOf(participants[0]!)).toBe('A')
    expect(textOf(actors[0]!)).toBe('B')
    expect(group(svg, 'lifeline')).toHaveLength(2)
  })

  it('draws solid and dotted lines with filled, open, cross and no heads', () => {
    const svg = render('sequenceDiagram\n    A->B: none\n    A-->B: dotted\n    A->>B: arrow\n    A-)B: open\n    A-xB: cross\n')
    const messages = group(svg, 'message')
    const paths = (m: Element): Element[] => m.children.filter((c): c is Element => c.type === 'element' && c.tagName === 'path')
    expect(paths(messages[0]!)).toHaveLength(1)
    expect(paths(messages[1]!)[0]!.properties.strokeDasharray).toBe('6 4')
    expect(paths(messages[0]!)[0]!.properties.strokeDasharray).toBeUndefined()
    const arrow = paths(messages[2]!)[1]!
    expect(arrow.properties.d).toMatch(/z$/)
    expect(arrow.properties.fill).toMatch(COLOUR)
    const open = paths(messages[3]!)[1]!
    expect(open.properties.fill).toBe('none')
    expect(open.properties.d).not.toMatch(/z$/)
    const cross = paths(messages[4]!)[1]!
    expect((cross.properties.d as string).match(/M/g)).toHaveLength(2)
  })

  it('draws a head at both ends of a bidirectional message', () => {
    const svg = render('sequenceDiagram\n    A<<->>B: both\n')
    const paths = group(svg, 'message')[0]!.children.filter((c): c is Element => c.type === 'element' && c.tagName === 'path')
    expect(paths).toHaveLength(3)
  })

  it('draws a self message as a loop with its text on the right', () => {
    const svg = render('sequenceDiagram\n    A->>A: me\n')
    const message = group(svg, 'message')[0]!
    const path = message.children[0] as Element
    expect(path.properties.d).toMatch(/^M[\d.]+,[\d.]+H[\d.]+V[\d.]+H[\d.]+$/)
    const label = message.children.find((c): c is Element => c.type === 'element' && c.tagName === 'text')!
    expect(label.properties.textAnchor).toBeUndefined()
    expect(textOf(label)).toBe('me')
  })

  it('puts message text above the line, one text element per line', () => {
    const svg = render('sequenceDiagram\n    A->>B: one<br/>two\n')
    const message = group(svg, 'message')[0]!
    const texts = message.children.filter((c): c is Element => c.type === 'element' && c.tagName === 'text')
    const line = message.children[0] as Element
    const y = Number(/,([\d.]+)H/.exec(line.properties.d as string)![1])
    expect(texts.map(textOf)).toEqual(['one', 'two'])
    for (const t of texts) expect(Number(t.properties.y)).toBeLessThan(y)
  })

  it('draws autonumber badges with the signal fill and the number text token', () => {
    const svg = render('sequenceDiagram\n    autonumber 3\n    A->>B: hi\n')
    const message = group(svg, 'message')[0]!
    const circle = message.children.find((c): c is Element => c.type === 'element' && c.tagName === 'circle')!
    expect(circle.properties.fill).toBe('var(--rmk-diagram-signal, #333333)')
    const number = message.children[message.children.length - 1] as Element
    expect(textOf(number)).toBe('3')
    expect(number.properties.fill).toBe('var(--rmk-diagram-number-text, #ffffff)')
  })

  it('draws notes with the note tokens and one text element per line', () => {
    const svg = render('sequenceDiagram\n    Note over A: first<br/>second\n')
    const note = group(svg, 'note')[0]!
    const rect = note.children[0] as Element
    expect(rect.properties.fill).toBe('var(--rmk-diagram-note-fill, #fff5ad)')
    expect(rect.properties.stroke).toBe('var(--rmk-diagram-note-stroke, #aaaa33)')
    const texts = note.children.slice(1) as Element[]
    expect(texts.map(textOf)).toEqual(['first', 'second'])
    expect(texts[0]!.properties.fill).toBe('var(--rmk-diagram-note-text, #333333)')
  })

  it('draws activation bars with the activation tokens', () => {
    const svg = render('sequenceDiagram\n    A->>+B: hi\n    B-->>-A: yo\n')
    const bars = group(svg, 'activation')
    expect(bars).toHaveLength(1)
    expect(bars[0]!.properties.fill).toBe('var(--rmk-diagram-activation-fill, #f4f4f4)')
    expect(bars[0]!.properties.stroke).toBe('var(--rmk-diagram-activation-stroke, #666666)')
  })

  it('draws a frame with a label tab, bracketed section labels and dashed dividers', () => {
    const svg = render('sequenceDiagram\n    alt yes\n        A->>B: one\n    else no\n        A->>B: two\n    end\n')
    const frame = group(svg, 'frame')[0]!
    expect(frame.properties.dataKind).toBe('alt')
    const tags = frame.children.map((c) => (c as Element).tagName)
    expect(tags).toEqual(['rect', 'path', 'text', 'text', 'line', 'text'])
    const texts = frame.children.filter((c): c is Element => c.type === 'element' && c.tagName === 'text').map(textOf)
    expect(texts).toEqual(['alt', '[yes]', '[no]'])
    const divider = frame.children[4] as Element
    expect(divider.properties.strokeDasharray).toBe('6 4')
    expect(divider.properties.stroke).toBe('var(--rmk-diagram-label-stroke, #9370db)')
  })

  it('draws a rect frame as a filled rectangle without a tab', () => {
    const svg = render('sequenceDiagram\n    rect rgb(0, 0, 255)\n        A->>B: one\n    end\n')
    const frame = group(svg, 'frame')[0]!
    expect(frame.properties.dataKind).toBe('rect')
    expect(frame.children).toHaveLength(1)
    expect((frame.children[0] as Element).properties.fill).toBe('var(--rmk-diagram-label-fill, #ececff)')
  })

  it('draws a box around its participants with its label', () => {
    const svg = render('sequenceDiagram\n    box Aqua Group\n    participant A\n    end\n    A->>B: hi\n')
    const box = group(svg, 'box')[0]!
    expect(box.children.map((c) => (c as Element).tagName)).toEqual(['rect', 'text'])
    expect(textOf(box)).toBe('Aqua Group')
  })

  it('draws every colour through the theme tokens only', () => {
    const svg = render(
      'sequenceDiagram\n    autonumber\n    box G\n    participant A\n    end\n    actor B\n    A->>+B: hi\n    Note over A,B: n\n    loop l\n        B-->>-A: yo\n    end\n    rect rgb(1,2,3)\n        A-xB: x\n    end\n',
    )
    const used = new Set<string>()
    for (const element of elements(svg)) {
      for (const name of ['fill', 'stroke'] as const) {
        const value = element.properties[name]
        if (typeof value === 'string' && value !== 'none') {
          expect(value).toMatch(COLOUR)
          used.add(value)
        }
      }
    }
    expect([...used].sort()).toEqual(
      [
        'var(--rmk-diagram-activation-fill, #f4f4f4)',
        'var(--rmk-diagram-activation-stroke, #666666)',
        'var(--rmk-diagram-actor-fill, #ececff)',
        'var(--rmk-diagram-actor-stroke, #9370db)',
        'var(--rmk-diagram-actor-text, #333333)',
        'var(--rmk-diagram-label-fill, #ececff)',
        'var(--rmk-diagram-label-stroke, #9370db)',
        'var(--rmk-diagram-label-text, #333333)',
        'var(--rmk-diagram-line, #9370db)',
        'var(--rmk-diagram-note-fill, #fff5ad)',
        'var(--rmk-diagram-note-stroke, #aaaa33)',
        'var(--rmk-diagram-note-text, #333333)',
        'var(--rmk-diagram-number-text, #ffffff)',
        'var(--rmk-diagram-signal, #333333)',
        'var(--rmk-diagram-signal-text, #333333)',
      ].sort(),
    )
  })
})
