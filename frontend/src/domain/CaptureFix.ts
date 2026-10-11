/** Snap, Scan, No bin and cleanup refuse a fix already older than this when it arrives: it may be from where the phone was. */
export const CAPTURE_FIX_MAX_AGE_MS = 10_000;
/** After this long with only refused fixes (a phone clock off from the GPS's, say), the newest is used anyway. */
export const STALE_FIX_FALLBACK_MS = 15_000;

/** Whether an arriving fix is recent enough to freeze with a photo, send as no bin, or start a Scan's GPS track from. */
export class CaptureFix {
  static fresh(ageMs: number): boolean {
    return ageMs <= CAPTURE_FIX_MAX_AGE_MS;
  }
}
