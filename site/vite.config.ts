import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { pages, remarkSite } from './vite/pages'
import { THEME_SCRIPT } from './src/app/theme-script'

/*
 * The whole site is one Vite app: MDX for the docs and articles, React pages
 * for the home page and the demos, zui and Tailwind for every component.
 * `vite` serves it for development; scripts/build.mjs builds the client,
 * renders every route to static HTML and writes the sitemap.
 */
export default defineConfig({
  plugins: [
    { enforce: 'pre', ...mdx({ include: /\.mdx$/, remarkPlugins: [remarkFrontmatter, remarkGfm, remarkSite] }) },
    react({ include: /\.(mdx|tsx|ts)$/ }),
    tailwindcss(),
    pages(),
    {
      name: 'site-theme-script',
      transformIndexHtml: () => [{ tag: 'script', children: THEME_SCRIPT, injectTo: 'head-prepend' }],
    },
  ],
  resolve: { alias: { '@site': new URL('.', import.meta.url).pathname.replace(/\/$/, '') } },
  publicDir: 'static',
  build: {
    outDir: 'build',
    // One stylesheet for every page: content rendered on the server is styled
    // before any page chunk loads.
    cssCodeSplit: false,
    manifest: true,
    rollupOptions: {
      input: 'src/app/entry-client.tsx',
      output: { assetFileNames: (asset) => (asset.names.some((name) => name.endsWith('.css')) ? 'assets/css/[name]-[hash][extname]' : 'assets/[name]-[hash][extname]') },
    },
  },
})
