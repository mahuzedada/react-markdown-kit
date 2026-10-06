/**
 * The insert tools, top left. Each one is an editor command: on the slide
 * being edited it runs at the caret; otherwise it opens the inline editor
 * on the current slide and runs there. A new tool is one more entry in
 * `CANVAS_TOOLS`.
 */
import { useState, type FormEvent, type ReactElement } from 'react'
import { MarkdownTablePicker } from '@react-markdown-kit/editor'
import { useCanvas, type EditorCommand } from './context.js'
import { boldIcon, bulletIcon, codeIcon, headingIcon, imageIcon, italicIcon, numberedIcon, tableIcon, textIcon } from './icons.js'
import type { SlideCanvasLabels } from './labels.js'
import { Popover } from './popover.js'

export interface CanvasTool {
  readonly id: string
  readonly group: string
  readonly label: (labels: SlideCanvasLabels) => string
  readonly icon: ReactElement
  readonly run: EditorCommand
}

export const CANVAS_TOOLS: readonly CanvasTool[] = [
  { id: 'heading', group: 'block', label: (l) => l.heading, icon: headingIcon, run: (c) => c.setBlockType('heading2') },
  { id: 'text', group: 'block', label: (l) => l.text, icon: textIcon, run: (c) => c.setBlockType('paragraph') },
  { id: 'bold', group: 'mark', label: (l) => l.bold, icon: boldIcon, run: (c) => c.toggleMark('strong') },
  { id: 'italic', group: 'mark', label: (l) => l.italic, icon: italicIcon, run: (c) => c.toggleMark('emphasis') },
  { id: 'bullets', group: 'list', label: (l) => l.bulletList, icon: bulletIcon, run: (c) => c.toggleBulletList() },
  { id: 'numbers', group: 'list', label: (l) => l.numberedList, icon: numberedIcon, run: (c) => c.toggleOrderedList() },
  { id: 'table', group: 'insert', label: (l) => l.table, icon: tableIcon, run: (c) => c.insertTable(3, 3) },
  { id: 'code', group: 'insert', label: (l) => l.codeBlock, icon: codeIcon, run: (c) => c.setBlockType('codeBlock') },
]

function useRunTool(): (command: EditorCommand) => void {
  const canvas = useCanvas()
  return (command) => {
    if (canvas.editing !== undefined && canvas.editor !== undefined) command(canvas.editor.commands)
    else canvas.edit({ command, ...(canvas.selectedBlock === undefined ? {} : { block: canvas.selectedBlock }) })
  }
}

function ImageTool(): ReactElement {
  const { labels } = useCanvas()
  const run = useRunTool()
  const [src, setSrc] = useState('')
  const [alt, setAlt] = useState('')
  return (
    <Popover label={labels.image} button={imageIcon} placement="below-start" keepFocus>
      {(close) => {
        const submit = (event: FormEvent): void => {
          event.preventDefault()
          if (src.trim() === '') return
          const image = { src: src.trim(), ...(alt.trim() === '' ? {} : { alt: alt.trim() }) }
          run((commands) => commands.insertImage(image))
          setSrc('')
          setAlt('')
          close()
        }
        return (
          <form data-rmk-canvas-form="" onSubmit={submit}>
            <label>
              {labels.imageUrl}
              <input type="url" value={src} onChange={(event) => setSrc(event.target.value)} placeholder="https://" autoFocus required />
            </label>
            <label>
              {labels.imageAlt}
              <input type="text" value={alt} onChange={(event) => setAlt(event.target.value)} />
            </label>
            <button type="submit">{labels.insert}</button>
          </form>
        )
      }}
    </Popover>
  )
}

export function Tools(): ReactElement {
  const { labels } = useCanvas()
  const run = useRunTool()
  return (
    <div role="toolbar" aria-label={labels.tools} data-rmk-canvas-island="start">
      {CANVAS_TOOLS.map((tool, position) => (
        <span key={tool.id} data-rmk-canvas-tool-group={CANVAS_TOOLS[position - 1]?.group === tool.group ? undefined : tool.group}>
          {tool.id === 'table' ? <MarkdownTablePicker placement="above" onInsert={(rows, columns) => run((commands) => commands.insertTable(rows, columns))} /> : <button type="button" aria-label={tool.label(labels)} title={tool.label(labels)} onMouseDown={(event) => event.preventDefault()} onClick={() => run(tool.run)}>
            {tool.icon}
          </button>}
        </span>
      ))}
      <ImageTool />
    </div>
  )
}
