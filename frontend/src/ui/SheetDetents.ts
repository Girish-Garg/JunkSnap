export type Detent = 'peek' | 'half' | 'full';

/** The room a sheet moves in: its container's height, and the status bar inset that full height leaves free. */
export interface SheetSpace {
  readonly heightPx: number;
  readonly topInsetPx: number;
}

const ORDER: readonly Detent[] = ['peek', 'half', 'full'];
const PEEK_PX = 156;
// Full height leaves this much map visible above the sheet.
const TOP_GAP_PX = 80;
// Half is at least this tall (never above full): on a 360 x 640 phone a site's header and its action row, labels and the
// line under them, then still end above the raised Report button (sheet.css stops the body --map-foot above the foot).
const HALF_MIN_PX = 400;
// A finger moving this fast (px per ms) when it lifts throws the sheet one step.
const FLICK_PX_PER_MS = 0.4;

export class SheetDetents {
  static readonly flick = FLICK_PX_PER_MS;

  static css(detent: Detent): string {
    // The status bar's inset too, so a full sheet never slides under the search field.
    const full = `calc(100% - ${TOP_GAP_PX}px - env(safe-area-inset-top))`;
    const heights: Record<Detent, string> = { peek: `${PEEK_PX}px`, half: `min(max(50%, ${HALF_MIN_PX}px), ${full})`, full };
    return heights[detent];
  }

  /** The same heights as css(), in pixels. */
  static px(detent: Detent, space: SheetSpace): number {
    const full = space.heightPx - TOP_GAP_PX - space.topInsetPx;
    const heights: Record<Detent, number> = { peek: PEEK_PX, half: Math.min(Math.max(space.heightPx * 0.5, HALF_MIN_PX), full), full };
    return heights[detent];
  }

  static step(detent: Detent, direction: 1 | -1): Detent {
    const index = Math.min(Math.max(ORDER.indexOf(detent) + direction, 0), ORDER.length - 1);
    return ORDER[index] ?? detent;
  }

  static cycle(detent: Detent): Detent {
    return ORDER[(ORDER.indexOf(detent) + 1) % ORDER.length] ?? 'half';
  }

  /** A flick moves one step; otherwise the sheet snaps to the nearest height. */
  static settle(from: Detent, heightPx: number, velocity: number, space: SheetSpace): Detent {
    if (Math.abs(velocity) > FLICK_PX_PER_MS) return SheetDetents.step(from, velocity > 0 ? 1 : -1);
    const gap = (detent: Detent) => Math.abs(SheetDetents.px(detent, space) - heightPx);
    return ORDER.reduce((best, detent) => (gap(detent) < gap(best) ? detent : best));
  }
}
