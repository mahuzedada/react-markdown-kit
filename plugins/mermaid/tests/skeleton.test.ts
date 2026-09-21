// Ported from @zuilib/text-editor tests/skeleton.test.mjs (MIT).
import { describe, it, expect } from 'vitest'

import {
  expandDrawingSkeleton,
  parseDrawingSkeleton,
  DRAWING_SKELETON_JSON_SCHEMA,
  type DrawingData,
  type DrawingShape,
} from '../src/core/index.js'

const RECT_DEFAULT = { w: 160, h: 90 }
const LONG_TEXT =
  'A fairly long piece of text that wraps at the skeleton wrap width and grows the box well past its default size'

const byId = (data: DrawingData, id: string): DrawingShape =>
  data.shapes.find((s) => s.id === id) as DrawingShape
const right = (s: DrawingShape) => s.x + s.width
const bottom = (s: DrawingShape) => s.y + s.height

describe('skeleton', () => {
  it('auto-size grows with text and never shrinks below the default size', () => {
    const data = expandDrawingSkeleton({
      boxes: [
        { id: 'tiny', text: 'x' },
        { id: 'big', label: 'Service', text: LONG_TEXT, footer: 'v2' },
      ],
    })
    const tiny = byId(data, 'tiny')
    const big = byId(data, 'big')
    expect({ w: tiny.width, h: tiny.height }).toEqual(RECT_DEFAULT)
    expect(big.width, 'wider with more text').toBeGreaterThan(tiny.width)
    expect(big.height, 'taller with more text').toBeGreaterThan(tiny.height)
    expect(Number.isInteger(big.width) && Number.isInteger(big.height), 'whole pixels').toBe(true)
  })

  it('explicit w/h are respected individually', () => {
    const data = expandDrawingSkeleton({ boxes: [{ id: 'a', text: LONG_TEXT, w: 120 }] })
    const a = byId(data, 'a')
    expect(a.width).toBe(120)
    expect(a.height).toBeGreaterThanOrEqual(RECT_DEFAULT.h)
  })

  it('rank layout places b right of a for a→b (direction right)', () => {
    const data = expandDrawingSkeleton({
      boxes: [{ id: 'a' }, { id: 'b' }],
      connectors: [{ from: 'a', to: 'b' }],
    })
    const a = byId(data, 'a')
    const b = byId(data, 'b')
    expect(b.x, 'b starts after a ends').toBeGreaterThan(right(a))
    expect(a.y, 'same row').toBe(b.y)
  })

  it('rank layout places b below a for a→b (direction down)', () => {
    const data = expandDrawingSkeleton({
      direction: 'down',
      boxes: [{ id: 'a' }, { id: 'b' }],
      connectors: [{ from: 'a', to: 'b' }],
    })
    const a = byId(data, 'a')
    const b = byId(data, 'b')
    expect(b.y, 'b starts after a ends').toBeGreaterThan(bottom(a))
    expect(a.x, 'same column').toBe(b.x)
  })

  it('a cycle does not hang and still yields distinct ranks', () => {
    const data = expandDrawingSkeleton({
      boxes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      connectors: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ],
    })
    const xs = ['a', 'b', 'c'].map((id) => byId(data, id).x)
    expect(xs[0] < xs[1] && xs[1] < xs[2]).toBe(true)
    expect(data.shapes.filter((s) => s.type === 'arrow').length).toBe(3)
  })

  it('side sugar becomes the matching fixedPoint', () => {
    const data = expandDrawingSkeleton({
      boxes: [{ id: 'a' }, { id: 'b' }],
      connectors: [{ id: 'c', from: { id: 'a', side: 'right' }, to: { id: 'b', side: 'left' } }],
    })
    const c = byId(data, 'c')
    expect(c.startBinding).toEqual({ id: 'a', fixedPoint: [1, 0.5] })
    expect(c.endBinding).toEqual({ id: 'b', fixedPoint: [0, 0.5] })
  })

  it('connectors bound to unknown ids are dropped', () => {
    const data = expandDrawingSkeleton({
      boxes: [{ id: 'a' }],
      connectors: [{ id: 'bad', from: 'a', to: 'ghost' }],
    })
    expect(byId(data, 'bad')).toBeUndefined()
    expect(data.shapes.length).toBe(1)
  })

  it('boxes, then connectors, then texts', () => {
    const data = expandDrawingSkeleton({
      boxes: [{ id: 'a' }, { id: 'b' }],
      connectors: [{ id: 'c', from: 'a', to: 'b' }],
      texts: [{ id: 't', x: 0, y: 0, text: 'hi' }],
    })
    expect(data.shapes.map((s) => s.id)).toEqual(['a', 'b', 'c', 't'])
  })

  it('parseDrawingSkeleton never throws on garbage', () => {
    for (const json of ['', 'nope', '[]', '{}', '{"boxes":5}', 'null', '{"boxes":[1,"x",{}]}']) {
      const data = parseDrawingSkeleton(json)
      expect(data.version).toBe(3)
      expect(data.shapes).toEqual([])
    }
    const data = parseDrawingSkeleton(
      '{"boxes":[{"id":1},{"id":"x","type":"zzz"},{"id":"ok","color":"blue"}],"connectors":[5,{"from":"ok"}]}'
    )
    expect(data.shapes.map((s) => s.id)).toEqual(['ok'])
    expect(byId(data, 'ok').fill).toBe('#a5d8ff')
  })

  it('canvasHeight is computed from the lowest shape unless given', () => {
    const auto = expandDrawingSkeleton({ boxes: [{ id: 'a', y: 200, x: 10 }] })
    expect(auto.canvasHeight).toBe(200 + RECT_DEFAULT.h + 32)
    const given = expandDrawingSkeleton({ canvasHeight: 500, boxes: [{ id: 'a' }] })
    expect(given.canvasHeight).toBe(500)
  })

  it('schema is draft-07 and requires boxes', () => {
    expect(DRAWING_SKELETON_JSON_SCHEMA.$schema).toBe('http://json-schema.org/draft-07/schema#')
    expect(DRAWING_SKELETON_JSON_SCHEMA.required).toEqual(['boxes'])
  })
})
