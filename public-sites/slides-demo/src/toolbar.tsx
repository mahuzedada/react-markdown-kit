/**
 * The editor's toolbar, rendered by the demo. The default toolbar would show
 * every built-in button; a deck editor wants the marks, blocks, lists, link,
 * image and history, then the slides plugin's four commands, and only the
 * rich and source modes. `thematicBreak` is hidden because the plugin's
 * "New slide" writes the same `---` through its own node, and `preview` is
 * hidden because the right pane already is the preview. The buttons are zui
 * ghost buttons; the slides group also shows its labels as text, and
 * collapses to icons like the others in a phone-width pane (the labels stay
 * in aria-label and title).
 */
import type { MarkdownToolbarItem, MarkdownToolbarRenderer } from '@react-markdown-kit/editor'
import Button from '@zuilib/primitives/button'
import { cn } from '@zuilib/primitives/lib/cn'

/** The slides buttons show their labels: the buttons are the point of the demo. */
const LABELLED_BUTTON = 'w-auto gap-1.5 text-sm px-[0.55rem] whitespace-nowrap max-[480px]:w-8 max-[480px]:p-0'

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
          className={cn('rmk-toolbar-group', labelled && 'flex-wrap')}
          role="group"
          aria-label={GROUP_LABELS[name]}
        >
          {group.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              size="icon"
              track={`toolbar-${item.id}`}
              className={cn('size-8 text-base', item.active && 'bg-accent text-accent-foreground', labelled && LABELLED_BUTTON)}
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
              {labelled ? <span className="max-[480px]:hidden">{item.label}</span> : null}
            </Button>
          ))}
        </div>
      )
    })}
  </div>
)
