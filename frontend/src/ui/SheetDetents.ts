export type Detent = 'peek' | 'half' | 'full';

const ORDER: readonly Detent[] = ['peek', 'half', 'full'];
const PEEK_PX = 156;
// Full height leaves this much map visible above the sheet.
const TOP_GAP_PX = 80;
const FLICK_PX_PER_MS = 0.6;

export class SheetDetents {
  static css(detent: Detent): string {
    const heights: Record<Detent, string> = {
      peek: `${PEEK_PX}px`,
      half: '50%',
      full: `calc(100% - ${TOP_GAP_PX}px)`,
    };
    return heights[detent];
  }

  static px(detent: Detent, containerPx: number): number {
    const heights: Record<Detent, number> = {
      peek: PEEK_PX,
      half: containerPx * 0.5,
      full: containerPx - TOP_GAP_PX,
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
  static settle(from: Detent, heightPx: number, velocity: number, containerPx: number): Detent {
    if (Math.abs(velocity) > FLICK_PX_PER_MS) return SheetDetents.step(from, velocity > 0 ? 1 : -1);
    const gap = (detent: Detent) => Math.abs(SheetDetents.px(detent, containerPx) - heightPx);
    return ORDER.reduce((best, detent) => (gap(detent) < gap(best) ? detent : best));
  }
}
