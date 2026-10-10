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
// A finger moving this fast (px per ms) when it lifts throws the sheet one step.
const FLICK_PX_PER_MS = 0.4;

export class SheetDetents {
  static readonly flick = FLICK_PX_PER_MS;

  static css(detent: Detent): string {
    const heights: Record<Detent, string> = {
      peek: `${PEEK_PX}px`,
      half: '50%',
      // The status bar's inset too, so a full sheet never slides under the search field.
      full: `calc(100% - ${TOP_GAP_PX}px - env(safe-area-inset-top))`,
    };
    return heights[detent];
  }

  /** The same heights as css(), in pixels. */
  static px(detent: Detent, space: SheetSpace): number {
    const heights: Record<Detent, number> = {
      peek: PEEK_PX,
      half: space.heightPx * 0.5,
      full: space.heightPx - TOP_GAP_PX - space.topInsetPx,
    };
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
