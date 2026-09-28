/**
 * The `<section>`'s attributes, one contributor per concern. A new slide
 * property that shows on the section is one more entry in the list.
 * Optional attributes appear only when set.
 */
import type { Properties } from 'hast'
import type { SlideModel } from '../deck/model.js'

export interface SectionFacts {
  readonly slide: SlideModel
  /** The accessible name: the title, or "Slide n". */
  readonly label: string
  readonly fragments: number
}

type Contributor = (facts: SectionFacts) => Properties

const SECTION_ATTRIBUTES: readonly Contributor[] = [
  ({ slide }) => ({ dataRmkSlide: String(slide.index + 1) }),
  ({ slide }) => (slide.title === undefined ? {} : { dataRmkSlideTitle: slide.title }),
  ({ label }) => ({ ariaRoledescription: 'slide', ariaLabel: label }),
  ({ slide }) => (slide.name === undefined ? {} : { id: `slide-${slide.name}`, dataRmkSlideName: slide.name }),
  ({ slide }) => (slide.classes.length === 0 ? {} : { dataRmkSlideClass: slide.classes.join(' ') }),
  ({ fragments }) => (fragments === 0 ? {} : { dataRmkSlideFragments: String(fragments) }),
  ({ slide }) => (slide.layout === undefined || slide.layout === 'default' ? {} : { dataRmkSlideLayout: slide.layout }),
  ({ slide }) => (slide.transition === undefined ? {} : { dataRmkSlideTransition: slide.transition }),
]

export function sectionAttributes(facts: SectionFacts): Properties {
  return Object.assign({}, ...SECTION_ATTRIBUTES.map((contribute) => contribute(facts))) as Properties
}
