/**
 * The canvas's `components.article`. The renderer hands the deck's
 * <article> its sections as children; here they become the stage and the
 * slide list instead of a stack, so the deck is rendered once and both
 * show the same sections. Any other article renders as itself.
 */
import { createElement, type ReactElement, type ReactNode } from 'react'
import { collectSections } from '../present/sections.js'
import { BottomBar } from './bottom-bar.js'
import { useCanvas } from './context.js'
import { NotesPanel } from './notes-panel.js'
import { SlideList } from './slide-list.js'
import { Stage } from './stage.js'
import { PropertiesPanel } from './properties-panel.js'
import { WorkspaceBar } from './workspace-bar.js'

interface ArticleProps {
  readonly node?: unknown
  readonly children?: ReactNode
  readonly [attribute: string]: unknown
}

function attributesOf(props: ArticleProps): Record<string, unknown> {
  const attributes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) if (key !== 'node' && key !== 'children') attributes[key] = value
  return attributes
}

function CanvasBody({ deck, children }: { readonly deck: Record<string, unknown>; readonly children: ReactNode }): ReactElement {
  const { view, stripOpen, notesOpen, count, index, propertiesOpen, editable, focused } = useCanvas()
  const sections = collectSections(children)
  return (
    <>
      <div data-rmk-canvas-workarea="" data-rmk-canvas-inspecting={!focused && propertiesOpen && editable && view === 'strip' ? '' : undefined}>
      <div data-rmk-canvas-main="">
      <WorkspaceBar deck={deck} />
      {view === 'grid' ? <SlideList deck={deck} sections={sections} layout="grid" /> : <Stage deck={deck} sections={sections} />}
      </div>
      {!focused && propertiesOpen && editable && view === 'strip' ? <PropertiesPanel section={sections[index]} /> : null}
      </div>
      {!focused && notesOpen && count > 0 && view === 'strip' ? <NotesPanel /> : null}
      <BottomBar />
      {!focused && view === 'strip' && stripOpen && sections.length > 0 ? <SlideList deck={deck} sections={sections} layout="strip" /> : null}
    </>
  )
}

export function CanvasArticle(props: ArticleProps): ReactElement {
  const attributes = attributesOf(props)
  if (props['data-rmk-deck'] === undefined) return createElement('article', attributes, props.children)
  return <CanvasBody deck={attributes}>{props.children}</CanvasBody>
}
