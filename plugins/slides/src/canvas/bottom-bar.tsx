/**
 * The bar between the stage and the strip: slide actions and speaker notes
 * on the left, the position in the middle, the parser's notes and the view
 * switches on the right.
 */
import type { ReactElement } from 'react'
import { useCanvas } from './context.js'
import { chevronDownIcon, chevronUpIcon, copyIcon, gridIcon, notesIcon, plusIcon, stripIcon, trashIcon, warningIcon } from './icons.js'
import { Popover } from './popover.js'

function Problems(): ReactElement | null {
  const { problems, labels } = useCanvas()
  if (problems.length === 0) return null
  return (
    <Popover
      label={labels.problems(problems.length)}
      placement="above-end"
      button={
        <>
          {warningIcon}
          <span>{problems.length}</span>
        </>
      }
    >
      {() => (
        <ul data-rmk-canvas-problems="">
          {problems.map((problem, position) => (
            <li key={`${problem.code}-${position}`}>
              <code>{problem.code}</code> {problem.message}
            </li>
          ))}
        </ul>
      )}
    </Popover>
  )
}

export function BottomBar(): ReactElement {
  const canvas = useCanvas()
  const { labels, editable, index, count, view, stripOpen, notesOpen } = canvas
  return (
    <div data-rmk-canvas-bar="">
      <div role="group" aria-label={labels.slides}>
        {editable ? (
          <>
            <button type="button" aria-label={labels.addSlide} title={labels.addSlide} onClick={canvas.addSlide}>
              {plusIcon}
            </button>
            <button type="button" aria-label={labels.duplicateSlide} title={labels.duplicateSlide} disabled={count === 0} onClick={() => canvas.duplicateSlide(index)}>
              {copyIcon}
            </button>
            <button type="button" aria-label={labels.deleteSlide} title={labels.deleteSlide} disabled={count === 0} onClick={() => canvas.removeSlide(index)}>
              {trashIcon}
            </button>
          </>
        ) : null}
        <button type="button" aria-label={labels.notes} title={labels.notes} aria-pressed={notesOpen} disabled={count === 0} onClick={() => canvas.setNotesOpen(!notesOpen)}>
          {notesIcon}
        </button>
      </div>
      <div data-rmk-canvas-navigation="">
        <button type="button" aria-label={labels.previous} title={labels.previous} disabled={index <= 0 || count === 0} onClick={() => canvas.select(index - 1)}>‹</button>
        <output data-rmk-canvas-counter="" aria-live="polite">{count === 0 ? '0 / 0' : labels.counter(Math.min(index + 1, count), count)}</output>
        <button type="button" aria-label={labels.next} title={labels.next} disabled={index >= count - 1} onClick={() => canvas.select(index + 1)}>›</button>
      </div>
      <div role="group" aria-label={labels.strip}>
        <Problems />
        <span data-rmk-canvas-segmented="">
          <button type="button" aria-label={labels.strip} title={labels.strip} aria-pressed={view === 'strip'} onClick={() => canvas.setView('strip')}>
            {stripIcon}
          </button>
          <button type="button" aria-label={labels.grid} title={labels.grid} aria-pressed={view === 'grid'} onClick={() => canvas.setView('grid')}>
            {gridIcon}
          </button>
        </span>
        <button
          type="button"
          aria-label={stripOpen ? labels.collapse : labels.expand}
          title={stripOpen ? labels.collapse : labels.expand}
          aria-expanded={stripOpen}
          disabled={view === 'grid'}
          onClick={() => canvas.setStripOpen(!stripOpen)}
        >
          {stripOpen ? chevronDownIcon : chevronUpIcon}
        </button>
      </div>
    </div>
  )
}
