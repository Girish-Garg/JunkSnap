/**
 * How old an arriving fix may be (the config's capture settings): Snap, Scan, No bin and cleanup refuse a fix already
 * older than fixMaxAgeMs when it arrives, since it may be from where the phone was; after staleFixFallbackMs with only
 * refused fixes (a phone clock off from the GPS's, say), the newest is used anyway.
 */
export interface FixFreshness {
  readonly fixMaxAgeMs: number;
  readonly staleFixFallbackMs: number;
}

/** Whether an arriving fix is recent enough to freeze with a photo, send as no bin, or start a Scan's GPS track from. */
export class CaptureFix {
  static fresh(ageMs: number, freshness: FixFreshness): boolean {
    return ageMs <= freshness.fixMaxAgeMs;
  }
}
