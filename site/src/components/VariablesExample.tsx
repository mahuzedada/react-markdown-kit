import { useMemo, useState, type ReactNode } from 'react'
import Markdown, { compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { variables } from '@react-markdown-kit/variables'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import Badge from '@zuilib/primitives/badge'
import Disclosure from '@zuilib/primitives/disclosure'
import { cn } from '@zuilib/primitives/lib/cn'
import { CAPTION, EXAMPLE, NOTE, OUTPUT, PANE_LABEL, SOURCE, SPLIT } from './exampleStyles'

const gfmPreset = defineMarkdownPreset({ extensions: [gfm()] })

export interface VariablesDataset {
  readonly label: string
  readonly data: Record<string, unknown>
  readonly locale?: string
}

export interface VariablesExampleProps {
  /** Authored Markdown, with `{{placeholders}}`. */
  readonly markdown: string
  /** Datasets the reader can switch between. */
  readonly datasets: readonly VariablesDataset[]
  readonly gfm?: boolean
  readonly title?: string
  readonly children?: ReactNode
}

/**
 * The variables claim, made visible: switching customer changes the OUTPUT and
 * never the SOURCE.
 *
 * The left pane is the authored source and stays byte-for-byte identical as
 * the reader clicks between datasets. The right pane is a real `<Markdown>`
 * rendering the resolved document. Resolution is the `variables()` plugin
 * running inside `compileMarkdown`, exactly as it would in a Node service.
 */
export default function VariablesExample({
  markdown,
  datasets,
  gfm: useGfm = true,
  title,
  children,
}: VariablesExampleProps): ReactNode {
  const [index, setIndex] = useState(0)
  const active = datasets[index] ?? datasets[0]

  const result = useMemo(() => {
    const document = compileMarkdown(markdown, {
      ...(useGfm ? { preset: gfmPreset } : {}),
      extensions: [
        variables({
          data: active?.data ?? {},
          ...(active?.locale === undefined ? {} : { locale: active.locale }),
        }),
      ],
    })
    const diagnostics = document.diagnostics
    return { ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'), document, diagnostics }
  }, [markdown, useGfm, active])

  return (
    <ActivityScope feature="variables-example" as="figure" className={EXAMPLE}>
      {title !== undefined && <figcaption className={CAPTION}>{title}</figcaption>}

      <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2.5" role="group" aria-label="Sample data">
        {datasets.map((dataset, at) => (
          <Button
            key={dataset.label}
            variant={at === index ? 'solid' : 'outline'}
            size="sm"
            track="dataset"
            aria-pressed={at === index}
            onClick={() => setIndex(at)}
          >
            {dataset.label}
          </Button>
        ))}
      </div>

      <div className={SPLIT}>
        <div>
          <div className={PANE_LABEL}>
            Authored source
            <Badge variant="subtle" tone="success" size="sm">
              never changes
            </Badge>
          </div>
          <pre className={cn(SOURCE, 'min-h-32')}>{markdown}</pre>
        </div>
        <div>
          <div className={PANE_LABEL}>
            Resolved for {active?.label}
            <Badge variant="subtle" tone="warning" size="sm">
              changes
            </Badge>
          </div>
          <div className={cn(OUTPUT, 'rmk-document')}>
            {result.ok ? (
              <Markdown {...(useGfm ? { preset: gfmPreset } : {})} document={result.document} />
            ) : (
              <ul className="m-0 pl-[1.1rem] text-base">
                {result.diagnostics.map((diagnostic) => (
                  <li key={`${diagnostic.code}-${diagnostic.path ?? ''}`}>
                    <code>{diagnostic.code}</code> {diagnostic.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Disclosure
        track="data"
        className="rounded-none border-0 border-t shadow-none"
        title={
          <>
            Data passed to <code>variables()</code>
          </>
        }
      >
        <pre className={cn(SOURCE, 'pl-0')}>{JSON.stringify(active?.data ?? {}, null, 2)}</pre>
      </Disclosure>

      {children !== undefined && <div className={NOTE}>{children}</div>}
    </ActivityScope>
  )
}
