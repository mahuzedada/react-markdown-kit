/**
 * The same document, rendered four ways. See README.md.
 */
import Markdown, { defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import type { ComponentPropsWithoutRef } from 'react'

// Opt into the shipped typography for panel 2 only. Importing it does not
// change panels 1, 3 or 4: every rule is scoped under `.rmk-document`.
import '@react-markdown-kit/renderer/styles.css'
import './utility.css'
import './retint.css'

const preset = defineMarkdownPreset({ extensions: [gfm()] })

const SOURCE = `## Release 1.4

Ships **today**. See the [changelog](https://example.com/changelog).

- Faster cold render
- Smaller bundle
- \`compileMarkdown\` is now public

| Metric | Before | After |
| --- | ---: | ---: |
| Cold render | 12.4 ms | 9.1 ms |
| Bundle | 41 kB | 38 kB |
`

/** Panel 4: any component library. These are plain local components. */
function AppLink({ href, children }: ComponentPropsWithoutRef<'a'>) {
  return (
    <a href={href} className="app-link" rel="noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  )
}

function AppTable({ children }: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="app-table-scroll">
      <table className="app-table">{children}</table>
    </div>
  )
}

function AppCode({ children }: ComponentPropsWithoutRef<'code'>) {
  return <code className="app-code">{children}</code>
}

export default function App() {
  return (
    <main className="page">
      <h1>One renderer, four styling approaches</h1>

      <section>
        <h2>1. Unstyled</h2>
        <p className="note">No CSS import, no props. Plain semantic HTML.</p>
        <Markdown preset={preset}>{SOURCE}</Markdown>
      </section>

      <section>
        <h2>2. Shipped theme, retinted</h2>
        <p className="note">
          One import plus three custom properties in <code>retint.css</code>.
        </p>
        <div className="rmk-document retinted">
          <Markdown preset={preset}>{SOURCE}</Markdown>
        </div>
      </section>

      <section>
        <h2>3. Utility classes</h2>
        <p className="note">
          Classes passed per part. Nothing to override, because the kit adds no
          class of its own unless asked.
        </p>
        <Markdown
          preset={preset}
          classNames={{
            heading: 'u-heading',
            paragraph: 'u-paragraph',
            link: 'u-link',
            list: 'u-list',
            table: 'u-table',
            th: 'u-th',
            td: 'u-td',
            code: 'u-code',
          }}
        >
          {SOURCE}
        </Markdown>
      </section>

      <section>
        <h2>4. Your own components</h2>
        <p className="note">
          Swap these for ZUI, shadcn/ui or MUI and nothing else changes.
        </p>
        <Markdown preset={preset} components={{ a: AppLink, table: AppTable, code: AppCode }}>
          {SOURCE}
        </Markdown>
      </section>
    </main>
  )
}
