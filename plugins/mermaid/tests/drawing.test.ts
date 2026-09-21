// Ported from @zuilib/text-editor tests/drawing.test.mjs (MIT).
import { describe, it, expect } from 'vitest'

import {
  deserializeDrawingData,
  serializeDrawingData,
  normalizeDrawingData,
  findNodeShapeAt,
  createBinding,
  NODE_SHAPE_DEFINITIONS,
  SIDE_FIXED_POINTS,
  STROKE_COLORS,
  type Binding,
  type DrawingData,
  type DrawingShape,
  type DrawingShapeType,
  type Point,
} from '../src/core/index.js'
// Geometry internals are not exported by the public barrel
import { resolveBindings, fixedPointFor, bindEndpoints, anchorPoint, nodeShapeOutline } from '../src/core/bindings.js'
import { routeElbow } from '../src/core/routing.js'
import { connectorPoints } from '../src/core/connectors.js'

const GAP = 6
const OBSTACLE_PADDING = 14

type End = string | Binding | null
type Rect = { x: number; y: number; w: number; h: number }

const box = (id: string, x: number, y: number, width: number, height: number, type: DrawingShapeType = 'rect'): DrawingShape => ({
  id, type, x, y, width, height, stroke: STROKE_COLORS[0], fill: 'transparent', strokeWidth: 2,
})
const arrow = (id: string, from: End = null, to: End = null, extra: Partial<DrawingShape> = {}): DrawingShape => ({
  id, type: 'arrow', x: 0, y: 0, width: 100, height: 0,
  stroke: STROKE_COLORS[0], fill: 'transparent', strokeWidth: 2,
  ...(from ? { startBinding: typeof from === 'string' ? { id: from } : from } : {}),
  ...(to ? { endBinding: typeof to === 'string' ? { id: to } : to } : {}),
  ...extra,
})
const drawing = (...shapes: DrawingShape[]): DrawingData => ({ version: 3, canvasHeight: 320, shapes })
const byId = (shapes: readonly DrawingShape[], id: string): DrawingShape =>
  shapes.find((s) => s.id === id) as DrawingShape
const endpoints = (c: DrawingShape) => ({ p1: { x: c.x, y: c.y }, p2: { x: c.x + c.width, y: c.y + c.height } })
const near = (actual: number, expected: number, msg?: string) =>
  expect(Math.abs(actual - expected) < 1e-6, `${msg ?? ''} expected ${expected}, got ${actual}`).toBe(true)

/** Resolve bindings for the whole canvas, then route the connector `id` */
const route = (shapes: DrawingShape[], id: string) => {
  const resolved = resolveBindings(shapes)
  return routeElbow(byId(resolved, id), resolved)
}

const assertOrthogonal = (points: Point[]) => {
  expect(points.length, 'at least two points').toBeGreaterThanOrEqual(2)
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i].x - points[i - 1].x)
    const dy = Math.abs(points[i].y - points[i - 1].y)
    expect(dx < 1e-6 || dy < 1e-6, `segment ${i - 1}->${i} is not axis-aligned: ${JSON.stringify([points[i - 1], points[i]])}`).toBe(true)
  }
}

const assertSimplified = (points: Point[]) => {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= 1, `duplicate point at ${i}`).toBe(true)
    const c = points[i + 1]
    if (!c) continue
    const sameX = Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01
    const sameY = Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01
    expect(!sameX && !sameY, `collinear run at ${i}`).toBe(true)
  }
}

const strictlyInside = (r: Rect, p: Point) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h
const inflated = (b: DrawingShape): Rect => ({
  x: b.x - OBSTACLE_PADDING, y: b.y - OBSTACLE_PADDING,
  w: b.width + OBSTACLE_PADDING * 2, h: b.height + OBSTACLE_PADDING * 2,
})

describe('parser', () => {
  it('round-trips a v3 payload through serialize/parse', () => {
    const data = drawing(
      { ...box('a', 10, 20, 100, 60), label: 'Svc', text: 'Auth', footer: 'v1' },
      box('b', 200, 20, 100, 60, 'cylinder'),
      arrow('e', 'a', { id: 'b', fixedPoint: [0, 0.5] }, { text: 'reads', routing: 'elbow', elbow: 0.3 }),
    )
    expect(deserializeDrawingData(serializeDrawingData(data))).toEqual(data)
  })

  it('accepts versions 2 and 3 only: no version, version 1 or `height` alias yield an empty drawing', () => {
    expect(normalizeDrawingData({ shapes: [box('a', 0, 0, 10, 10)], height: 200 }).shapes.length).toBe(0)
    expect(normalizeDrawingData({ version: 1, canvasHeight: 200, shapes: [box('a', 0, 0, 10, 10)] }).shapes.length).toBe(0)
    expect(normalizeDrawingData({ version: 3, shapes: [], height: 200 }).canvasHeight).toBe(320)
  })

  it('migrates a version 2 payload: shape `w`/`h` become `width`/`height`, version becomes 3', () => {
    const v2 = {
      version: 2,
      canvasHeight: 320,
      shapes: [
        { id: 'a', type: 'rect', x: 10, y: 20, w: 100, h: 60, stroke: STROKE_COLORS[0], fill: 'transparent', strokeWidth: 2, label: 'Svc' },
        { id: 'e', type: 'arrow', x: 0, y: 0, w: 100, h: 0, stroke: STROKE_COLORS[0], fill: 'transparent', strokeWidth: 2, startBinding: { id: 'a' } },
      ],
    }
    const data = deserializeDrawingData(JSON.stringify(v2))
    expect(data.version).toBe(3)
    const a = byId(data.shapes, 'a')
    expect({ width: a.width, height: a.height }).toEqual({ width: 100, height: 60 })
    expect(!('w' in a) && !('h' in a)).toBe(true)
    const e = byId(data.shapes, 'e')
    expect({ width: e.width, height: e.height }).toEqual({ width: 100, height: 0 })
    expect(e.startBinding).toEqual({ id: 'a' })
    // Serializing the migrated document emits the version 3 fields
    const emitted = JSON.parse(serializeDrawingData(data))
    expect(emitted.version).toBe(3)
    expect(emitted.shapes[0].width).toBe(100)
    expect('w' in emitted.shapes[0]).toBe(false)
  })

  it('rejects shorthand bindings: bare ids and `side` are skeleton-only', () => {
    const data = normalizeDrawingData(drawing(
      box('a', 0, 0, 100, 60),
      { id: 'e', type: 'arrow', x: 0, y: 0, width: 10, height: 0, startBinding: 'a', endBinding: { id: 'a', side: 'top' } } as unknown as DrawingShape,
    ))
    const e = byId(data.shapes, 'e')
    expect(e.startBinding).toBeUndefined()
    expect(e.endBinding).toEqual({ id: 'a' })
    expect(SIDE_FIXED_POINTS.top).toEqual([0.5, 0])
  })

  it('drops bindings to missing ids and unknown shape types', () => {
    const data = normalizeDrawingData(drawing(
      box('a', 0, 0, 100, 60),
      box('t', 0, 0, 50, 50, 'triangle' as DrawingShapeType),
      arrow('e', 'a', 'missing'),
    ))
    expect(data.shapes.map((s) => s.id)).toEqual(['a', 'e'])
    const e = byId(data.shapes, 'e')
    expect(e.startBinding).toEqual({ id: 'a' })
    expect(e.endBinding).toBeUndefined()
  })

  it('normalizes negative box sizes', () => {
    const [b] = normalizeDrawingData(drawing(box('a', 100, 100, -50, -20))).shapes
    expect({ x: b.x, y: b.y, width: b.width, height: b.height }).toEqual({ x: 50, y: 80, width: 50, height: 20 })
  })

  it('yields an empty drawing for garbage JSON and drops a too-narrow canvasWidth', () => {
    expect(deserializeDrawingData('{not json').shapes.length).toBe(0)
    const data = normalizeDrawingData({ version: 3, shapes: [], canvasWidth: 100 })
    expect(data.canvasWidth).toBeUndefined()
    expect(normalizeDrawingData({ version: 3, shapes: [], canvasWidth: 640 }).canvasWidth).toBe(640)
  })
})

describe('bindings', () => {
  const A = box('a', 0, 0, 100, 60)
  const B = box('b', 200, 0, 100, 60)

  it('center-bound arrow lands on the facing edges with the gap', () => {
    const e = byId(resolveBindings([A, B, arrow('e', 'a', 'b')]), 'e')
    const { p1, p2 } = endpoints(e)
    near(p1.x, A.x + A.width + GAP, 'p1.x')
    near(p1.y, A.y + A.height / 2, 'p1.y')
    near(p2.x, B.x - GAP, 'p2.x')
    near(p2.y, B.y + B.height / 2, 'p2.y')
  })

  it('a top fixed point exits upward from the top edge', () => {
    const low = box('a', 0, 200, 100, 60)
    const above = box('b', 0, 0, 100, 60)
    const e = byId(resolveBindings([low, above, arrow('e', { id: 'a', fixedPoint: [0.5, 0] }, 'b')]), 'e')
    near(e.x, low.x + low.width / 2, 'start x')
    near(e.y, low.y - GAP, 'start y')
  })

  it('mode inside pins the endpoint on the anchor', () => {
    const e = byId(resolveBindings([A, B, arrow('e', { id: 'a', mode: 'inside' }, 'b')]), 'e')
    expect({ x: e.x, y: e.y }).toEqual(anchorPoint(A))
    expect(anchorPoint(A)).toEqual({ x: 50, y: 30 })
  })

  it('ellipse binding lands on the ellipse outline', () => {
    const E = box('e', 0, 0, 100, 60, 'ellipse')
    const far = box('b', 300, 0, 100, 60)
    const c = byId(resolveBindings([E, far, arrow('c', 'e', 'b')]), 'c')
    near(c.x - 50, E.width / 2 + GAP, 'distance from center')
    near(c.y, 30, 'y')
    expect(nodeShapeOutline(E).length).toBe(40)
    expect(NODE_SHAPE_DEFINITIONS.ellipse.outline(E).length).toBe(40)
  })

  it('fixedPointFor auto-aims near the center and snaps to the edge near a border', () => {
    expect(fixedPointFor(A, { x: 50, y: 30 })).toBeUndefined()
    expect(fixedPointFor(A, { x: 95, y: 30 })).toEqual([1, 0.5])
    expect(createBinding(A, { x: 95, y: 30 })).toEqual({ id: 'a', fixedPoint: [1, 0.5] })
    expect(createBinding(A, { x: 50, y: 30 })).toEqual({ id: 'a' })
  })

  it('bindEndpoints attaches both ends, unless they share a box', () => {
    const fresh = arrow('e', null, null, { x: 50, y: 30, width: 200, height: 0 })
    const bound = bindEndpoints(fresh, [A, B, fresh])
    expect(bound.startBinding).toEqual({ id: 'a' })
    expect(bound.endBinding).toEqual({ id: 'b' })
    const same = arrow('f', null, null, { x: 10, y: 10, width: 50, height: 20 })
    const unbound = bindEndpoints(same, [A, B, same])
    expect(unbound.startBinding).toBeUndefined()
    expect(unbound.endBinding).toBeUndefined()
  })

  it('findNodeShapeAt prefers the smaller box and honours the tolerance', () => {
    const small = box('small', 50, 50, 100, 100)
    const big = box('big', 0, 0, 300, 300)
    expect(findNodeShapeAt([small, big], { x: 100, y: 100 })?.id).toBe('small')
    expect(findNodeShapeAt([A], { x: 108, y: 30 })?.id).toBe('a')
    expect(findNodeShapeAt([A], { x: 112, y: 30 })).toBeNull()
  })
})

describe('elbow router', () => {
  const A = box('a', 0, 0, 100, 60)
  const elbowArrow = (from: End, to: End, extra?: Partial<DrawingShape>) =>
    arrow('e', from, to, { routing: 'elbow', ...extra })

  it('side by side: straight, leaving A to the right', () => {
    const B = box('b', 200, 0, 100, 60)
    const points = route([A, B, elbowArrow('a', 'b')], 'e')
    assertOrthogonal(points)
    assertSimplified(points)
    near(points[0].y, points[1].y, 'first segment horizontal')
    expect(points[1].x, 'first segment heads right').toBeGreaterThan(points[0].x)
    expect(points[0]).toEqual({ x: A.x + A.width + GAP, y: 30 })
    expect(points.at(-1)).toEqual({ x: B.x - GAP, y: 30 })
  })

  it('diagonal placement: orthogonal path from the bottom of A to the top of B', () => {
    const B = box('b', 300, 200, 100, 60)
    const points = route([A, B, elbowArrow('a', 'b')], 'e')
    assertOrthogonal(points)
    assertSimplified(points)
    expect(points[0]).toEqual({ x: 50, y: A.y + A.height + GAP })
    expect(points.at(-1)).toEqual({ x: 350, y: B.y - GAP })
  })

  it('box directly above another, via connectorPoints', () => {
    const B = box('b', 0, 200, 100, 60)
    const resolved = resolveBindings([A, B, elbowArrow('a', 'b')])
    const points = connectorPoints(byId(resolved, 'e'), resolved)
    assertOrthogonal(points)
    expect(points).toEqual([{ x: 50, y: A.y + A.height + GAP }, { x: 50, y: B.y - GAP }])
  })

  it('routes around a box sitting between the endpoints', () => {
    const C = box('c', 200, 0, 100, 60)
    const B = box('b', 400, 0, 100, 60)
    const points = route([A, C, B, elbowArrow('a', 'b')], 'e')
    assertOrthogonal(points)
    assertSimplified(points)
    expect(points.length, 'needs bends to get around C').toBeGreaterThanOrEqual(4)
    const blocked = inflated(C)
    for (let i = 1; i < points.length; i++) {
      const mid = { x: (points[i - 1].x + points[i].x) / 2, y: (points[i - 1].y + points[i].y) / 2 }
      expect(strictlyInside(blocked, mid), `segment ${i - 1}->${i} crosses C`).toBe(false)
    }
  })

  it('elbow override slides the middle segment of a Z', () => {
    const B = box('b', 300, 100, 100, 60)
    const resolved = resolveBindings([A, B, elbowArrow('a', 'b', { elbow: 0.25 })])
    const e = byId(resolved, 'e')
    const points = routeElbow(e, resolved)
    const { p1, p2 } = endpoints(e)
    expect(points.length).toBe(4)
    const x = p1.x + (p2.x - p1.x) * 0.25
    near(points[1].x, x, 'bend 1')
    near(points[2].x, x, 'bend 2')
    near(points[1].y, p1.y, 'bend 1 stays on the start row')
    near(points[2].y, p2.y, 'bend 2 stays on the end row')
  })

  it('a free elbow connector is still orthogonal from start to end', () => {
    const free = elbowArrow(null, null, { x: 10, y: 20, width: 200, height: 100 })
    const points = routeElbow(free, [free])
    assertOrthogonal(points)
    expect(points[0]).toEqual({ x: 10, y: 20 })
    expect(points.at(-1)).toEqual({ x: 210, y: 120 })
  })

  it('waypoints take precedence over routing', () => {
    const wp = elbowArrow(null, null, { x: 0, y: 0, width: 100, height: 100, waypoints: [{ x: 50, y: 0 }, { x: 50, y: 100 }] })
    expect(connectorPoints(wp, [wp])).toEqual([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 }])
  })

  it('is deterministic', () => {
    const shapes = [A, box('c', 200, 0, 100, 60), box('b', 400, 200, 100, 60), elbowArrow('a', 'b')]
    expect(route(shapes, 'e')).toEqual(route(shapes, 'e'))
  })
})

describe('normalizeDrawingData safety', () => {
  const shape = (extra: Record<string, unknown>): Record<string, unknown> => ({ ...box('a', 0, 0, 10, 10), ...extra })
  const raw = (...shapes: Record<string, unknown>[]) => ({ version: 3, canvasHeight: 320, shapes })

  it('keeps safe colours and resets unsafe ones', () => {
    for (const c of ['#abc', '#1e1e1e', '#aabbccdd', 'rgb(1, 2, 3)', 'rgba(1,2,3,.5)', 'hsl(120 50% 50%)', 'oklch(0.7 0.1 120)', 'transparent', 'RebeccaPurple']) {
      const [s] = normalizeDrawingData(raw(shape({ stroke: c, fill: c }))).shapes
      expect(s.stroke, c).toBe(c)
      expect(s.fill, c).toBe(c)
    }
    for (const c of ['url(#x)', 'var(--x)', 'red; background: url(x)', 'rgb(1,2,3) url(x)', '#12g', 'a'.repeat(65), 'rgb((1))', 42]) {
      const [s] = normalizeDrawingData(raw(shape({ stroke: c, fill: c }))).shapes
      expect(s.stroke, String(c)).toBe(STROKE_COLORS[0])
      expect(s.fill, String(c)).toBe('transparent')
    }
  })

  it('clamps coordinates and sizes', () => {
    const [s] = normalizeDrawingData(raw(shape({ x: -1e9, y: 1e9, width: 1e12, height: 5, strokeWidth: 1e6 }))).shapes
    expect(s.x).toBe(-100000)
    expect(s.y).toBe(100000)
    expect(s.width).toBe(100000)
    expect(s.height).toBe(5)
    expect(s.strokeWidth).toBe(100)
    const [line] = normalizeDrawingData(drawing({ ...arrow('l'), width: -1e7 })).shapes
    expect(line.width).toBe(-100000)
  })

  it('caps the shape count with a warning', () => {
    const warnings: string[] = []
    const original = console.warn
    console.warn = (m: string) => warnings.push(m)
    try {
      const shapes = Array.from({ length: 5002 }, (_, i) => box(`b${i}`, 0, 0, 1, 1))
      const data = normalizeDrawingData(drawing(...shapes))
      expect(data.shapes.length).toBe(5000)
      expect(data.shapes[4999].id).toBe('b4999')
      expect(warnings.length).toBe(1)
      expect(warnings[0]).toMatch(/5002/)
    } finally {
      console.warn = original
    }
    const ok = normalizeDrawingData(drawing(box('x', 0, 0, 1, 1)))
    expect(ok.shapes.length).toBe(1)
  })

  it('carries optional title / description through parse and serialize', () => {
    const data = deserializeDrawingData(JSON.stringify({ ...drawing(), title: '  Flow  ', description: 'A to B' }))
    expect(data.title).toBe('Flow')
    expect(data.description).toBe('A to B')
    expect(JSON.parse(serializeDrawingData(data))).toEqual({ version: 3, canvasHeight: 320, title: 'Flow', description: 'A to B', shapes: [] })
    const bare = deserializeDrawingData(JSON.stringify({ ...drawing(), title: '', description: 7 }))
    expect('title' in bare).toBe(false)
    expect('description' in bare).toBe(false)
    const long = deserializeDrawingData(JSON.stringify({ ...drawing(), title: 'x'.repeat(3000) }))
    expect(long.title?.length).toBe(2000)
  })
})

describe('normalizeDrawingData warnings', () => {
  it('reports truncation through onWarn instead of the console', () => {
    const shapes = Array.from({ length: 5001 }, (_, i) => ({ id: `s${i}`, type: 'rect', x: 0, y: 0, w: 10, h: 10, stroke: '#000', fill: 'transparent', strokeWidth: 1 }))
    const warnings: string[] = []
    const data = normalizeDrawingData({ version: 2, canvasHeight: 200, shapes }, (m) => warnings.push(m))
    expect(data.shapes.length).toBe(5000)
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toMatch(/5001 shapes/)
  })
})
