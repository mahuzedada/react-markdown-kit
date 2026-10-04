import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { $createRangeSelection, $setSelection } from 'lexical'
import { editorOf } from '../bridge/session.js'
import { cx, editorClass } from '../class-names.js'
import { TablePicker } from './table-tools.js'
import type { EditorInternals } from './internals.js'
import type { MarkdownEditorInstance, MarkdownToolbarItem } from '../types.js'

interface CompactToolbarProps {
  editor: MarkdownEditorInstance
  internals: EditorInternals
  items: MarkdownToolbarItem[]
  end?: ReactNode
}

export function CompactToolbar({ editor, internals, items, end }: CompactToolbarProps): ReactElement {
  const root = useRef<HTMLDivElement>(null)
  const [bubble, setBubble] = useState<{ left: number; top: number } | null>(null)
  const selectedRange = useRef<Range | null>(null)
  const native = editorOf(internals.bridge)

  useEffect(() => {
    const close = (event: PointerEvent): void => {
      root.current?.querySelectorAll('details[open]').forEach(details => {
        if (!details.contains(event.target as Node)) details.removeAttribute('open')
      })
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  useEffect(() => {
    const measure = (): void => {
      const selection = window.getSelection()
      const surface = native.getRootElement()
      if (
        internals.mode !== 'rich' || internals.readOnly || !surface ||
        surface.hasAttribute('data-rmk-table-range') || !selection || selection.isCollapsed ||
        !surface.contains(selection.anchorNode) || !surface.contains(selection.focusNode) || !selection.rangeCount
      ) {
        setBubble(null)
        return
      }
      const range = selection.getRangeAt(0)
      if (typeof range.getBoundingClientRect !== 'function') return
      selectedRange.current = range.cloneRange()
      const rect = range.getBoundingClientRect()
      if (!rect.width && !rect.height) {
        setBubble(null)
        return
      }
      const bounds = surface.parentElement?.getBoundingClientRect()
      if (bounds && (rect.bottom < bounds.top || rect.top > bounds.bottom)) {
        setBubble(null)
        return
      }
      setBubble({
        left: Math.max(8, Math.min(window.innerWidth - 186, rect.left + rect.width / 2 - 89)),
        top: Math.max(8, rect.top - 44),
      })
    }
    measure()
    document.addEventListener('selectionchange', measure)
    document.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    const unregister = native.registerUpdateListener(measure)
    return () => {
      unregister()
      document.removeEventListener('selectionchange', measure)
      document.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [native, internals.mode, internals.readOnly])

  const renderButton = (item: MarkdownToolbarItem, label = false, floating = false): ReactElement => <button
    key={item.id} type="button" title={item.label} aria-label={item.label} aria-pressed={item.active}
    disabled={item.disabled} data-rmk-toolbar-item={floating ? undefined : item.id}
    className={cx(editorClass('toolbarButton', internals.classNames), item.active ? editorClass('toolbarButtonActive', internals.classNames) : undefined)}
    onMouseDown={event => event.preventDefault()} onClick={event => {
      const range = selectedRange.current
      const surface = native.getRootElement()
      if (floating && range && surface?.contains(range.startContainer) && surface.contains(range.endContainer)) {
        native.update(() => {
          const selection = $createRangeSelection()
          selection.applyDOMRange(range)
          $setSelection(selection)
        }, { discrete: true })
      }
      item.run()
      event.currentTarget.closest('details')?.removeAttribute('open')
    }}
  >{item.icon}{label && <span>{item.label}</span>}</button>
  const details = (title: string, label: string, entries: MarkdownToolbarItem[], name: string): ReactElement => (
    <details className={`rmk-toolbar-menu rmk-toolbar-menu-${name}`}>
      <summary role="button" title={label} aria-label={label} aria-haspopup="true">
        {title}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="m2.5 4 2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </summary>
      <div className="rmk-toolbar-popover" role="group" aria-label={label}>
        {Array.from(new Set(entries.map(item => item.group))).map(group => (
          <div className="rmk-toolbar-popover-group" role="group" key={group}>
            {entries.filter(item => item.group === group).map(item => renderButton(item, true))}
          </div>
        ))}
      </div>
    </details>
  )
  const quick = new Set(['image', 'taskList'])
  const formatting = items.filter(item => ['mark', 'block', 'list'].includes(item.group) && !quick.has(item.id))
  const insert = items.filter(item => !['mode', 'history', 'mark', 'block', 'list'].includes(item.group) && !quick.has(item.id) && item.id !== 'table')
  const table = items.find(item => item.id === 'table')
  return <>
    <div ref={root} className={editorClass('toolbar', internals.classNames)} role="toolbar" aria-label={internals.labels?.toolbar ?? 'Formatting'} onKeyDown={event => {
      if (event.key === 'Escape') {
        const details = (event.target as Element).closest('details')
        details?.removeAttribute('open')
        details?.querySelector('summary')?.focus()
      }
    }}>
      {details('Aa', 'Text formatting', formatting, 'format')}
      <span className="rmk-toolbar-divider" aria-hidden="true"/>
      {table && <TablePicker editor={editor} disabled={table.disabled}/>}
      {items.filter(item => quick.has(item.id)).map(item => renderButton(item))}
      {details('+', 'Insert', insert, 'insert')}
      <span className="rmk-toolbar-spacer"/>
      {items.filter(item => item.group === 'history').map(item => renderButton(item))}
      <span className="rmk-toolbar-divider" aria-hidden="true"/>
      {details(internals.mode === 'rich' ? 'Write' : internals.mode === 'source' ? 'Source' : 'Preview', 'Editing mode', items.filter(item => item.group === 'mode'), 'modes')}
      {end}
    </div>
    {bubble && <div className="rmk-selection-toolbar" role="toolbar" aria-label="Selection formatting" style={{ position: 'fixed', left: bubble.left, top: bubble.top }}>
      {items.filter(item => item.group === 'mark' || item.id === 'link').map(item => renderButton(item, false, true))}
    </div>}
  </>
}
