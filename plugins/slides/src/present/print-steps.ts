/**
 * `printSteps`: each slide with reveal steps prints once per step, the
 * finished slide last. The copies go before their slide, marked
 * `data-rmk-slide-print-step`, which the stylesheet hides on screen and
 * shows in print. They are added after mount only, so hydration still sees
 * the static markup.
 */
import { cloneElement, type ReactNode } from 'react'
import { sectionAtStep } from './present-section.js'
import { childList, fragmentCount, isElementWith } from './sections.js'

export function withPrintSteps(children: ReactNode): ReactNode[] {
  return childList(children).flatMap((child) => {
    if (!isElementWith(child, 'data-rmk-slide')) return [child]
    const steps = Array.from({ length: fragmentCount(child) }, (_, step) =>
      cloneElement(sectionAtStep(child, step, 'data-rmk-slide-print-step'), { key: `${String(child.key)}-step-${step}` }),
    )
    return [...steps, child]
  })
}
