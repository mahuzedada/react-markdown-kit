import sites from '../sites.json'

/*
 * The site's navigation as data: the navbar, the footer and the docs
 * sidebar. Docs are named by their path under docs/ without the extension;
 * the sidebar takes each label from the doc's `sidebar_label`.
 */

export interface NavLink {
  readonly label: string
  readonly href: string
}

const external = (href: string): boolean => /^https?:/.test(href)
export { external as isExternal }

export const NAVBAR: readonly NavLink[] = [
  { label: 'Docs', href: '/docs/getting-started' },
  { label: 'Variables demo', href: '/markdown-variables' },
  { label: 'Renderer demo', href: '/markdown-renderer' },
  { label: 'Editor demo', href: '/markdown-editor' },
  { label: 'Mermaid editor', href: '/mermaid-editor' },
  { label: 'Slides demo', href: '/markdown-slides' },
]

export const NAVBAR_END: readonly NavLink[] = [
  { label: 'Migrate', href: '/migrate-from-react-markdown' },
  { label: 'GitHub', href: sites.github },
]

export const FOOTER: readonly { readonly title: string; readonly links: readonly NavLink[] }[] = [
  {
    title: 'Demos',
    links: [
      { label: 'Renderer demo', href: '/markdown-renderer' },
      { label: 'Editor demo', href: '/markdown-editor' },
      { label: 'Variables demo', href: '/markdown-variables' },
      { label: 'Mermaid live editor', href: '/mermaid-editor' },
      { label: 'Slides demo', href: '/markdown-slides' },
    ],
  },
  {
    title: 'Guides',
    links: [
      { label: 'Getting started', href: '/docs/getting-started' },
      { label: 'Variables', href: '/docs/variables/basics' },
      { label: 'Styling', href: '/docs/styling' },
      { label: 'Security', href: '/docs/security' },
      { label: 'Next.js', href: '/nextjs-markdown' },
      { label: 'Streaming Markdown', href: '/streaming-markdown' },
      { label: 'Slides', href: '/docs/slides' },
    ],
  },
  {
    title: 'Compare',
    links: [
      { label: 'All comparisons', href: '/compare' },
      { label: 'react-markdown alternative', href: '/react-markdown-alternative' },
      { label: 'vs react-markdown', href: '/compare/react-markdown' },
      { label: 'vs markdown-to-jsx', href: '/compare/markdown-to-jsx' },
      { label: 'vs Streamdown', href: '/compare/streamdown' },
      { label: 'Editor vs MDXEditor', href: '/compare/mdxeditor' },
      { label: 'Editor vs Milkdown', href: '/compare/milkdown' },
      { label: 'Variables vs Handlebars', href: '/compare/handlebars' },
      { label: 'Marp and Slidev alternative', href: '/marp-alternative' },
    ],
  },
  {
    title: 'Evidence',
    links: [
      { label: 'Compatibility matrix', href: '/docs/compatibility' },
      { label: 'Migrating', href: '/migrate-from-react-markdown' },
      { label: 'Lossless round trip', href: '/markdown-round-trip' },
      { label: 'GitHub', href: sites.github },
    ],
  },
]

export type SidebarItem = string | { readonly label: string; readonly open?: boolean; readonly items: readonly string[] }

/** Ordered to match spec 13.1: the renderer first, the editor and variables as optional next steps. */
export const DOCS_SIDEBAR: readonly SidebarItem[] = [
  'getting-started',
  { label: 'Renderer', open: true, items: ['renderer/components', 'renderer/gfm', 'renderer/presets', 'renderer/compiling'] },
  { label: 'Editor', items: ['editor/basics', 'editor/headless', 'editor/round-trip', 'editor/images'] },
  { label: 'Variables', items: ['variables/basics', 'variables/schemas', 'variables/formatting', 'variables/authoring'] },
  {
    label: 'Guides',
    items: [
      'guides/render-markdown-in-react',
      'styling',
      'security',
      'server-rendering',
      'extensions',
      'guides/lexical-markdown-editor',
      'guides/markdown-variables',
      'mermaid',
      'slides',
    ],
  },
  'compatibility',
]

/** The docs in sidebar order, for the previous and next links under a doc. */
export const DOCS_ORDER: readonly string[] = DOCS_SIDEBAR.flatMap((item) => (typeof item === 'string' ? [item] : item.items))
