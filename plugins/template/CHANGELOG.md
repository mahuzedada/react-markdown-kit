# Changelog

## 0.1.0 (2026-09-20)

First release. `template({ data })` resolves typed `{{placeholders}}` while the renderer parses, with Standard Schema validation, the `number`, `currency`, `percent`, `date`, `time` and `datetime` formatters and locale support; values are placed into the parsed tree and cannot inject Markdown. `templateVariables()` on `/editor` edits placeholders as chips.
