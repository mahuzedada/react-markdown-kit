/**
 * The multi-selection's geometry (canvas/interaction.ts): a corner scales
 * the selection uniformly from the opposite corner, a side along its one
 * axis, Alt from the centre; no box shrinks below the minimum; waypoints
 * scale with the group while a free text keeps its size; the keyboard nudge
 * moves the selection and nothing else.
 */
import { describe, expect, it } from 'vitest'
import type { DrawingShape } from '../src/core/drawing-data.js'
import { groupScale, scaleShapes, selectionBounds, translateShapes, type DragState } from '../src/canvas/interaction.js'

function box(id: string, x: number, y: number, width: number, height: number): DrawingShape {
  return { id, type: 'rect', x, y, width, height, stroke: '#1e1e1e', fill: 'transparent', strokeWidth: 2 }
}

const A = box('a', 0, 0, 100, 50)
const B = box('b', 200, 100, 100, 50)
const SHAPES = [A, B]
const BOUNDS = { x: 0, y: 0, w: 300, h: 150 }

function drag(handle: Extract<DragState, { mode: 'group-resize' }>['handle'], fromCenter = false): Extract<DragState, { mode: 'group-resize' }> {
  return { mode: 'group-resize', handle, bounds: BOUNDS, origs: new Map(SHAPES.map((s) => [s.id, s])), fromCenter }
}

describe('group resize', () => {
  it('bounds a selection by the union of its boxes', () => {
    expect(selectionBounds(SHAPES, new Map())).toEqual(BOUNDS)
  })

  it('scales uniformly from the opposite corner, following the axis the pointer went further on', () => {
    const scale = groupScale(drag('se'), { x: 150, y: 120 })
    expect(scale.anchor).toEqual({ x: 0, y: 0 })
    expect(scale.sx).toBeCloseTo(0.8)
    expect(scale.sy).toBeCloseTo(0.8)
    const [a, b] = scaleShapes(SHAPES, drag('se').origs, scale)
    expect(a).toMatchObject({ x: 0, y: 0, width: 80, height: 40 })
    expect(b?.x).toBeCloseTo(160)
    expect(b?.y).toBeCloseTo(80)
    expect(b?.width).toBeCloseTo(80)
  })

  it('anchors a north-west corner on the south-east one', () => {
    const scale = groupScale(drag('nw'), { x: 150, y: 75 })
    expect(scale.anchor).toEqual({ x: 300, y: 150 })
    expect(scale.sx).toBeCloseTo(0.5)
  })

  it('scales along one axis from a side handle', () => {
    const scale = groupScale(drag('e'), { x: 600, y: 999 })
    expect(scale.sx).toBeCloseTo(2)
    expect(scale.sy).toBe(1)
  })

  it('scales about the centre with Alt', () => {
    const scale = groupScale(drag('e', true), { x: 300, y: 0 })
    expect(scale.anchor).toEqual({ x: 150, y: 75 })
    expect(scale.sx).toBeCloseTo(1)
  })

  it('never collapses a box, even when the pointer crosses the anchor', () => {
    const scale = groupScale(drag('se'), { x: -500, y: -500 })
    // The smaller side is 50, the minimum 8
    expect(scale.sx).toBeCloseTo(8 / 50)
  })

  it('scales waypoints with the group and keeps a free text at its size', () => {
    const arrow: DrawingShape = { ...box('c', 0, 0, 300, 150), type: 'arrow', waypoints: [{ x: 100, y: 100 }] }
    const text: DrawingShape = { ...box('t', 100, 100, 40, 20), type: 'text', text: 'hi' }
    const origs = new Map([arrow, text].map((s) => [s.id, s]))
    const [c, t] = scaleShapes([arrow, text], origs, { anchor: { x: 0, y: 0 }, sx: 0.5, sy: 0.5 })
    expect(c?.waypoints).toEqual([{ x: 50, y: 50 }])
    expect(t).toMatchObject({ x: 40, y: 45, width: 40, height: 20 })
  })
})

describe('keyboard nudge', () => {
  it('moves the selected shapes and their waypoints only', () => {
    const arrow: DrawingShape = { ...box('c', 0, 0, 10, 10), type: 'arrow', waypoints: [{ x: 5, y: 5 }] }
    const moved = translateShapes([A, B, arrow], new Set(['a', 'c']), 10, -1)
    expect(moved[0]).toMatchObject({ x: 10, y: -1 })
    expect(moved[1]).toBe(B)
    expect(moved[2]?.waypoints).toEqual([{ x: 15, y: 4 }])
  })
})
