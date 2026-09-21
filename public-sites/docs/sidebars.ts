import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

/**
 * Ordered to match spec 13.1: lead with the renderer, then components, GFM,
 * presets, compatibility, migration, server behaviour, and only then the
 * editor and templates as optional next steps.
 */
const sidebars: SidebarsConfig = {
  docs: [
    { type: 'doc', id: 'getting-started', label: 'Getting started' },
    {
      type: 'category',
      label: 'Renderer',
      collapsed: false,
      items: ['renderer/components', 'renderer/gfm', 'renderer/presets', 'renderer/compiling'],
    },
    {
      type: 'category',
      label: 'Editor',
      items: ['editor/basics', 'editor/headless', 'editor/round-trip', 'editor/images'],
    },
    {
      type: 'category',
      label: 'Templates',
      items: ['templates/basics', 'templates/schemas', 'templates/formatting', 'templates/authoring'],
    },
    {
      type: 'category',
      label: 'Guides',
      items: ['styling', 'security', 'server-rendering', 'extensions', 'mermaid', 'slides'],
    },
    { type: 'doc', id: 'compatibility', label: 'Compatibility' },
  ],
}

export default sidebars
