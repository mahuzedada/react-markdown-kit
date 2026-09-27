import { themes as prismThemes } from 'prism-react-renderer'
import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'
import sites from './src/sites.json'

/*
 * Code blocks on Blueprint's surfaces: light-gray5 in light mode, dark-gray2
 * (the card token) in dark. Token colours come from the stock themes.
 */
const foundryPrism = {
  light: {
    ...prismThemes.github,
    plain: { color: '#1c2127', backgroundColor: '#f6f7f9' },
  },
  dark: {
    ...prismThemes.vsDark,
    plain: { color: '#f6f7f9', backgroundColor: '#252a31' },
  },
}

const config: Config = {
  title: 'React Markdown Kit',
  tagline: 'React packages for rendering, editing and personalizing Markdown.',
  favicon: 'img/favicon.svg',

  // v4 turns every `faster` flag on. The swc HTML minimizer strips attribute
  // quotes (`data-rmk-slide=2`); CI proves the slides page server-rendered by
  // grepping the quoted markup the kit emits, so HTML keeps the terser
  // minimizer, which leaves quotes alone. Every other flag stays on.
  future: { v4: true, faster: { swcHtmlMinimizer: false } },

  url: 'https://reactmarkdownkit.com',
  baseUrl: '/',
  organizationName: 'mahuzedada',
  projectName: 'react-markdown-kit',

  onBrokenLinks: 'throw',

  // Milestone A item 5: og:type on every page. The preset emits the other
  // Open Graph tags; tests/seo-surface.test.ts checks all of them.
  headTags: [
    { tagName: 'meta', attributes: { property: 'og:type', content: 'website' } },
    // Search Console ownership (docs/SEO_WORKPLAN.md section 8). The five Vite
    // sites carry the same tag in their index.html; tests/seo-surface.test.ts
    // asserts it on every host.
    { tagName: 'meta', attributes: { name: 'google-site-verification', content: 'OeinVf8DkV6qubXo57xz7nxQyV2n5RQWJ7xaf7E0JUY' } },
    { tagName: 'meta', attributes: { name: 'msvalidate.01', content: '2B64E1F8A84336B6ADCDC7C6804331D5' } },
    // `favicon` above emits the SVG icon; these match the Vite sites' head.
    // scripts/brand-icons.mjs writes the files.
    { tagName: 'link', attributes: { rel: 'icon', href: '/favicon.ico', sizes: '32x32' } },
    { tagName: 'link', attributes: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
    { tagName: 'link', attributes: { rel: 'manifest', href: '/site.webmanifest' } },
  ],
  markdown: { hooks: { onBrokenMarkdownLinks: 'throw' } },

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
          // Git dates feed the sitemap's lastmod and the footer of each page.
          showLastUpdateTime: true,
        },
        blog: false,
        pages: { showLastUpdateTime: true },
        // lastmod from git, so a crawler can tell what changed; changefreq and
        // priority are ignored by Google and dropped.
        sitemap: { lastmod: 'date', changefreq: null, priority: null },
        theme: {
          // The one site stylesheet (zui, Tailwind utilities and every
          // variable override, shared with the other sites), then the Mermaid
          // plugin's optional stylesheet so every example diagram scales to
          // its column.
          customCss: [require.resolve('./src/css/theme.css'), require.resolve('@react-markdown-kit/mermaid/styles.css')],
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    // Tailwind v4 for src/css/theme.css and the utility classes in pages and components.
    () => ({
      name: 'tailwindcss',
      configurePostCss(options) {
        options.plugins.push(require('@tailwindcss/postcss'))
        return options
      },
    }),
  ],

  themeConfig: {
    // A PNG: social crawlers do not render SVG. Regenerate with scripts/social-cards.mjs.
    image: 'img/social-card.png',
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      // Foundry's top bar is dark in both colour modes; `.navbar--dark` carries
      // the dark token set (src/css/theme.css).
      style: 'dark',
      title: 'React Markdown Kit',
      logo: { alt: 'React Markdown Kit', src: 'img/logo.svg' },
      items: [
        // Spec 13.2: three discovery funnels, each its own substantive page.
        { to: '/react-markdown-renderer', label: 'Renderer', position: 'left' },
        { to: '/react-markdown-editor', label: 'Editor', position: 'left' },
        { to: '/markdown-template-engine', label: 'Templates', position: 'left' },
        { to: '/docs/getting-started', label: 'Docs', position: 'left' },
        // The demo pages (src/pages with DemoLayout, code in src/demos).
        { to: '/markdown-renderer', label: 'Renderer demo', position: 'left' },
        { to: '/markdown-editor', label: 'Editor demo', position: 'left' },
        { to: '/mermaid-editor', label: 'Mermaid editor', position: 'left' },
        { to: '/markdown-slides', label: 'Slides demo', position: 'left' },
        { to: '/migrate-from-react-markdown', label: 'Migrate', position: 'right' },
        {
          href: sites.github,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Packages',
          items: [
            { label: 'Renderer', to: '/react-markdown-renderer' },
            { label: 'Editor', to: '/react-markdown-editor' },
            { label: 'Templates', to: '/markdown-template-engine' },
          ],
        },
        {
          title: 'Guides',
          items: [
            { label: 'Getting started', to: '/docs/getting-started' },
            { label: 'Renderer demo', to: '/markdown-renderer' },
            { label: 'Editor demo', to: '/markdown-editor' },
            { label: 'Mermaid live editor', to: '/mermaid-editor' },
            { label: 'Slides demo', to: '/markdown-slides' },
            { label: 'Styling', to: '/docs/styling' },
            { label: 'Security', to: '/docs/security' },
            { label: 'Next.js', to: '/nextjs-markdown' },
            { label: 'Streaming Markdown', to: '/streaming-markdown' },
            { label: 'Slides', to: '/docs/slides' },
          ],
        },
        {
          title: 'Compare',
          items: [
            { label: 'All comparisons', to: '/compare' },
            { label: 'react-markdown alternative', to: '/react-markdown-alternative' },
            { label: 'vs react-markdown', to: '/compare/react-markdown' },
            { label: 'vs markdown-to-jsx', to: '/compare/markdown-to-jsx' },
            { label: 'vs Streamdown', to: '/compare/streamdown' },
            { label: 'Editor vs MDXEditor', to: '/compare/mdxeditor' },
            { label: 'Editor vs Milkdown', to: '/compare/milkdown' },
            { label: 'Templating vs Handlebars', to: '/compare/handlebars' },
            { label: 'Marp and Slidev alternative', to: '/marp-alternative' },
          ],
        },
        {
          title: 'Evidence',
          items: [
            { label: 'Compatibility matrix', to: '/docs/compatibility' },
            { label: 'Migrating', to: '/migrate-from-react-markdown' },
            { label: 'Lossless round trip', to: '/markdown-round-trip' },
            { label: 'GitHub', href: sites.github },
          ],
        },
      ],
      copyright: `React Markdown Kit by ZUI. MIT licensed.`,
    },
    prism: {
      theme: foundryPrism.light,
      darkTheme: foundryPrism.dark,
      additionalLanguages: ['bash', 'diff', 'json'],
    },
  } satisfies Preset.ThemeConfig,
}

export default config
