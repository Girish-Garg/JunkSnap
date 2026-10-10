import { BinAccess, NO_BIN_MIN_REPORTERS } from '../../domain/BinAccess';
import type { SiteProperties } from '../../domain/Site';

export interface EvidenceLine {
  /** Key under site.* in the i18n files. */
  readonly key: string;
  readonly count?: number;
  readonly min?: number;
  /** Metres to the nearest known bin, for site.bin.nearest. */
  readonly metres?: number;
}

/** The site sheet's evidence lines: people who reported, the no-bin threshold and the nearest bin. */
export class SiteEvidenceView {
  static lines(site: SiteProperties): readonly EvidenceLine[] {
    return [...SiteEvidenceView.#reporters(site), ...SiteEvidenceView.#bin(site)];
  }

  static #reporters({ reporters, report_type }: SiteProperties): readonly EvidenceLine[] {
    if (reporters === undefined) return [];
    const people = { key: 'reporters', count: reporters };
    return report_type === 'no_bin' ? [people, { key: 'noBinReporters', count: reporters, min: NO_BIN_MIN_REPORTERS }] : [people];
  }

  static #bin({ report_type, insights }: SiteProperties): readonly EvidenceLine[] {
    const line = BinAccess.applies(report_type) ? BinAccess.line(insights?.nearest_bin, insights?.no_bin_within_3km) : null;
    if (!line) return [];
    return [line.key === 'nearest' ? { key: 'bin.nearest', metres: line.metres } : { key: `bin.${line.key}` }];
  }
}
