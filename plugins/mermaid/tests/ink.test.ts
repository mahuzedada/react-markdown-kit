import { describe, it, expect } from 'vitest'

// Ink rendering is a geometry internal, not part of the public barrel
import {
  ellipseSides,
  inkAmplitude,
  inkLineAmplitude,
  inkOutline,
  polygonSides,
  polylineSides,
  roundedRectSides,
  seedFrom,
} from '../src/core/ink.js'

const square = polygonSides([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
const coords = (d: string): Array<[number, number]> =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
const strayFromSquare = ([x, y]: [number, number]): number =>
  Math.min(Math.abs(x), Math.abs(x - 100), Math.abs(y), Math.abs(y - 100))

describe('ink', () => {
  it('an outline is deterministic for a seed and differs across seeds', () => {
    const a = inkOutline(square, { closed: true, seed: seedFrom('s1'), amplitude: 1 })
    const b = inkOutline(square, { closed: true, seed: seedFrom('s1'), amplitude: 1 })
    const c = inkOutline(square, { closed: true, seed: seedFrom('s2'), amplitude: 1 })
    expect(a.stroke).toBe(b.stroke)
    expect(a.fill).toBe(b.fill)
    expect(a.stroke).not.toBe(c.stroke)
    expect(seedFrom('s1')).toBe(seedFrom('s1'))
  })

  it('the bow stays within the amplitude and the corners within half of it', () => {
    const amplitude = 1.5
    const { stroke, fill } = inkOutline(square, { closed: true, seed: 7, amplitude, noTail: true })
    const pts = coords(stroke)
    for (const p of pts) {
      expect(strayFromSquare(p), `stroke ${p.join(',')} strays`).toBeLessThanOrEqual(amplitude * 1.5 + 1e-6)
    }
    for (const corner of [[0, 0], [100, 0], [100, 100], [0, 100]]) {
      const nearest = Math.min(...pts.map(([x, y]) => Math.hypot(x - corner[0]!, y - corner[1]!)))
      expect(nearest, `corner ${corner.join(',')}`).toBeLessThanOrEqual(amplitude / 2 + 1e-6)
    }
    expect(fill).toBe(`${stroke.slice(0, -2)} Z`)
  })

  it('sides meet at their corners: the ends of a side are the shared jittered corners', () => {
    const outline = inkOutline(square, { closed: true, seed: 3, amplitude: 1, noTail: true })
    const pts = coords(outline.stroke)
    const first = pts[0]!
    const last = pts[pts.length - 1]!
    expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeLessThan(1e-6)
    // A different outline through the same corner moves it the same way
    const line = inkOutline(polylineSides([{ x: 0, y: 0 }, { x: 0, y: 100 }]), { closed: false, seed: 3, amplitude: 1 })
    expect(coords(line.stroke)[0]).toEqual(first)
  })

  it('a closed outline runs on past its first corner, its fill does not', () => {
    const tailed = inkOutline(square, { closed: true, seed: 11, amplitude: 1 })
    const plain = inkOutline(square, { closed: true, seed: 11, amplitude: 1, noTail: true })
    expect(tailed.fill).toBe(plain.fill)
    expect(tailed.stroke.endsWith('Z')).toBe(false)
    expect(coords(tailed.stroke).length).toBeGreaterThan(coords(plain.stroke).length)
    const tail = coords(tailed.stroke).slice(coords(plain.stroke).length - 1)
    // The tail follows the top edge to the right, never further than the tail length
    for (const [x, y] of tail) {
      expect(x).toBeLessThanOrEqual(10 + 1e-6)
      expect(Math.abs(y)).toBeLessThanOrEqual(1.5 + 1e-6)
    }
  })

  it('open strokes are one open path with no fill', () => {
    const open = inkOutline(polylineSides([{ x: 0, y: 0 }, { x: 80, y: 40 }, { x: 80, y: 90 }]), {
      closed: false,
      seed: 1,
      amplitude: 1,
    })
    expect(open.stroke.startsWith('M ')).toBe(true)
    expect(open.stroke.includes('Z')).toBe(false)
    expect((open.stroke.match(/M /g) ?? []).length).toBe(1)
    expect(open.fill).toBe('')
    const pts = coords(open.stroke)
    expect(pts[pts.length - 1]![0]).toBeCloseTo(80, 0)
    expect(pts[pts.length - 1]![1]).toBeCloseTo(90, 0)
  })

  it('degenerate input yields empty paths, never throws', () => {
    expect(inkOutline([], { closed: true, seed: 1, amplitude: 1 })).toEqual({ stroke: '', fill: '' })
    expect(inkOutline([[{ x: 1, y: 1 }]], { closed: false, seed: 1, amplitude: 1 })).toEqual({ stroke: '', fill: '' })
    const dot = inkOutline([[{ x: 1, y: 1 }, { x: 1, y: 1 }]], { closed: true, seed: 1, amplitude: 1 })
    expect(dot).toEqual({ stroke: '', fill: '' })
  })

  it('amplitudes are bounded', () => {
    expect(inkAmplitude(10)).toBe(0.5)
    expect(inkAmplitude(1000)).toBe(1.6)
    expect(inkAmplitude(100)).toBeCloseTo(1.4)
    expect(inkLineAmplitude(10)).toBe(0.5)
    expect(inkLineAmplitude(1000)).toBe(2.4)
    expect(inkLineAmplitude(100)).toBeCloseTo(1.2)
  })

  it('side helpers connect and stay within their bounds', () => {
    const rect = roundedRectSides({ x: 0, y: 0, w: 40, h: 20 }, 6)
    expect(rect.length).toBe(8)
    rect.forEach((side, i) => {
      const next = rect[(i + 1) % rect.length]!
      expect(side[side.length - 1]).toEqual(next[0])
      expect(side.every((p) => p.x >= -1e-9 && p.x <= 40 + 1e-9 && p.y >= -1e-9 && p.y <= 20 + 1e-9)).toBe(true)
    })
    expect(roundedRectSides({ x: 0, y: 0, w: 40, h: 20 }, 0).length).toBe(4)
    const ellipse = ellipseSides(50, 50, 30, 20)
    expect(ellipse.length).toBe(4)
    expect(ellipse[0]![0]).toEqual({ x: 50, y: 30 })
    expect(ellipse[3]![ellipse[3]!.length - 1]!.y).toBeCloseTo(30)
    expect(polygonSides([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }])[2]).toEqual([{ x: 1, y: 1 }, { x: 0, y: 0 }])
    expect(polylineSides([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]).length).toBe(2)
  })
})
