/** Presentation metadata, deliberately separate from the schema (spec 8.9). */
export interface VariableMeta {
  readonly label?: string
  readonly description?: string
  readonly group?: string
  /** Free-form type hint for pickers. Not enforced; the schema enforces. */
  readonly type?: string
  /** Sample value for previews and documentation. */
  readonly example?: unknown
  /** Default true. A variable declared optional resolves to empty text. */
  readonly required?: boolean
  /** Used when the value is absent. Implies the variable is not required. */
  readonly default?: unknown
}
