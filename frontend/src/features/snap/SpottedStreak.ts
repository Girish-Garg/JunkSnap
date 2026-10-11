import { CAPTURE_DEFAULTS } from '../../config/CaptureSettings';

/**
 * Counts consecutive frames with waste on screen; any frame without it starts the count again. The hint says
 * "Waste spotted" only after `needed` such frames (capture.spottedFrames), so one stray guess never does.
 */
export class SpottedStreak {
  readonly #needed: number;
  #run = 0;

  constructor(needed: number = CAPTURE_DEFAULTS.spottedFrames) {
    this.#needed = needed;
  }

  /** Adds one frame and says whether the hint may show "Waste spotted" now. */
  next(spotted: boolean): boolean {
    this.#run = spotted ? this.#run + 1 : 0;
    return this.#run >= this.#needed;
  }
}
