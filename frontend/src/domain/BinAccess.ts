// Decision 20261010-1430: the api's NO_BIN_MIN_REPORTERS; hard-coded until the api exposes it.
export const NO_BIN_MIN_REPORTERS = 5;

export type BinLine =
  | { readonly key: 'nearest'; readonly metres: number }
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

  /** Bins are measured for waste dumps and no-bin reports only. */
  static applies(reportType: string): boolean {
    return reportType === 'waste_dump' || reportType === 'no_bin';
  }
}
