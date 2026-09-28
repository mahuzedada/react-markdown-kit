/**
 * Numbers a slide's reveal steps in reading order. A `--` group, a list
 * item of an incremental list and a code highlight step each take the
 * next number; the total is the slide's `data-rmk-slide-fragments`.
 */
export class FragmentCounter {
  #current = 0

  /** The number most recently handed out; 0 before any. */
  get current(): number {
    return this.#current
  }

  next(): number {
    this.#current += 1
    return this.#current
  }
}
