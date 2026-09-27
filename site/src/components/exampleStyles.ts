/*
 * Class strings for the doc-site example chrome (RenderExample,
 * VariablesExample, EditorExample, StreamExample), shared so the four figures
 * stay one design.
 *
 * Note what is NOT here: any style for the rendered Markdown itself. That
 * comes from `@react-markdown-kit/renderer/styles.css` scoped to
 * `.rmk-document`, which is the same opt-in stylesheet a consumer would use.
 */

/** The figure: a bordered card, flush sections inside. */
export const EXAMPLE = 'mx-0 mb-0 overflow-hidden rounded-(--radius) border border-border bg-card'

export const CAPTION = 'border-b border-border bg-muted px-3.5 py-2.5 text-base font-semibold text-foreground'

/** Two panes side by side, stacked under 768px; a rule between them either way. */
export const SPLIT =
  'grid grid-cols-2 max-md:grid-cols-1 [&>*]:min-w-0 [&>*+*]:border-l [&>*+*]:border-border max-md:[&>*+*]:border-t max-md:[&>*+*]:border-l-0'

export const PANE_LABEL = 'flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm font-medium text-foreground'

/** A source pane, as a `pre` or a `textarea`. */
export const SOURCE =
  'm-0 block w-full rounded-none border-0 bg-transparent p-3.5 font-mono text-sm leading-[1.55] text-foreground whitespace-pre-wrap wrap-anywhere'

/** The rendered pane; it also carries `rmk-document`, and its first block sits flush with the padding. */
export const OUTPUT = 'p-3.5 text-base [&>*:first-child]:mt-0'

/** Text under the panes, passed as the example's children. */
export const NOTE = 'border-t border-border px-3.5 py-3 text-base text-foreground'
