import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { $createNodeSelection, $isNodeSelection, $setSelection, $createParagraphNode, $getNearestNodeFromDOMNode, $getNodeByKey, $getSelection, $isRangeSelection, KEY_TAB_COMMAND, KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_HIGH, HISTORY_PUSH_TAG } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { editorOf } from '../bridge/session.js'
import { $isTableCellNode, $isTableNode } from '../nodes/table.js'
import { $activeCell, $cellOf, $tableOf, $rows, $navigateCell, $tableAction, $alignColumn, $pasteCells, parseTableClipboard, serializeTableClipboard, type TableAction } from '../tables.js'
import { TableRail, type TableAxis, type TableBox, type TableLane } from './table-rail.js'
import type { EditorInternals } from './internals.js'
import type { MarkdownEditorInstance } from '../types.js'

function TableActionIcon({ action }: { action: TableAction | 'left' | 'center' | 'right' }): ReactElement {
  const alignment = ['left', 'center', 'right'].includes(action)
  const shortStart = action === 'right' ? 7 : action === 'center' ? 5 : 3
  return <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {alignment ? <><path d="M3 4h12M3 10h12"/><path d={`M${shortStart} 7h8M${shortStart} 13h8`}/></> : action.startsWith('delete') ? <><path d="M4 5h10M7 3h4M5.5 5l.5 10h6l.5-10M8 8v4M10 8v4"/></> : <><rect x="3" y="3" width="12" height="12" rx="1.5"/><path d={action.startsWith('row') ? 'M3 9h12' : 'M9 3v12'}/><path d={action === 'rowAbove' ? 'M7 6h4M9 4v4' : action === 'rowBelow' ? 'M7 12h4M9 10v4' : action === 'columnLeft' ? 'M4 9h4M6 7v4' : 'M10 9h4M12 7v4'}/></>}
  </svg>
}

export function TablePicker({ editor, disabled }: { editor: MarkdownEditorInstance; disabled: boolean }): ReactElement {
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState([3, 3])
  const [panel, setPanel] = useState({ left: 0, width: 218 })
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLButtonElement>('[data-size]')?.focus()
    const position = (): void => {
      const rect = root.current?.getBoundingClientRect()
      const toolbar = root.current?.closest('[role=toolbar]')?.getBoundingClientRect()
      if (!rect) return
      const start = Math.max(8, toolbar?.left ?? 0)
      const end = Math.min(window.innerWidth - 8, toolbar?.right ?? window.innerWidth)
      const width = Math.min(218, Math.max(0, end - start))
      setPanel({ left: Math.max(start, Math.min(rect.left, end - width)) - rect.left, width })
    }
    position()
    window.addEventListener('resize', position)
    document.addEventListener('scroll', position, true)
    const close = (event: PointerEvent): void => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true) }
  }, [open])
  return <div className="rmk-table-picker" ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
  }}>
    <button ref={trigger} type="button" className="rmk-toolbar-button" data-rmk-toolbar-item="table" aria-label="Insert table" title="Insert table" aria-expanded={open} aria-haspopup="dialog" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => setOpen(!open)}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2.5" y="3" width="15" height="14" rx="2"/><path d="M3 8h14M3 12.5h14M8 8v9M12.5 8v9"/></svg>
    </button>
    {open && <div className="rmk-table-popover" style={panel} role="dialog" aria-label="Insert table">
      <strong>Insert table</strong><span className="rmk-table-hint" aria-live="polite">{size[0]} rows × {size[1]} columns</span>
      <div className="rmk-table-size-grid">{Array.from({length: 48}, (_, index) => {
        const r = Math.floor(index / 8) + 1, c = index % 8 + 1
        return <button key={index} type="button" data-size="" data-active={r <= size[0]! && c <= size[1]!} aria-label={`${r} rows, ${c} columns`} onFocus={() => setSize([r,c])} onMouseEnter={() => setSize([r,c])} onKeyDown={event => {
          const delta = ({ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8} as Record<string, number>)[event.key]
          if (delta !== undefined) { event.preventDefault(); root.current?.querySelectorAll<HTMLButtonElement>('[data-size]')[Math.max(0, Math.min(47, index + delta))]?.focus() }
        }} onClick={() => { editor.commands.insertTable(r,c); setOpen(false); editor.focus() }}/>
      })}</div><span className="rmk-table-hint">First row is the header</span>
    </div>}
  </div>
}

interface ActiveTable extends TableBox {
  key: string; tableKey: string; selected: boolean; row: number; column: number
  rows: TableLane[]; columns: TableLane[]
  panelLeft: number; panelWidth: number; align: string | null
}
function sameLayout(a: ActiveTable | null, b: ActiveTable): boolean {
  return a !== null && (Object.keys(b) as (keyof ActiveTable)[]).every(key => {
    if (key === 'rows' || key === 'columns') return a[key].length === b[key].length && a[key].every((lane, i) => lane.start === b[key][i]!.start && lane.size === b[key][i]!.size)
    return a[key] === b[key]
  })
}

export function TableTools({ internals }: { internals: EditorInternals }): ReactElement | null {
  const editor = editorOf(internals.bridge)
  const [active, setActive] = useState<ActiveTable | null>(null)
  const [menu, setMenu] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const range = useRef<string[]>([])
  const anchor = useRef<string | null>(null)
  const activeKey = useRef<string | null>(null)
  const selectedTableKey = useRef<string | null>(null)
  const tools = useRef<HTMLDivElement>(null)
  const deleteTable = useCallback((key: string): void => {
    range.current = []; selectedTableKey.current = null
    editor.update(() => {
      const table = $getNodeByKey(key)
      if ($isTableNode(table)) $tableAction('deleteTable', $rows(table)[0]?.[0])
    }, {discrete: true, tag: HISTORY_PUSH_TAG})
    setMenu(false); setAnnouncement('Table deleted.'); editor.focus()
  }, [editor])
  useEffect(() => {
    if (menu) tools.current?.querySelector<HTMLButtonElement>('.rmk-table-actions button')?.focus()
  }, [menu])
  useEffect(() => {
    if (internals.readOnly) return
    const root = editor.getRootElement()
    if (!root) return
    let dragging = false
    const keyAt = (target: EventTarget | null): string | null => {
      if (!(target instanceof Node) || !root.contains(target)) return null
      return editor.read(() => $cellOf($getNearestNodeFromDOMNode(target))?.getKey() ?? null)
    }
    const paint = (): void => {
      root.toggleAttribute('data-rmk-table-range', range.current.length > 0)
      root.querySelectorAll('[data-rmk-cell-selected]').forEach(el => el.removeAttribute('data-rmk-cell-selected'))
      root.querySelectorAll('[data-rmk-cell-active]').forEach(el => el.removeAttribute('data-rmk-cell-active'))
      root.querySelectorAll('[data-rmk-table-selected]').forEach(el => el.removeAttribute('data-rmk-table-selected'))
      if (selectedTableKey.current) editor.getElementByKey(selectedTableKey.current)?.setAttribute('data-rmk-table-selected', 'true')
      if (activeKey.current && !selectedTableKey.current) editor.getElementByKey(activeKey.current)?.setAttribute('data-rmk-cell-active', 'true')
      range.current.forEach(key => editor.getElementByKey(key)?.setAttribute('data-rmk-cell-selected', 'true'))
    }
    let observedTable: HTMLElement | null = null
    let tableResize: ResizeObserver | null = null
    const refresh = (): void => {
      editor.getEditorState().read(() => {
        range.current = range.current.filter(key => $isTableCellNode($getNodeByKey(key)))
        const selection = $getSelection()
        const selectedTable = $isNodeSelection(selection) ? selection.getNodes().find($isTableNode) : null
        selectedTableKey.current = selectedTable?.getKey() ?? null
        const selected = range.current[0] ? $getNodeByKey(range.current[0]) : null
        const cell = selectedTable ? $rows(selectedTable)[0]?.[0] : $isTableCellNode(selected) ? selected : $isRangeSelection(selection) ? $activeCell() : null
        const table = cell && $tableOf(cell)
        if (!cell || !table) { setActive(null); activeKey.current = null; tableResize?.disconnect(); observedTable = null; return }
        activeKey.current = cell.getKey()
        const element = editor.getElementByKey(table.getKey()), cellElement = editor.getElementByKey(cell.getKey())
        if (!element || !cellElement || !root.parentElement) return
        if (observedTable !== element && typeof ResizeObserver !== 'undefined') {
          tableResize?.disconnect()
          tableResize = new ResizeObserver(refresh)
          tableResize.observe(element)
          observedTable = element
        }
        const rect = element.getBoundingClientRect(), parent = root.parentElement.getBoundingClientRect()
        const grid = $rows(table)
        const rows = grid.map(row => {
          const bounds = editor.getElementByKey(row[0]!.getParent()!.getKey())!.getBoundingClientRect()
          return { start: bounds.top - rect.top, size: bounds.height }
        })
        const columns = (grid[0] ?? []).map(cell => {
          const bounds = editor.getElementByKey(cell.getKey())!.getBoundingClientRect()
          return { start: bounds.left - rect.left, size: bounds.width }
        })
        const next: ActiveTable = {
          key: cell.getKey(), tableKey: table.getKey(), selected: !!selectedTable, row: cell.getParent()!.getIndexWithinParent(), column: cell.getIndexWithinParent(),
          top: rect.top - parent.top + root.parentElement.scrollTop, left: rect.left - parent.left + root.parentElement.scrollLeft,
          width: rect.width, height: rect.height, rtl: getComputedStyle(element).direction === 'rtl', rows, columns,
          panelWidth: Math.min(204, Math.max(0, root.parentElement.clientWidth - 16)),
          panelLeft: root.parentElement.scrollLeft + Math.max(8, Math.min(rect.right - parent.left - 204, root.parentElement.clientWidth - 212)),
          align: table.getAlign()[cell.getIndexWithinParent()] ?? null,
        }
        setActive(previous => sameLayout(previous, next) ? previous : next)
      })
      paint()
    }
    const selectRectangle = (start: string, end: string): void => {
      editor.getEditorState().read(() => {
        const a = $getNodeByKey(start), b = $getNodeByKey(end)
        if (!$isTableCellNode(a) || !$isTableCellNode(b)) return
        const table = $tableOf(a)
        if (!table || !$tableOf(b)?.is(table)) return
        const r1 = a.getParent()!.getIndexWithinParent(), r2 = b.getParent()!.getIndexWithinParent(), c1 = a.getIndexWithinParent(), c2 = b.getIndexWithinParent()
        range.current = $rows(table).slice(Math.min(r1,r2),Math.max(r1,r2)+1).flatMap(row => row.slice(Math.min(c1,c2),Math.max(c1,c2)+1).map(cell => cell.getKey()))
      }); paint()
    }
    const down = (event: PointerEvent): void => {
      if (event.button !== 0) return
      const key = keyAt(event.target)
      setMenu(false)
      if (event.shiftKey && key && (anchor.current || activeKey.current)) {
        event.preventDefault(); selectRectangle(anchor.current ?? activeKey.current!, key); return
      }
      range.current = []; selectedTableKey.current = null; paint(); anchor.current = key; dragging = key !== null
    }
    const move = (event: PointerEvent): void => {
      if (!dragging || !anchor.current || event.pointerType === 'touch') return
      const key = keyAt(event.target)
      if (key && key !== anchor.current) { event.preventDefault(); selectRectangle(anchor.current, key) }
    }
    const up = (): void => { dragging = false }
    const outside = (event: PointerEvent): void => {
      if (!root.contains(event.target as Node) && !tools.current?.contains(event.target as Node)) { range.current = []; selectedTableKey.current = null; paint(); setMenu(false); setActive(null) }
    }
    const copy = (event: ClipboardEvent): void => {
      if (!range.current.length || !event.clipboardData) return
      const rows = editor.getEditorState().read(() => {
        const first = $getNodeByKey(range.current[0]!)
        const table = $isTableCellNode(first) && $tableOf(first)
        return table ? $rows(table).map(row => row.filter(cell => range.current.includes(cell.getKey())).map(cell => cell.getTextContent())).filter(row => row.length) : []
      })
      event.preventDefault(); event.stopPropagation()
      event.clipboardData.setData('text/plain', serializeTableClipboard(rows))
      const escape = (value: string): string => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
      event.clipboardData.setData('text/html', `<table>${rows.map(row => `<tr>${row.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</table>`)
    }
    const paste = (event: ClipboardEvent): void => {
      if (!event.clipboardData) return
      const text = event.clipboardData.getData('text/plain'), html = event.clipboardData.getData('text/html')
      let values = parseTableClipboard(text)
      if (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html'), table = doc.querySelector('table')
        if (table) values = Array.from(table.rows, row => Array.from(row.cells, cell => cell.textContent ?? ''))
      }
      if (values.length <= 1 && (values[0]?.length ?? 0) <= 1 && !range.current.length) return
      if (values.length === 1 && values[0]?.length === 1 && range.current.length > 1) {
        const dimensions = editor.getEditorState().read(() => {
          const first = $getNodeByKey(range.current[0]!)
          const table = $isTableCellNode(first) && $tableOf(first)
          const selectedRows = table ? $rows(table).map(row => row.filter(cell => range.current.includes(cell.getKey()))).filter(row => row.length) : []
          return [selectedRows.length, selectedRows[0]?.length ?? 0]
        })
        const value = values[0][0]!
        values = Array.from({length: dimensions[0]!}, () => Array.from({length: dimensions[1]!}, () => value))
      }
      const key = range.current[0] ?? activeKey.current
      if (!key) return
      event.preventDefault(); event.stopPropagation()
      editor.update(() => { const cell = $getNodeByKey(key); if ($isTableCellNode(cell)) $pasteCells(cell, values) }, {discrete: true, tag: HISTORY_PUSH_TAG})
      range.current = []; refresh()
    }
    const clearCells = (): void => {
      const keys = [...range.current]
      editor.update(() => {
        keys.forEach(key => { const cell = $getNodeByKey(key); if ($isTableCellNode(cell)) cell.clear().append($createParagraphNode()) })
        const first = keys[0] ? $getNodeByKey(keys[0]) : null
        if ($isTableCellNode(first)) first.selectStart()
      }, {discrete: true, tag: HISTORY_PUSH_TAG})
      range.current = []; refresh()
    }
    const cut = (event: ClipboardEvent): void => {
      if (!range.current.length) return
      copy(event); clearCells()
    }
    const keydown = (event: KeyboardEvent): void => {
      if (event.altKey && event.key === 'F10' && activeKey.current) {
        event.preventDefault(); event.stopPropagation()
        tools.current?.querySelector<HTMLButtonElement>('.rmk-table-rail-row button')?.focus()
        return
      }
      if (selectedTableKey.current && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault(); event.stopPropagation(); deleteTable(selectedTableKey.current); return
      }
      if (!range.current.length) return
      if (event.key.startsWith('Arrow') || ((event.metaKey || event.ctrlKey) && event.key === 'a')) {
        range.current = []; paint(); return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault(); event.stopPropagation(); clearCells()
      } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        // Collapse a rectangular selection before normal text input runs.
        clearCells()
      }
    }
    const context = (event: MouseEvent): void => {
      const key = keyAt(event.target)
      if (!key) return
      event.preventDefault()
      editor.update(() => { const cell = $getNodeByKey(key); if ($isTableCellNode(cell)) cell.selectStart() }, {discrete:true})
      setMenu(true)
    }
    root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move)
    root.addEventListener('cut', cut, true); root.addEventListener('keydown', keydown, true)
    root.addEventListener('copy', copy, true); root.addEventListener('paste', paste, true); root.addEventListener('contextmenu', context)
    document.addEventListener('pointercancel', up); document.addEventListener('pointerup', up); document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', refresh)
    document.addEventListener('scroll', refresh, true)
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh); resize?.observe(root)
    const unregister = mergeRegister(editor.registerUpdateListener(refresh), editor.registerCommand(KEY_TAB_COMMAND, event => {
      const selection = $getSelection()
      if (event.altKey || event.ctrlKey || event.metaKey || !$activeCell() || !$isRangeSelection(selection) || !selection.isCollapsed() || range.current.length > 0) return false
      event.preventDefault(); range.current = []; $navigateCell(event.shiftKey); return true
    }, COMMAND_PRIORITY_HIGH), editor.registerCommand(KEY_ESCAPE_COMMAND, () => {
      range.current = []; setMenu(false)
      const selection = $getSelection()
      const table = $isNodeSelection(selection) ? selection.getNodes().find($isTableNode) : null
      if (table) { $rows(table)[0]?.[0]?.selectStart(); selectedTableKey.current = null }
      paint(); return !!table
    }, COMMAND_PRIORITY_HIGH))
    refresh()
    return () => {
      root.removeAttribute('data-rmk-table-range')
      unregister(); resize?.disconnect(); tableResize?.disconnect(); document.removeEventListener('scroll', refresh, true); window.removeEventListener('resize', refresh)
      root.removeEventListener('cut', cut, true); root.removeEventListener('keydown', keydown, true)
      root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move); root.removeEventListener('copy', copy, true); root.removeEventListener('paste', paste, true); root.removeEventListener('contextmenu', context)
      document.removeEventListener('pointercancel', up); document.removeEventListener('pointerup', up); document.removeEventListener('pointerdown', outside)
      root.querySelectorAll('[data-rmk-cell-selected], [data-rmk-cell-active], [data-rmk-table-selected]').forEach(el => { el.removeAttribute('data-rmk-cell-selected'); el.removeAttribute('data-rmk-cell-active'); el.removeAttribute('data-rmk-table-selected') })
    }
  }, [editor, internals.readOnly, deleteTable])
  const status = <span className="rmk-table-sr-only" role="status">{announcement}</span>
  if (!active || internals.readOnly) return status
  const deselectTable = (): void => {
    editor.update(() => { const cell = $getNodeByKey(active.key); if ($isTableCellNode(cell)) cell.selectStart() }, {discrete: true})
    setMenu(false); editor.focus()
  }
  const selectTable = (): void => {
    if (active.selected) { deselectTable(); return }
    range.current = []; setMenu(false)
    editor.update(() => {
      const table = $getNodeByKey(active.tableKey)
      if (!$isTableNode(table)) return
      const selection = $createNodeSelection(); selection.add(table.getKey()); $setSelection(selection)
    }, {discrete: true})
    setAnnouncement('Table selected. Press Delete or Backspace to remove it, or Escape to return to editing.')
    editor.focus()
  }
  const railAction = (axis: TableAxis, mode: 'insert' | 'delete', index: number): void => {
    range.current = []
    let changed = false
    editor.update(() => {
      const table = $getNodeByKey(active.tableKey)
      if (!$isTableNode(table)) return
      const grid = $rows(table), count = axis === 'row' ? grid.length : grid[0]!.length
      // Edge controls never remove the whole table or insert before its header.
      if (index < 0 || index > count || (mode === 'delete' && (count <= 1 || index === count)) || (axis === 'row' && mode === 'insert' && index === 0)) return
      const target = Math.min(index, count - 1)
      const cell = axis === 'row' ? grid[target]?.[active.column] : grid[active.row]?.[target]
      if (!cell) return
      const command = axis === 'row'
        ? mode === 'delete' ? 'deleteRow' : index === count ? 'rowBelow' : 'rowAbove'
        : mode === 'delete' ? 'deleteColumn' : index === count ? 'columnRight' : 'columnLeft'
      $tableAction(command, cell); changed = true
    }, {discrete: true, tag: HISTORY_PUSH_TAG})
    if (changed) setAnnouncement(`${axis === 'row' ? 'Row' : 'Column'} ${index + 1} ${mode === 'insert' ? 'inserted' : 'deleted'}.`)
    setMenu(false); editor.focus()
  }
  return <div ref={tools} className="rmk-table-tools" data-table-selected={active.selected} onMouseDown={event => event.preventDefault()} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); deselectTable() }
    if (active.selected && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); deleteTable(active.tableKey) }
  }}>
    {status}
    <button type="button" className="rmk-table-selector" style={{top: active.top - 23, left: active.rtl ? active.left + active.width + 7 : active.left - 27}} title="Select table" aria-label="Select table" aria-pressed={active.selected} onClick={selectTable}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1"/><path d="M2 5h8M5 2v8"/></svg>
    </button>
    {active.selected && <div className="rmk-table-toolbar" role="toolbar" aria-label="Selected table" style={{top: Math.max(0, active.top - 64), left: active.left}}>
      <button type="button" onClick={() => deleteTable(active.tableKey)}><TableActionIcon action="deleteTable"/><span>Delete table</span></button>
    </div>}
    <TableRail key={`${active.tableKey}-row`} axis="row" box={active} lanes={active.rows} current={active.row} onAction={(mode, index) => railAction('row', mode, index)}/>
    <TableRail key={`${active.tableKey}-column`} axis="column" box={active} lanes={active.columns} current={active.column} onAction={(mode, index) => railAction('column', mode, index)}/>
    <button type="button" className="rmk-table-options" style={{top: active.top + active.height + 3, left: active.left + active.width - 24}} title="Table options" aria-label="Table options" aria-expanded={menu} onClick={() => setMenu(!menu)}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="13" cy="8" r="1"/></svg>
    </button>
    {menu && <div className="rmk-table-popover rmk-table-actions" role="group" aria-label="Table options" style={{top: active.top + active.height + 30, left: active.panelLeft, width: active.panelWidth}}>
      <span className="rmk-table-actions-label">Column {active.column + 1} alignment</span>
      <div className="rmk-table-align" role="group" aria-label="Column alignment">{(['left','center','right'] as const).map(align => <button key={align} type="button" title={`Align ${align}`} aria-label={`Align ${align}`} aria-pressed={(active.align ?? 'left') === align} onClick={() => {
        editor.update(() => { const cell = $getNodeByKey(active.key); if ($isTableCellNode(cell)) $alignColumn(align, cell) }, {discrete:true, tag:HISTORY_PUSH_TAG})
      }}><TableActionIcon action={align}/></button>)}</div>
      <button type="button" className="rmk-table-delete" onClick={() => deleteTable(active.tableKey)}><TableActionIcon action="deleteTable"/><span>Delete table</span></button>
    </div>}
  </div>
}
