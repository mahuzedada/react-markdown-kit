import { useMemo, useState, type ReactNode } from 'react'
import Markdown, { compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import { template } from '@react-markdown-kit/template'
import styles from './Example.module.css'

const gfmPreset = defineMarkdownPreset({ extensions: [gfm()] })

export interface TemplateDataset {
  readonly label: string
  readonly data: Record<string, unknown>
  readonly locale?: string
}

export interface TemplateExampleProps {
  /** Authored Markdown, with `{{placeholders}}`. */
  readonly markdown: string
  /** Datasets the reader can switch between. */
  readonly datasets: readonly TemplateDataset[]
  readonly gfm?: boolean
  readonly title?: string
  readonly children?: ReactNode
}

/**
 * The template claim, made visible: switching customer changes the OUTPUT and
 * never the SOURCE.
 *
 * The left pane is the authored template and stays byte-for-byte identical as
 * the reader clicks between datasets. The right pane is a real `<Markdown>`
 * rendering the resolved document. Resolution is the `template()` plugin
 * running inside `compileMarkdown`, exactly as it would in a Node service.
 */
export default function TemplateExample({
  markdown,
  datasets,
  gfm: useGfm = true,
  title,
  children,
}: TemplateExampleProps): ReactNode {
  const [index, setIndex] = useState(0)
  const active = datasets[index] ?? datasets[0]

  const result = useMemo(() => {
    const document = compileMarkdown(markdown, {
      ...(useGfm ? { preset: gfmPreset } : {}),
      extensions: [
        template({
          data: active?.data ?? {},
          ...(active?.locale === undefined ? {} : { locale: active.locale }),
        }),
      ],
    })
    const diagnostics = document.diagnostics
    return { ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'), document, diagnostics }
  }, [markdown, useGfm, active])

  return (
    <figure className={styles.example}>
      {title !== undefined && <figcaption className={styles.caption}>{title}</figcaption>}

      <div className={styles.switcher} role="group" aria-label="Sample data">
        {datasets.map((dataset, at) => (
          <button
            key={dataset.label}
            type="button"
            className={at === index ? styles.switchActive : styles.switch}
            aria-pressed={at === index}
            onClick={() => setIndex(at)}
          >
            {dataset.label}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        <div className={styles.pane}>
          <div className={styles.paneLabel}>
            Authored template <span className={styles.badgeOk}>never changes</span>
          </div>
          <pre className={styles.source}>{markdown}</pre>
        </div>
        <div className={styles.pane}>
          <div className={styles.paneLabel}>
            Resolved for {active?.label} <span className={styles.badgeEdit}>changes</span>
          </div>
          <div className={`${styles.output} rmk-document`}>
            {result.ok ? (
              <Markdown {...(useGfm ? { preset: gfmPreset } : {})} document={result.document} />
            ) : (
              <ul className={styles.diagnostics}>
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

      <details className={styles.details}>
        <summary>Data passed to <code>template()</code></summary>
        <pre className={styles.source}>{JSON.stringify(active?.data ?? {}, null, 2)}</pre>
      </details>

      {children !== undefined && <div className={styles.note}>{children}</div>}
    </figure>
  )
}
