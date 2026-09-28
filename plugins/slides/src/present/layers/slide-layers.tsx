/**
 * What sits on top of the current slide's content, in order. Each layer
 * gets the deck state and the drawings and decides for itself whether it
 * shows; a new pointer tool is a new layer listed here.
 */
import type { ComponentType, ReactElement } from 'react'
import type { Drawings } from '../hooks/use-drawings.js'
import type { DeckState } from '../state/deck-state.js'
import { DrawingLayer } from './drawing-layer.js'
import { LaserLayer } from './laser-layer.js'

export interface SlideLayerProps {
  readonly state: DeckState
  readonly drawings: Drawings
}

/** The slide's strokes, always once drawn, and taking the pointer while `draw` is on. */
function Drawing({ state, drawings }: SlideLayerProps): ReactElement | null {
  return <DrawingLayer strokes={drawings.strokesOf(state.index)} active={state.tool === 'draw'} onStroke={(stroke) => drawings.add(state.index, stroke)} />
}

function Laser({ state }: SlideLayerProps): ReactElement | null {
  return state.tool === 'laser' ? <LaserLayer /> : null
}

const SLIDE_LAYERS: readonly ComponentType<SlideLayerProps>[] = [Drawing, Laser]

export function SlideLayers(props: SlideLayerProps): ReactElement {
  return (
    <>
      {SLIDE_LAYERS.map((Layer, index) => (
        <Layer key={index} {...props} />
      ))}
    </>
  )
}
