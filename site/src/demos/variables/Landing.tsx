import type { ReactNode } from 'react'
import CodeBlock from '../../components/CodeBlock'
import { Callout, Feature, Features, Hero, LinkRow, Page, Steps } from '../../components/landing/Page'
import { docsUrl, sites } from '../../sites'
import { Faq, JsonLd, npmUrl, webApplication, type FaqItem } from '../../components/landing/Seo'

/*
 * The crawlable copy of reactmarkdownkit.com/markdown-variables. It renders on
 * the server into the built page; the demo above it loads in the browser.
 */

export const TITLE = 'Markdown Variables Playground for React'

/** Also the meta description of the page (src/pages); tests/seo-surface.test.ts keeps them equal. */
export const DESCRIPTION =
  'Try Markdown variables for React in the browser: edit a document with typed placeholders, switch the data and locale, and see what resolves or fails.'

const blob = (path: string): string => `${sites.github}/blob/main/${path}`

const RENDER = `import Markdown from '@react-markdown-kit/renderer'
import { variables } from '@react-markdown-kit/variables'

<Markdown extensions={[variables({ data: { user: { name: 'Chatis' } } })]}>
  {'# Hello {{user.name}}'}
</Markdown>`

const SCHEMA = `variables<ReportData>({ data })

variables({ data, schema: ReportSchema })`

const FORMATTERS = `{{revenue | currency:"USD"}}
{{renewsAt | date:"long"}}
{{share | percent:1}}`

const COMPILE = `import { compileMarkdown, documentToMarkdown } from '@react-markdown-kit/renderer'

const document = compileMarkdown(source, { preset, extensions: [variables({ data })] })
await writeFile('report.md', await documentToMarkdown(document))`

const EDITOR = `import { variableChips } from '@react-markdown-kit/variables/editor'

<MarkdownEditor
  value={source}
  onChange={setSource}
  extensions={[variableChips({ variables, previewData: sample })]}
/>`

const TESTS = `pnpm test -- plugins/variables/tests/injection.test.ts \\
  tests/variables-serialization-safety.test.ts \\
  tests/variables-security-independent.test.ts`

const FAQ: readonly FaqItem[] = [
  {
    question: 'Is there a way to fill Markdown variables without re-parsing the output?',
    answer:
      'Yes. @react-markdown-kit/variables resolves {{placeholders}} while the renderer parses, so each value goes into the syntax tree as text and the document is never stringified and parsed a second time. There’s no engine object to call either, since variables({ data }) is just a renderer extension.',
    more: { href: docsUrl('/docs/variables/basics'), label: 'Variable basics.' },
  },
  {
    question: 'Can variable data inject Markdown or HTML?',
    answer:
      'No. A value becomes a text node, so it can’t create a heading, a list, a table row, a link destination, an HTML tag or a code fence. That still holds after the document is serialized back to Markdown and re-parsed with GFM. There are 152 cases asserting this across injection.test.ts, variables-serialization-safety.test.ts and variables-security-independent.test.ts.',
    more: { href: docsUrl('/docs/security'), label: 'The security model.' },
  },
  {
    question: 'Does it work outside React?',
    answer:
      'Yes. The root entry doesn’t import React or Lexical, so compileMarkdown with the same extension runs in a Node service, a worker, a CLI, an email job or a PDF pipeline. scripts/pack-check.mjs checks this by resolving a document from the packed tarball in a project that doesn’t have Lexical installed.',
  },
  {
    question: 'Which validation libraries work with the schema option?',
    answer:
      'Any validator that implements Standard Schema, which includes Zod, Valibot and ArkType. The package doesn’t depend on any of them and detects the validator by its shape, so you don’t need an adapter. Async validators get a diagnostic instead of being silently awaited.',
    more: { href: docsUrl('/docs/variables/schemas'), label: 'Schemas and types.' },
  },
  {
    question: 'Can I share what I typed into this demo?',
    answer:
      'Yes. Copy link compresses the document, the data and the locale into the URL hash. Whoever opens the link gets this page with all three filled in, and nothing gets uploaded.',
  },
]

export default function Landing(): ReactNode {
  return (
    <Page id="docs">
      <Hero
        kicker="Free and open source, runs in your browser"
        title="Markdown variables"
        lede={
          <>
            Fill a Markdown document in with typed application data. Placeholders get resolved inside the
            parser, so a value can&rsquo;t turn into Markdown structure. The demo above runs the real{' '}
            <code>variables()</code> plugin in your browser.
          </>
        }
      >
        <LinkRow>
          <a href={docsUrl('/docs/variables/basics')}>Variables docs</a>
          <a href={npmUrl('variables')}>npm</a>
          <a href={sites.github}>GitHub</a>
          <a href={sites.home}>React Markdown Kit</a>
        </LinkRow>
      </Hero>

      <Features>
        <Feature title="Values stay text">
          A value goes into the parsed tree as a text node. It can&rsquo;t add a heading, a table row, a link
          destination or an HTML tag, and 152 test cases check that.
        </Feature>
        <Feature title="Typed and validated">
          TypeScript generics at compile time, and any Standard Schema validator (Zod, Valibot, ArkType) at
          runtime. A missing value is an error, never a blank.
        </Feature>
        <Feature title="A renderer plugin">
          There&rsquo;s no separate engine. <code>variables()</code> is an extension, so it runs wherever the
          renderer runs, React or not.
        </Feature>
      </Features>

      <h2>Install the package</h2>
      <CodeBlock language="bash">npm install @react-markdown-kit/renderer @react-markdown-kit/variables</CodeBlock>
      <p>
        <code>variables()</code> is a plugin. The renderer parses with your preset and the plugin fills in the
        tree. <code>compileMarkdown</code> runs the same extension outside React, in a service, a worker, a CLI, an
        email job or a PDF pipeline.
      </p>

      <h2>Use variables in three steps</h2>
      <Steps>
        <li>
          <strong>Render a document with data.</strong> The source keeps its placeholders, and each render passes
          the data for one reader.
          <CodeBlock language="tsx">{RENDER}</CodeBlock>
        </li>
        <li>
          <strong>Type the data, then validate it.</strong> Generics catch mistakes at compile time. Runtime
          schemas go through <a href="https://standardschema.dev">Standard Schema</a>, so Zod, Valibot and ArkType
          all work without an adapter. The validator is detected by its <code>~standard</code> member, and{' '}
          <a href={blob('plugins/variables/tests/schema.test.ts#L59')}>
            <code>schema.test.ts</code>
          </a>{' '}
          runs the same document against two vendors. A missing required value is an error diagnostic and renders
          nothing (or your <code>fallback</code>), so you won&rsquo;t send a document with a blank where a number
          should be (<a href={blob('plugins/variables/tests/resolve.test.ts#L53')}>missing-value tests</a>).
          <CodeBlock language="ts">{SCHEMA}</CodeBlock>
        </li>
        <li>
          <strong>Format for the reader&rsquo;s locale.</strong> There are six built-in formatters:{' '}
          <code>number</code>, <code>currency</code>, <code>percent</code>, <code>date</code>, <code>time</code> and{' '}
          <code>datetime</code>. <code>locale</code> and <code>timeZone</code> are options on{' '}
          <code>variables()</code>.
          <CodeBlock language="text">{FORMATTERS}</CodeBlock>
        </li>
      </Steps>

      <p>Two formatting rules have their own tests, because getting either one wrong is expensive.</p>
      <ul>
        <li>
          <strong>Currency always carries an explicit ISO 4217 code.</strong> <code>{'{{revenue | currency}}'}</code>{' '}
          is an error, because it won&rsquo;t guess a currency from the locale. <code>currency:&quot;USD&quot;</code>{' '}
          in <code>fr-FR</code> renders <code>$US</code> and stays in dollars (
          <a href={blob('plugins/variables/tests/formatters.test.ts#L22')}>currency tests</a>).
        </li>
        <li>
          <strong>The time zone is explicit and defaults to UTC</strong>, so a report doesn&rsquo;t change depending
          on which machine rendered it (<a href={blob('plugins/variables/tests/formatters.test.ts#L82')}>date and time tests</a>).
        </li>
      </ul>

      <Callout>
        <p>
          <strong>More docs.</strong> <a href={docsUrl('/docs/variables/formatting')}>Formatting and localization</a>{' '}
          covers every formatter and its arguments, <a href={docsUrl('/docs/guides/markdown-variables')}>variables in a
          .md file</a> walks through a file-based setup, and <a href={docsUrl('/compare/handlebars')}>the Handlebars
          comparison</a> explains why string interpolation behaves differently.
        </p>
      </Callout>

      <h2>Data cannot inject structure</h2>
      <p>
        Values are placed into the parsed syntax tree as nodes. They&rsquo;re never substituted into the source text
        and re-parsed, so a customer named <code>**Administrator**</code> renders as those literal characters. Pick
        Hostile values in the demo to see it. Three test files cover this, with 152 cases between them:
      </p>
      <table>
        <thead>
          <tr>
            <th>What is asserted</th>
            <th>Where</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              22 hostile values in a heading and a paragraph keep the document&rsquo;s node types and their own
              characters, and survive a serialize and re-parse
            </td>
            <td>
              <a href={blob('plugins/variables/tests/injection.test.ts#L21')}>
                <code>injection.test.ts</code>
              </a>{' '}
              (77)
            </td>
          </tr>
          <tr>
            <td>
              12 line-start constructs, in 5 authored contexts, cannot become structure after{' '}
              <code>documentToMarkdown</code> and a GFM re-parse
            </td>
            <td>
              <a href={blob('tests/variables-serialization-safety.test.ts#L16')}>
                <code>variables-serialization-safety.test.ts</code>
              </a>{' '}
              (62)
            </td>
          </tr>
          <tr>
            <td>The same claim written again without the plugin&rsquo;s own helpers, plus prototype-chain paths</td>
            <td>
              <a href={blob('tests/variables-security-independent.test.ts')}>
                <code>variables-security-independent.test.ts</code>
              </a>{' '}
              (13)
            </td>
          </tr>
        </tbody>
      </table>
      <p>Run them yourself:</p>
      <CodeBlock language="bash">{TESTS}</CodeBlock>
      <p>A few more rules come out of the same design:</p>
      <ul>
        <li>
          <strong>Code contexts are literal.</strong> A <code>{'{{path}}'}</code> inside inline code, a fenced block or
          an indented block is treated as documentation about a placeholder and left alone (
          <a href={blob('plugins/variables/tests/literal-contexts.test.ts#L15')}>literal-context tests</a>).
        </li>
        <li>
          <strong>A URL binding is all or nothing.</strong> A placeholder has to be the entire link destination, and
          the resolved value still goes through the protocol policy, so <code>javascript:</code> can&rsquo;t end up in
          an <code>href</code> (<a href={blob('plugins/variables/tests/links.test.ts#L72')}>partial-URL tests</a> and{' '}
          <a href={blob('plugins/variables/tests/links.test.ts#L97')}>destination policy tests</a>).
        </li>
        <li>
          <strong>Prototype-chain paths never resolve.</strong> <code>__proto__</code>, <code>constructor</code> and{' '}
          <code>prototype</code> are refused at resolve time, and nothing gets written to{' '}
          <code>Object.prototype</code> (<a href={blob('plugins/variables/tests/paths.test.ts#L41')}>path tests</a>).
        </li>
      </ul>
      <p>
        Diagnostics include the path but never the runtime value, so they&rsquo;re safe to log (
        <a href={blob('plugins/variables/tests/links.test.ts#L115')}>test</a>). The{' '}
        <a href={docsUrl('/docs/security')}>security model</a> has the rest.
      </p>

      <h2>It renders through the same renderer</h2>
      <p>
        Resolution happens inside the renderer&rsquo;s own compile step, so there&rsquo;s no stringify and reparse in
        between. You can cache a compiled document and hand it to <code>&lt;Markdown document&gt;</code> later. If you
        need Markdown text back (for an email body or a file on disk), serialize the compiled document. Serializing
        re-escapes, so <code>**Administrator**</code> comes back out as <code>\*\*Administrator\*\*</code> and still
        reads as literal text (<a href={blob('plugins/variables/tests/to-markdown.test.ts#L13')}>serializer tests</a>
        ). The demo&rsquo;s Markdown tab shows that output.
      </p>
      <CodeBlock language="ts">{COMPILE}</CodeBlock>

      <h2>Authoring the document</h2>
      <p>
        <code>@react-markdown-kit/variables/editor</code> turns each placeholder into a chip in the rich editor, with
        a label and a sample-data preview, and adds an insert-variable command to the toolbar. Preview data only
        changes what the author sees. It&rsquo;s never saved. The <a href={sites.editorDemo}>editor demo</a> has it
        running, and <a href={docsUrl('/docs/variables/authoring')}>authoring variables</a> covers the options.
      </p>
      <CodeBlock language="tsx">{EDITOR}</CodeBlock>

      <h2>About this demo</h2>
      <ul>
        <li>
          The left side is the authored source and the JSON handed to <code>variables()</code>. The source stays the
          same whichever data set you pick. Only the output changes.
        </li>
        <li>
          <strong>Rendered</strong> is a <code>&lt;Markdown&gt;</code> showing the document <code>compileMarkdown</code>{' '}
          produced. <strong>Markdown</strong> is that document serialized back with <code>documentToMarkdown</code>.{' '}
          <strong>Diagnostics</strong> lists every code the plugin reported.
        </li>
        <li>
          Hostile values puts Markdown and HTML into the data, and it renders as literal text. Unsafe link binds a{' '}
          <code>javascript:</code> URL and Missing value drops one amount. Both fail, so nothing renders and the
          Diagnostics tab says why.
        </li>
        <li>
          If you&rsquo;re writing a personalized email or report, <a href={docsUrl('/personalized-markdown')}>
          personalized Markdown</a> goes through a full setup.
        </li>
      </ul>

      <Faq id="variables-faq" items={FAQ} />

      <JsonLd data={webApplication({ name: TITLE, url: sites.variablesDemo, description: DESCRIPTION })} />
    </Page>
  )
}
