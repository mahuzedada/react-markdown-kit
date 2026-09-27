# Changelog

## 0.1.0 (unreleased)

First release under the name `@react-markdown-kit/variables`. The package was `@react-markdown-kit/template`, which stops at 0.1.0. Behaviour is unchanged; only names moved:

| Before | After |
| --- | --- |
| `@react-markdown-kit/template` | `@react-markdown-kit/variables` |
| `template({ data })` | `variables({ data })` |
| `templateVariables()` | `variableChips()` |
| extension names `template`, `template-variables` | `variables`, `variable-chips` |
| `TemplateOptions`, `TemplateVariablesOptions` | `VariablesOptions`, `VariableChipsOptions` |
| `TemplateVariable{Adapter,Match,Node,Summary,Value}`, `TemplateVariableMeta` | `Variable{Adapter,Match,Node,Summary,Value}`, `VariableMeta` |
| `createTemplateVariableAdapter`, `isTemplateVariableNode`, `TEMPLATE_VARIABLE_NODE` | `createVariableAdapter`, `isVariableNode`, `VARIABLE_NODE` |
| `TemplateFormatter`, `TemplateFormatterContext`, `TemplateFormatterError` | `VariableFormatter`, `VariableFormatterContext`, `VariableFormatterError` |
| `TemplateDiagnostic`, `TemplateDiagnosticCode` | `VariableDiagnostic`, `VariableDiagnosticCode` |
| `TEMPLATE_DIAGNOSTIC_CODES`, `TEMPLATE_*` codes | `VARIABLE_DIAGNOSTIC_CODES`, `VARIABLE_*` codes |
| mdast node `templateVariable` | mdast node `variable` |
| extension capability `template` | extension capability `variables` |
| Lexical node type `rmk-template-variable`, `INSERT_TEMPLATE_VARIABLE_COMMAND` | `rmk-variable`, `INSERT_VARIABLE_COMMAND` |

Diagnostic codes are part of the public contract, so anything that matches on a `TEMPLATE_*` code needs the new spelling. Lexical JSON saved with the old node type won't load into the new node; Markdown source is unaffected.

Three codes that nothing ever emitted are gone: `TEMPLATE_URL_VALUE_TYPE`, `TEMPLATE_LOCALE_FALLBACK` and `TEMPLATE_LOCALE_MISSING`.

## @react-markdown-kit/template 0.1.0 (2026-09-20)

First release. `template({ data })` resolves typed `{{placeholders}}` while the renderer parses, with Standard Schema validation, the `number`, `currency`, `percent`, `date`, `time` and `datetime` formatters and locale support; values are placed into the parsed tree and cannot inject Markdown. `templateVariables()` on `/editor` edits placeholders as chips.
