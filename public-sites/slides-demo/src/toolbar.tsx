/**
 * The editor's toolbar, rendered by the demo. The default toolbar would show
 * every built-in button; a deck editor wants the marks, blocks, lists, link,
 * image and history, then the slides plugin's four commands, and only the
 * rich and source modes. `thematicBreak` is hidden because the plugin's
 * "New slide" writes the same `---` through its own node, and `preview` is
 * hidden because the right pane already is the preview. The buttons reuse
 * the editor stylesheet's `rmk-toolbar*` classes, so they look like the
 * default toolbar; the slides group also shows its labels as text.
 */
import type { MarkdownToolbarItem, MarkdownToolbarRenderer } from '@react-markdown-kit/editor'
import styles from './SlidesDemo.module.css'

const HIDDEN: ReadonlySet<string> = new Set(['thematicBreak', 'preview'])

const GROUP_LABELS: Readonly<Record<string, string>> = {
  slides: 'Slides',
  mode: 'Editing mode',
}

function groupItems(items: readonly MarkdownToolbarItem[]): MarkdownToolbarItem[][] {
  const groups: MarkdownToolbarItem[][] = []
  for (const item of items) {
    if (HIDDEN.has(item.id)) continue
    const last = groups[groups.length - 1]
    if (last !== undefined && last[0]?.group === item.group) last.push(item)
    else groups.push([item])
  }
  return groups
}

export const renderToolbar: MarkdownToolbarRenderer = (items) => (
  <div className="rmk-toolbar" role="toolbar" aria-label="Formatting">
    {groupItems(items).map((group) => {
      const name = group[0]?.group ?? 'insert'
      const labelled = name === 'slides'
      return (
        <div
          key={name}
          className={labelled ? `rmk-toolbar-group ${styles.slidesGroup}` : 'rmk-toolbar-group'}
          role="group"
          aria-label={GROUP_LABELS[name]}
        >
          {group.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.active ? 'rmk-toolbar-button rmk-toolbar-button-active' : 'rmk-toolbar-button'}
              aria-label={item.label}
              aria-pressed={item.active}
              title={item.label}
              disabled={item.disabled}
              data-rmk-toolbar-item={item.id}
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={item.run}
            >
              {item.icon}
              {labelled ? <span>{item.label}</span> : null}
            </button>
          ))}
        </div>
      )
    })}
  </div>
)
