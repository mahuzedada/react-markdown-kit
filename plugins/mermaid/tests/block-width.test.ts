// Ported from @zuilib/text-editor tests/block-width.test.mjs (MIT): only the
// parts that exercise the pure modules. Table-marker and round-trip cases
// need the editor and are not ported here.
import { describe, it, expect } from 'vitest'

import {
  BLOCK_WIDTHS,
  DRAWING_DATA_JSON_SCHEMA,
  DRAWING_SKELETON_JSON_SCHEMA,
  expandDrawingSkeleton,
  isBlockWidth,
  deserializeDrawingData,
  parseDrawingSkeleton,
  serializeDrawingData,
} from '../src/core/index.js'

const SHAPE =
  '{"id":"a","type":"rect","x":20,"y":20,"width":160,"height":90,"stroke":"#1e1e1e","fill":"transparent","strokeWidth":2,"text":"A"}'

describe('BlockWidth', () => {
  it('has three values', () => {
    expect(BLOCK_WIDTHS).toEqual(['full', 'text', 'content'])
    expect(isBlockWidth('text')).toBe(true)
    expect(isBlockWidth('narrow')).toBe(false)
    expect(isBlockWidth(undefined)).toBe(false)
  })

  it('is listed in both JSON schemas', () => {
    expect(DRAWING_DATA_JSON_SCHEMA.properties.width.enum).toEqual(['full', 'text', 'content'])
    expect(DRAWING_SKELETON_JSON_SCHEMA.properties.width.enum).toEqual(['full', 'text', 'content'])
  })
})

describe('drawing width', () => {
  it('drops an unknown width value instead of rejecting the payload', () => {
    const data = deserializeDrawingData(`{"version":3,"canvasHeight":200,"width":"narrow","shapes":[${SHAPE}]}`)
    expect(data.width).toBeUndefined()
    expect(data.shapes.length).toBe(1)
    // Shape sizes serialize as numeric "width"; the block width would be a string
    expect(/"width":"/.test(serializeDrawingData(data))).toBe(false)
  })

  it('keeps an explicit "full" and "content" through parse and serialize', () => {
    for (const width of ['full', 'content'] as const) {
      const json = `{"version":3,"canvasHeight":200,"width":"${width}","shapes":[${SHAPE}]}`
      expect(serializeDrawingData(deserializeDrawingData(json))).toBe(json)
    }
    const bare = `{"version":3,"canvasHeight":200,"shapes":[${SHAPE}]}`
    expect(serializeDrawingData(deserializeDrawingData(bare))).toBe(bare)
  })

  it('passes every width through expandDrawingSkeleton and ignores unknown ones', () => {
    for (const width of BLOCK_WIDTHS) {
      expect(expandDrawingSkeleton({ width, boxes: [{ id: 'x' }] }).width).toBe(width)
    }
    expect(expandDrawingSkeleton({ boxes: [{ id: 'x' }] }).width).toBeUndefined()
    const parsed = parseDrawingSkeleton('{"width":"narrow","boxes":[{"id":"x"}]}')
    expect(parsed.width).toBeUndefined()
    expect(parsed.shapes.length).toBe(1)
  })
})
