// Ported from @zuilib/text-editor tests/ink.test.mjs (MIT).
import { describe, it, expect } from 'vitest'

// Ink rendering is a geometry internal, not part of the public barrel
import {
  inkStroke,
  inkAmplitude,
  inkFillOffset,
  seedFrom,
  roundedRectPolygon,
  roundedPolyline,
} from '../src/core/ink.js'

const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
const coords = (d: string): Array<[number, number]> =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])

describe('ink', () => {
  it('a stroke is deterministic for a seed and differs across seeds', () => {
    const a = inkStroke(square, { closed: true, seed: seedFrom('s1'), width: 2, amplitude: 1 })
    const b = inkStroke(square, { closed: true, seed: seedFrom('s1'), width: 2, amplitude: 1 })
    const c = inkStroke(square, { closed: true, seed: seedFrom('s2'), width: 2, amplitude: 1 })
    expect(a.ring).toBe(b.ring)
    expect(a.ring).not.toBe(c.ring)
    expect(seedFrom('s1')).toBe(seedFrom('s1'))
  })

  it('displacement stays within the amplitude plus half the widest pen', () => {
    const amplitude = 1.5
    const width = 2
    const { ring, center } = inkStroke(square, { closed: true, seed: 7, width, amplitude })
    const maxWidth = width * 1.3
    for (const [x, y] of coords(center)) {
      const d = Math.min(Math.abs(x), Math.abs(x - 100), Math.abs(y), Math.abs(y - 100))
      expect(d, `center ${x},${y} strays ${d}`).toBeLessThanOrEqual(amplitude + 1e-6)
    }
    for (const [x, y] of coords(ring)) {
      const d = Math.min(Math.abs(x), Math.abs(x - 100), Math.abs(y), Math.abs(y - 100))
      expect(d, `ring ${x},${y} strays ${d}`).toBeLessThanOrEqual(amplitude + maxWidth / 2 + 1e-6)
    }
  })

  it('closed rings are two closed subpaths; open strokes one closed polygon', () => {
    const closed = inkStroke(square, { closed: true, seed: 1, width: 2, amplitude: 1 })
    expect((closed.ring.match(/Z/g) ?? []).length).toBe(2)
    expect((closed.ring.match(/M /g) ?? []).length).toBe(2)
    const open = inkStroke([{ x: 0, y: 0 }, { x: 80, y: 40 }], { closed: false, seed: 1, width: 2, amplitude: 1 })
    expect((open.ring.match(/Z/g) ?? []).length).toBe(1)
    expect((open.ring.match(/M /g) ?? []).length).toBe(1)
    expect(open.center.includes('Z')).toBe(false)
  })

  it('degenerate input yields empty paths, never throws', () => {
    expect(inkStroke([], { closed: true, seed: 1, width: 2, amplitude: 1 })).toEqual({ ring: '', center: '' })
    expect(inkStroke([{ x: 1, y: 1 }], { closed: false, seed: 1, width: 2, amplitude: 1 })).toEqual({ ring: '', center: '' })
    const dot = inkStroke([{ x: 1, y: 1 }, { x: 1, y: 1 }], { closed: true, seed: 1, width: 2, amplitude: 1 })
    expect(dot.ring).toBe('')
  })

  it('amplitude and fill offset are bounded', () => {
    expect(inkAmplitude(10)).toBe(1)
    expect(inkAmplitude(1000)).toBe(4)
    expect(Math.abs(inkAmplitude(100) - 3)).toBeLessThan(1e-9)
    for (const seed of [1, 2, 3, 99]) {
      const { x, y } = inkFillOffset(seed)
      const d = Math.hypot(x, y)
      expect(d >= 2 - 1e-9 && d <= 3 + 1e-9, `offset ${d}`).toBe(true)
    }
  })

  it('rounded helpers keep endpoints and add corner samples', () => {
    const rect = roundedRectPolygon({ x: 0, y: 0, w: 40, h: 20 }, 8)
    expect(rect.length).toBe(4 * 5)
    expect(rect.every((p) => p.x >= -1e-9 && p.x <= 40 + 1e-9 && p.y >= -1e-9 && p.y <= 20 + 1e-9)).toBe(true)
    const line = roundedPolyline([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }])
    expect(line[0]).toEqual({ x: 0, y: 0 })
    expect(line[line.length - 1]).toEqual({ x: 50, y: 50 })
    expect(line.length).toBeGreaterThan(3)
  })
})
