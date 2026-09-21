# Four styling approaches, one renderer

This example proves the binding claim in `docs/STYLING.md`: React Markdown Kit
ships no styling dependency and works with whatever the application already
uses. The same Markdown renders four ways in one page, with no forks, no
patches and no `!important`.

| Panel | Approach | What it needs |
| --- | --- | --- |
| 1 | Unstyled | nothing at all |
| 2 | Shipped theme, retinted | one CSS import plus three custom properties |
| 3 | Utility classes | a `classNames` prop |
| 4 | Your own components | a `components` prop |

Run it:

```bash
pnpm --filter styling-approaches dev
```

Panel 4 uses plain local components on purpose. Swap them for ZUI, shadcn/ui,
MUI or anything else and nothing else in the file changes. That is the point:
a design system is something the application chooses, never something the
library imposes.
