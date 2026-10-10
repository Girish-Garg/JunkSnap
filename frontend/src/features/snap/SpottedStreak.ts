/** Frames in a row with a waste box before the hint says "Waste spotted", so one stray guess never does. */
export const SPOTTED_FRAMES = 2;

/** Counts consecutive frames with waste on screen; any frame without it starts the count again. */
export class SpottedStreak {
  readonly #needed: number;
  #run = 0;

  constructor(needed: number = SPOTTED_FRAMES) {
    this.#needed = needed;
  }

  /** Adds one frame and says whether the hint may show "Waste spotted" now. */
  next(spotted: boolean): boolean {
    this.#run = spotted ? this.#run + 1 : 0;
    return this.#run >= this.#needed;
  }
}
