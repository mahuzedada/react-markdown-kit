/** Strokes drawn on each slide during this presentation, in slide coordinates. Kept in memory only. */
import { useCallback, useState } from 'react'

export type Stroke = readonly (readonly [number, number])[]

export interface Drawings {
  strokesOf(index: number): readonly Stroke[]
  add(index: number, stroke: Stroke): void
  clear(index: number): void
}

const NONE: readonly Stroke[] = []

export function useDrawings(): Drawings {
  const [byIndex, setByIndex] = useState<ReadonlyMap<number, readonly Stroke[]>>(new Map())
  const strokesOf = useCallback((index: number) => byIndex.get(index) ?? NONE, [byIndex])
  const add = useCallback((index: number, stroke: Stroke) => {
    setByIndex((current) => new Map(current).set(index, [...(current.get(index) ?? NONE), stroke]))
  }, [])
  const clear = useCallback((index: number) => {
    setByIndex((current) => {
      if (!current.has(index)) return current
      const next = new Map(current)
      next.delete(index)
      return next
    })
  }, [])
  return { strokesOf, add, clear }
}
