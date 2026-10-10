// Decision 20261010-1630: each no-bin report says no dustbin within this radius.
export const ZONE_RADIUS_M = 1000;

export type BinLine =
  | { readonly key: 'nearest'; readonly metres: number }
  | { readonly key: 'mappedNear'; readonly metres: number }
  | { readonly key: 'noneWithin3km' }
  | { readonly key: 'notMapped' };

/** What can be said about bins near a site, from nearest_bin and no_bin_within_3km. */
export class BinAccess {
  /** Null when the data says nothing (rows from before bins were measured). */
  static line(nearest: { readonly distance_m: number } | null | undefined, noBinWithin3km: boolean | null | undefined): BinLine | null {
    if (nearest) return { key: 'nearest', metres: nearest.distance_m };
    if (noBinWithin3km === true) return { key: 'noneWithin3km' };
    if (nearest === null || noBinWithin3km === null) return { key: 'notMapped' };
    return null;
  }

  /** In a no-bin zone, a mapped bin within 1 km is shown as evidence for readers to judge, never as a block. */
  static zoneLine(nearest: { readonly distance_m: number } | null | undefined, noBinWithin3km: boolean | null | undefined): BinLine | null {
    if (nearest && nearest.distance_m <= ZONE_RADIUS_M) return { key: 'mappedNear', metres: nearest.distance_m };
    return BinAccess.line(nearest, noBinWithin3km);
  }

  /** Bins are measured for waste dumps and no-bin reports only. */
  static applies(reportType: string): boolean {
    return reportType === 'waste_dump' || reportType === 'no_bin';
  }
}
